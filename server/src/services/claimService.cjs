const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const assetModel = require('../models/assetModel.cjs')
const claimApprovalModel = require('../models/claimApprovalModel.cjs')
const claimModel = require('../models/claimModel.cjs')
const trustedCircleModel = require('../models/trustedCircleModel.cjs')
const userModel = require('../models/userModel.cjs')
const notificationService = require('./notificationService.cjs')
const auditLogService = require('./auditLogService.cjs')
const trustedCircleService = require('./trustedCircleService.cjs')
const { config } = require('../config/env.cjs')
const { encryptBuffer, encryptText, decryptText, hashLookup } = require('./encryptionService.cjs')
const { signClaimAccessToken, signClaimPortalToken } = require('./claimAccessService.cjs')
const { addSeconds, nowIso } = require('../utils/time.cjs')

function decodeBase64(base64) {
  return Buffer.from(base64, 'base64')
}

function hashApprovalToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function ownerFromIdentifier(identifier) {
  if (String(identifier).includes('@')) {
    return userModel.findByEmail(String(identifier).trim().toLowerCase())
  }

  return userModel.findByPhone(String(identifier).trim())
}

function resolveTrustedClaimant(ownerUserId, claimantContact) {
  if (String(claimantContact).includes('@')) {
    const entry = trustedCircleModel.findByOwnerAndEmailHash(
      ownerUserId,
      hashLookup(claimantContact),
    )

    if (!entry) {
      return null
    }

    return {
      trustedEntry: entry,
      claimantUser: entry.nominee_user_id ? userModel.findById(entry.nominee_user_id) : null,
      channel: 'email',
      contactValue: String(claimantContact).trim().toLowerCase(),
    }
  }

  const claimantUser = userModel.findByPhone(claimantContact)
  if (!claimantUser) {
    return null
  }

  const trustedEntry = trustedCircleModel
    .listByOwner(ownerUserId)
    .find((entry) => entry.nominee_user_id === claimantUser.id)

  if (!trustedEntry) {
    return null
  }

  return {
    trustedEntry,
    claimantUser,
    channel: 'sms',
    contactValue: String(claimantContact).trim(),
  }
}

function stageForClaim(claim) {
  if (claim.status === 'pending_verification') {
    return 'otp-pending'
  }

  if (claim.submitted_at || claim.status === 'access_granted' || claim.status === 'access_denied') {
    return 'submitted'
  }

  return 'otp-verified'
}

function mapStatus(status) {
  switch (status) {
    case 'pending_verification':
      return 'Pending Verification'
    case 'otp_verified':
      return 'OTP Verified'
    case 'pending':
      return 'Waiting for Other Approvals'
    case 'waiting_for_other_approvals':
      return 'Waiting for Other Approvals'
    case 'access_granted':
      return 'Access Granted'
    case 'access_denied':
      return 'Access Denied'
    default:
      return 'Pending Verification'
  }
}

function claimSummary(claim, options = {}) {
  const approvals = claimApprovalModel.listByClaim(claim.id)
  const approvedCount = approvals.filter((entry) => Boolean(entry.approved_at)).length

  return {
    id: claim.id,
    status: claim.status,
    statusLabel: mapStatus(claim.status),
    claimantName: decryptText(claim.claimant_name_encrypted),
    claimantContact: decryptText(claim.claimant_contact_encrypted),
    demoTimerMinutes: claim.demo_timer_minutes,
    timerExpiresAt: claim.timer_expires_at,
    otpExpiresAt: claim.otp_expires_at,
    otpVerifiedAt: claim.otp_verified_at,
    approvalThreshold: claim.approval_threshold,
    approvalCount: approvedCount,
    submittedAt: claim.submitted_at,
    accessGrantedAt: claim.access_granted_at,
    demoMode: true,
    demoTimerOptionsMinutes: config.claimDemoTimerOptionsMinutes,
    pollIntervalSeconds: config.claimStatusPollSeconds,
    approvals: approvals.map((entry) => ({
      id: entry.id,
      name: decryptText(entry.nominee_name_encrypted),
      email: decryptText(entry.nominee_email_encrypted),
      approvedAt: entry.approved_at,
    })),
    portalToken: options.portalToken,
    accessToken: options.accessToken,
    accessTokenExpiresInMinutes: options.accessToken ? config.claimAccessTokenMinutes : undefined,
    devOtp: options.devOtp,
    devApprovalTokens: options.devApprovalTokens,
  }
}

async function createClaimRequest({
  deceasedIdentifier,
  claimantName,
  claimantContact,
  requestContext,
}) {
  const owner = ownerFromIdentifier(deceasedIdentifier)
  if (!owner) {
    return { ok: false, status: 404, message: 'No LOOM user matches the provided registered email or phone.' }
  }

  const trustedClaimant = resolveTrustedClaimant(owner.id, claimantContact)
  if (!trustedClaimant) {
    auditLogService.logEvent({
      userId: owner.id,
      requestId: requestContext.requestId,
      eventType: 'claim_request_rejected',
      ipAddress: requestContext.ipAddress,
      deviceInfo: requestContext.deviceInfo,
      locationHint: requestContext.locationHint,
      severity: 'warn',
      message: 'Claim request rejected because claimant is not in the trusted circle.',
      metadata: { claimantContact },
    })

    return { ok: false, status: 403, message: 'Claimant is not in the trusted circle for this user.' }
  }

  const circle = trustedCircleService.getTrustedCircleSummary(
    owner.id,
    owner.trusted_circle_threshold,
  )
  const otp = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
  const otpHash = await bcrypt.hash(otp, 10)
  const otpExpiresAt = addSeconds(new Date(), config.claimOtpTtlSeconds).toISOString()
  const claim = claimModel.createClaim({
    ownerUserId: owner.id,
    trustedCircleId: trustedClaimant.trustedEntry.id,
    claimantUserId: trustedClaimant.claimantUser?.id || null,
    claimantNameEncrypted: encryptText(claimantName),
    claimantContactHash: hashLookup(trustedClaimant.contactValue),
    claimantContactEncrypted: encryptText(trustedClaimant.contactValue),
    claimantChannel: trustedClaimant.channel,
    deceasedContactHash: hashLookup(deceasedIdentifier),
    deceasedContactEncrypted: encryptText(deceasedIdentifier),
    otpHash,
    otpExpiresAt,
    otpMaxAttempts: config.claimOtpMaxAttempts,
    approvalThreshold: circle.effectiveThreshold,
  })

  const delivery =
    trustedClaimant.channel === 'sms'
      ? await notificationService.sendOtpSms(trustedClaimant.contactValue, otp, 'claim-access')
      : await notificationService.sendOtpEmail(trustedClaimant.contactValue, otp, 'claim-access')

  auditLogService.logEvent({
    userId: owner.id,
    requestId: requestContext.requestId,
    eventType: 'claim_otp_requested',
    ipAddress: requestContext.ipAddress,
    deviceInfo: requestContext.deviceInfo,
    locationHint: requestContext.locationHint,
    severity: 'info',
    message: 'Trusted claimant requested claim access OTP.',
    metadata: { claimId: claim.id, claimantChannel: trustedClaimant.channel },
  })

  const portalToken = signClaimPortalToken(claim, 'otp-pending')
  return {
    ok: true,
    claim,
    portalToken,
    delivery,
    response: claimSummary(claim, {
      portalToken,
      devOtp: delivery.provider === 'preview' ? delivery.preview?.code : undefined,
    }),
  }
}

async function verifyClaimOtp({ claim, code, requestContext }) {
  if (claim.status === 'access_denied') {
    return { ok: false, status: 403, message: 'This claim is no longer active.' }
  }

  if (claim.otp_verified_at) {
    return { ok: true, claim: claimModel.findById(claim.id) }
  }

  if (!claim.otp_hash || !claim.otp_expires_at || new Date(claim.otp_expires_at) < new Date()) {
    claimModel.updateStatus(claim.id, { status: 'access_denied', accessDeniedAt: nowIso() })
    return { ok: false, status: 401, message: 'OTP expired. Please restart the claim flow.' }
  }

  if (claim.otp_attempts >= claim.otp_max_attempts) {
    claimModel.updateStatus(claim.id, { status: 'access_denied', accessDeniedAt: nowIso() })
    return { ok: false, status: 429, message: 'Maximum OTP attempts exceeded for this claim.' }
  }

  claimModel.incrementOtpAttempts(claim.id)
  const match = await bcrypt.compare(String(code), claim.otp_hash)
  if (!match) {
    const updated = claimModel.findById(claim.id)
    if (updated.otp_attempts >= updated.otp_max_attempts) {
      claimModel.updateStatus(claim.id, { status: 'access_denied', accessDeniedAt: nowIso() })
    }

    auditLogService.logEvent({
      userId: claim.owner_user_id,
      requestId: requestContext.requestId,
      ipAddress: requestContext.ipAddress,
      deviceInfo: requestContext.deviceInfo,
      locationHint: requestContext.locationHint,
      eventType: 'claim_otp_failed',
      severity: 'warn',
      message: 'Claim access OTP verification failed.',
      metadata: { claimId: claim.id },
    })

    return { ok: false, status: 401, message: 'Invalid OTP code.' }
  }

  claimModel.markOtpVerified(claim.id)
  const updatedClaim = claimModel.findById(claim.id)
  auditLogService.logEvent({
    userId: claim.owner_user_id,
    requestId: requestContext.requestId,
    ipAddress: requestContext.ipAddress,
    deviceInfo: requestContext.deviceInfo,
    locationHint: requestContext.locationHint,
    eventType: 'claim_otp_verified',
    severity: 'info',
    message: 'Claim access OTP verified successfully.',
    metadata: { claimId: claim.id },
  })

  return { ok: true, claim: updatedClaim }
}

function storeIdProof(file) {
  const buffer = decodeBase64(file.base64)
  if (buffer.length > config.claimIdProofLimitBytes) {
    throw new Error('ID proof exceeds the maximum allowed size.')
  }

  if (!config.allowedClaimProofTypes.includes(file.mimeType)) {
    throw new Error('Unsupported ID proof file type.')
  }

  const storageKey = `${crypto.randomUUID()}${path.extname(file.name).toLowerCase()}`
  const encryptedFile = encryptBuffer(buffer)
  fs.writeFileSync(path.join(config.claimProofsDir, storageKey), encryptedFile.buffer)

  return {
    idProofNameEncrypted: encryptText(file.name),
    idProofMimeType: file.mimeType,
    idProofStorageKey: storageKey,
    idProofSize: buffer.length,
    idProofCipherMeta: encryptedFile.meta,
  }
}

function createApprovalInvites(claimId, ownerUserId) {
  const nominees = trustedCircleModel.listByOwner(ownerUserId)
  const tokens = []
  const expiresAt = addSeconds(
    new Date(),
    config.claimApprovalTokenHours * 60 * 60,
  ).toISOString()

  for (const nominee of nominees) {
    const token = crypto.randomBytes(18).toString('hex')
    claimApprovalModel.createApprovalInvite({
      claimId,
      trustedCircleId: nominee.id,
      approvalTokenHash: hashApprovalToken(token),
      approvalTokenExpiresAt: expiresAt,
    })

    tokens.push({
      trustedCircleId: nominee.id,
      name: decryptText(nominee.nominee_name_encrypted),
      email: decryptText(nominee.nominee_email_encrypted),
      approvalToken: token,
      expiresAt,
    })
  }

  return tokens
}

function ensureClaimSubmittable(claim) {
  if (!claim.otp_verified_at) {
    throw new Error('Verify OTP before submitting the claim.')
  }

  if (claim.submitted_at) {
    throw new Error('This claim has already been submitted.')
  }
}

function evaluateClaim(claimId, requestContext = null) {
  let claim = claimModel.findById(claimId)
  if (!claim) {
    return null
  }

  const approvedCount = claimApprovalModel.approvedCount(claim.id)
  const timerExpired = Boolean(claim.timer_expires_at) && new Date(claim.timer_expires_at) <= new Date()

  if (claim.status === 'pending' && timerExpired && approvedCount < claim.approval_threshold) {
    claim = claimModel.updateStatus(claim.id, { status: 'waiting_for_other_approvals' })
  }

  if (
    claim.submitted_at &&
    claim.otp_verified_at &&
    timerExpired &&
    approvedCount >= claim.approval_threshold &&
    claim.status !== 'access_granted'
  ) {
    const access = issueClaimAccessToken(claim, nowIso())
    claim = access.claim

    auditLogService.logEvent({
      userId: claim.owner_user_id,
      requestId: requestContext?.requestId,
      ipAddress: requestContext?.ipAddress,
      deviceInfo: requestContext?.deviceInfo,
      locationHint: requestContext?.locationHint,
      eventType: 'claim_access_granted',
      severity: 'critical',
      message: 'Claim access granted after OTP, timer expiry, and trusted circle consensus.',
      metadata: { claimId: claim.id, approvedCount, approvalThreshold: claim.approval_threshold },
    })

    return { claim, accessToken: access.token }
  }

  return { claim }
}

function issueClaimAccessToken(claim, grantedAt = null) {
  const access = signClaimAccessToken(
    claim,
    assetModel.listByUser(claim.owner_user_id).map((asset) => asset.id),
  )
  const updatedClaim = claimModel.updateStatus(claim.id, {
    status: 'access_granted',
    accessTokenJti: access.jti,
    accessGrantedAt: grantedAt || claim.access_granted_at || nowIso(),
  })

  return {
    claim: updatedClaim,
    accessToken: access.token,
  }
}

function claimReadOnlyAssets(ownerUserId) {
  return assetModel.listByUser(ownerUserId).map((asset) => ({
    id: asset.id,
    title: asset.title,
    type: asset.type,
    details: decryptText(asset.encrypted_details),
    financialData: asset.encrypted_financial_data ? decryptText(asset.encrypted_financial_data) : null,
    hasFile: Boolean(asset.file_storage_key),
    updatedAt: asset.updated_at,
  }))
}

module.exports = {
  claimSummary,
  createClaimRequest,
  verifyClaimOtp,
  evaluateClaim,
  issueClaimAccessToken,
  ensureClaimSubmittable,
  storeIdProof,
  createApprovalInvites,
  claimReadOnlyAssets,
  stageForClaim,
}

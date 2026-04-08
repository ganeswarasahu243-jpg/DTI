const { z } = require('zod')
const claimApprovalModel = require('../models/claimApprovalModel.cjs')
const claimModel = require('../models/claimModel.cjs')
const auditLogService = require('../services/auditLogService.cjs')
const { verifyClaimToken, signClaimPortalToken } = require('../services/claimAccessService.cjs')
const {
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
} = require('../services/claimService.cjs')
const { getRequestContext } = require('../services/requestContextService.cjs')
const { config } = require('../config/env.cjs')
const crypto = require('crypto')

const requestSchema = z.object({
  deceasedIdentifier: z.string().trim().min(3).max(160),
  claimantName: z.string().trim().min(2).max(80),
  claimantContact: z.string().trim().min(3).max(160),
})

const verifyOtpSchema = z.object({
  portalToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
})

const submitSchema = z.object({
  portalToken: z.string().min(1),
  timerMinutes: z.number().int(),
  idProof: z.object({
    name: z.string().trim().min(1).max(255),
    mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
    base64: z.string().min(1),
  }),
})

const statusSchema = z.object({
  portalToken: z.string().min(1),
})

const approveSchema = z.object({
  claimId: z.string().uuid(),
  approvalToken: z.string().min(12),
})

function readPortalClaim(portalToken) {
  const payload = verifyClaimToken(portalToken, 'claim-portal')
  const claim = claimModel.findById(payload.claimId)
  if (!claim) {
    throw new Error('Claim not found.')
  }

  return { payload, claim }
}

async function requestOtp(req, res) {
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid claim request payload.', issues: parsed.error.flatten() })
  }

  const requestContext = getRequestContext(req)
  const response = await createClaimRequest({
    deceasedIdentifier: parsed.data.deceasedIdentifier,
    claimantName: parsed.data.claimantName,
    claimantContact: parsed.data.claimantContact,
    requestContext,
  })

  if (!response.ok) {
    return res.status(response.status).json({ message: response.message })
  }

  return res.status(201).json(response.response)
}

async function verifyOtp(req, res) {
  const parsed = verifyOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid claim OTP payload.', issues: parsed.error.flatten() })
  }

  let current
  try {
    current = readPortalClaim(parsed.data.portalToken)
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired claim portal token.' })
  }

  const requestContext = getRequestContext(req)
  const verification = await verifyClaimOtp({
    claim: current.claim,
    code: parsed.data.code,
    requestContext,
  })

  if (!verification.ok) {
    return res.status(verification.status).json({ message: verification.message })
  }

  const updatedClaim = verification.claim
  const portalToken = signClaimPortalToken(updatedClaim, stageForClaim(updatedClaim))
  return res.json(claimSummary(updatedClaim, { portalToken }))
}

function submitClaim(req, res) {
  const parsed = submitSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid claim submit payload.', issues: parsed.error.flatten() })
  }

  if (!config.claimDemoTimerOptionsMinutes.includes(parsed.data.timerMinutes)) {
    return res.status(400).json({
      message: `Timer must be one of: ${config.claimDemoTimerOptionsMinutes.join(', ')} minutes.`,
    })
  }

  let current
  try {
    current = readPortalClaim(parsed.data.portalToken)
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired claim portal token.' })
  }

  try {
    ensureClaimSubmittable(current.claim)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }

  let proofPayload
  try {
    proofPayload = storeIdProof(parsed.data.idProof)
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }

  const timerExpiresAt = new Date(Date.now() + parsed.data.timerMinutes * 60 * 1000).toISOString()
  const submittedClaim = claimModel.submitClaim(current.claim.id, {
    ...proofPayload,
    demoTimerMinutes: parsed.data.timerMinutes,
    timerExpiresAt,
    status: 'pending',
  })
  const devApprovalTokens = createApprovalInvites(submittedClaim.id, submittedClaim.owner_user_id)
  const portalToken = signClaimPortalToken(submittedClaim, stageForClaim(submittedClaim))
  const requestContext = getRequestContext(req)

  auditLogService.logEvent({
    userId: submittedClaim.owner_user_id,
    requestId: requestContext.requestId,
    ipAddress: requestContext.ipAddress,
    deviceInfo: requestContext.deviceInfo,
    locationHint: requestContext.locationHint,
    eventType: 'claim_submitted',
    severity: 'warn',
    message: 'A claim access request was submitted with ID proof.',
    metadata: { claimId: submittedClaim.id, timerMinutes: parsed.data.timerMinutes },
  })

  return res.status(201).json(claimSummary(submittedClaim, {
    portalToken,
    devApprovalTokens: config.env === 'development' ? devApprovalTokens : undefined,
  }))
}

function status(req, res) {
  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid claim status payload.', issues: parsed.error.flatten() })
  }

  let current
  try {
    current = readPortalClaim(parsed.data.portalToken)
  } catch (_error) {
    return res.status(401).json({ message: 'Invalid or expired claim portal token.' })
  }

  const evaluated = evaluateClaim(current.claim.id, getRequestContext(req))
  if (!evaluated) {
    return res.status(404).json({ message: 'Claim not found.' })
  }

  const access = evaluated.claim.status === 'access_granted' && !evaluated.accessToken
    ? issueClaimAccessToken(evaluated.claim)
    : null
  const responseClaim = access?.claim || evaluated.claim
  const portalToken = signClaimPortalToken(responseClaim, stageForClaim(responseClaim))
  return res.json(claimSummary(responseClaim, {
    portalToken,
    accessToken: access?.accessToken || evaluated.accessToken,
  }))
}

function approve(req, res) {
  const parsed = approveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid claim approval payload.', issues: parsed.error.flatten() })
  }

  const claim = claimModel.findById(parsed.data.claimId)
  if (!claim) {
    return res.status(404).json({ message: 'Claim not found.' })
  }

  if (!claim.submitted_at || claim.status === 'access_denied') {
    return res.status(409).json({ message: 'This claim is not open for approval.' })
  }

  const tokenHash = crypto.createHash('sha256').update(parsed.data.approvalToken).digest('hex')
  const approvedRecord = claimApprovalModel.findByClaimAndTokenHash(claim.id, tokenHash)
  if (!approvedRecord) {
    return res.status(403).json({ message: 'Invalid approval token.' })
  }

  if (approvedRecord.approved_at) {
    return res.status(409).json({ message: 'This trusted member has already approved the claim.' })
  }

  if (new Date(approvedRecord.approval_token_expires_at) < new Date()) {
    return res.status(403).json({ message: 'Approval token expired.' })
  }

  claimApprovalModel.approve(approvedRecord.id, approvedRecord.nominee_user_id || null)
  const requestContext = getRequestContext(req)
  auditLogService.logEvent({
    userId: claim.owner_user_id,
    requestId: requestContext.requestId,
    ipAddress: requestContext.ipAddress,
    deviceInfo: requestContext.deviceInfo,
    locationHint: requestContext.locationHint,
    eventType: 'claim_approved',
    severity: 'warn',
    message: 'A trusted circle member approved a claim access request.',
    metadata: { claimId: claim.id, trustedCircleId: approvedRecord.trusted_circle_id },
  })

  const evaluated = evaluateClaim(claim.id, requestContext)
  return res.json({
    claimId: claim.id,
    status: evaluated.claim.status,
    statusLabel: claimSummary(evaluated.claim).statusLabel,
    approvalCount: claimApprovalModel.approvedCount(claim.id),
    approvalThreshold: claim.approval_threshold,
  })
}

function accessAssets(req, res) {
  auditLogService.logEvent({
    userId: req.claimRecord.owner_user_id,
    requestId: req.requestId,
    ipAddress: req.headers['x-forwarded-for'] || req.ip,
    deviceInfo: req.headers['user-agent'] || 'unknown-device',
    locationHint: req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'unknown',
    eventType: 'claim_assets_viewed',
    severity: 'warn',
    message: 'Claim portal accessed read-only inherited assets.',
    metadata: { claimId: req.claimRecord.id },
  })

  return res.json({
    claimId: req.claimRecord.id,
    ownerUserId: req.claimRecord.owner_user_id,
    readOnly: true,
    assets: claimReadOnlyAssets(req.claimRecord.owner_user_id),
  })
}

module.exports = {
  requestOtp,
  verifyOtp,
  submitClaim,
  status,
  approve,
  accessAssets,
}

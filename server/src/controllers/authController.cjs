const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const userModel = require('../models/userModel.cjs')
const otpModel = require('../models/otpModel.cjs')
const auditLogService = require('../services/auditLogService.cjs')
const otpService = require('../services/otpService.cjs')
const fraudDetectionService = require('../services/fraudDetectionService.cjs')
const { encryptText, decryptText, hashLookup } = require('../services/encryptionService.cjs')
const { getRequestContext } = require('../services/requestContextService.cjs')
const { config } = require('../config/env.cjs')
const { nowIso } = require('../utils/time.cjs')

const signupSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  role: z.enum(['user', 'nominee']).default('user'),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  preferredOtpChannel: z.enum(['email', 'sms']).default('email'),
  inactivityTimerDays: z.number().int().optional(),
})

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
})

const otpVerifySchema = z.object({
  pendingToken: z.string().min(1),
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
})

const challengeSchema = z.object({
  purpose: z.enum(['asset-access', 'nominee-change', 'release-trigger', 'file-access', 'transfer']),
})

const totpEnableSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
})

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.union([z.string().trim().regex(/^\+?[1-9]\d{7,14}$/), z.literal(''), z.null()]).optional(),
  preferredOtpChannel: z.enum(['email', 'sms']).default('email'),
})

function getUserEmail(user) {
  return user.email || decryptText(user.email_encrypted)
}

function isDevelopmentDemoUser(user) {
  return config.env === 'development' && getUserEmail(user).endsWith('@loom-demo.local')
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email || decryptText(user.email_encrypted),
    name: user.name || decryptText(user.name_encrypted),
    phone: user.phone || (user.phone_encrypted ? decryptText(user.phone_encrypted) : null),
    role: user.role,
    flaggedAt: user.flagged_at,
    flaggedReason: user.flagged_reason,
    lockedUntil: user.locked_until || null,
    emailVerifiedAt: user.email_verified_at || null,
    riskScore: user.risk_score || 0,
    mfa: {
      email: Boolean(user.mfa_email_enabled),
      totp: Boolean(user.mfa_totp_enabled),
    },
    preferredOtpChannel: user.preferred_otp_channel || 'email',
    trustedCircleThreshold: user.trusted_circle_threshold,
    inactivityTimerDays: user.inactivity_timer_days,
  }
}

function signAccessToken(user, mfaVerifiedAt = nowIso()) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email || decryptText(user.email_encrypted),
      role: user.role,
      name: user.name || decryptText(user.name_encrypted),
      mfaVerifiedAt,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  )
}

function signPendingToken(userId, purpose) {
  return jwt.sign(
    { sub: userId, stage: 'mfa-pending', purpose },
    config.jwtSecret,
    { expiresIn: `${config.pendingTokenExpiresInMinutes}m` },
  )
}

async function issueMfaChallenge(user, purpose, context) {
  const channel = otpService.resolvePreferredOtpChannel(user)
  const { challenge, delivery } = await otpService.createChallenge({
    user,
    purpose,
    channel,
    metadata: {
      ipAddress: context.ipAddress,
      deviceFingerprint: context.deviceFingerprint,
      locationHint: context.locationHint,
    },
  })

  return {
    requiresMfa: true,
    purpose,
    challengeId: challenge.id,
    channel,
    pendingToken: signPendingToken(user.id, purpose),
    expiresAt: challenge.expires_at,
    devOtp: delivery.provider === 'preview' && delivery.preview ? delivery.preview.code : undefined,
  }
}

async function issueEmailVerificationChallenge(user, context) {
  const { challenge, delivery } = await otpService.createChallenge({
    user,
    purpose: 'email-verification',
    channel: 'email',
    metadata: {
      ipAddress: context.ipAddress,
      deviceFingerprint: context.deviceFingerprint,
      locationHint: context.locationHint,
    },
  })

  userModel.markVerificationSent(user.id)

  return {
    requiresEmailVerification: true,
    purpose: 'email-verification',
    challengeId: challenge.id,
    channel: 'email',
    pendingToken: signPendingToken(user.id, 'email-verification'),
    expiresAt: challenge.expires_at,
    devOtp: delivery.provider === 'preview' && delivery.preview ? delivery.preview.code : undefined,
  }
}

async function signup(req, res) {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid signup payload.', issues: parsed.error.flatten() })
  }

  if (
    parsed.data.preferredOtpChannel === 'sms' &&
    !parsed.data.phone
  ) {
    return res.status(400).json({ message: 'A phone number is required to enable SMS OTP delivery.' })
  }

  if (
    parsed.data.inactivityTimerDays != null &&
    !config.inactivityTimerOptionsDays.includes(parsed.data.inactivityTimerDays)
  ) {
    return res.status(400).json({
      message: `Inactivity timer must be one of: ${config.inactivityTimerOptionsDays.join(', ')} days.`,
    })
  }

  const existing = userModel.findByEmail(parsed.data.email)
  if (existing) {
    return res.status(409).json({ message: 'An account with that email already exists.' })
  }

  if (parsed.data.phone && userModel.findByPhone(parsed.data.phone)) {
    return res.status(409).json({ message: 'An account with that phone number already exists.' })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = userModel.createUser({
    emailEncrypted: encryptText(parsed.data.email),
    emailHash: hashLookup(parsed.data.email),
    nameEncrypted: encryptText(parsed.data.name),
    phoneEncrypted: parsed.data.phone ? encryptText(parsed.data.phone) : null,
    phoneHash: parsed.data.phone ? hashLookup(parsed.data.phone) : null,
    passwordHash,
    role: parsed.data.role,
    preferredOtpChannel: parsed.data.preferredOtpChannel,
    inactivityTimerDays: parsed.data.inactivityTimerDays || config.inactivityThresholdDays,
  })

  const hydratedUser = {
    ...user,
    email: parsed.data.email,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
  }
  const context = getRequestContext(req)
  auditLogService.logEvent({
    userId: user.id,
    requestId: context.requestId,
    eventType: 'user_registered',
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
    locationHint: context.locationHint,
    severity: 'info',
    message: 'User account registered.',
  })

  return res.status(201).json(await issueEmailVerificationChallenge(hydratedUser, context))
}

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid login payload.', issues: parsed.error.flatten() })
  }

  const user = userModel.findByEmail(parsed.data.email)
  const context = getRequestContext(req)

  if (!user) {
    auditLogService.logEvent({
      requestId: context.requestId,
      eventType: 'login_failed',
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      locationHint: context.locationHint,
      severity: 'warn',
      message: 'Login failed for unknown email.',
      metadata: { email: parsed.data.email },
    })
    return res.status(401).json({ message: 'Invalid email or password.' })
  }

  if (!isDevelopmentDemoUser(user) && user.locked_until && new Date(user.locked_until) > new Date()) {
    auditLogService.logEvent({
      userId: user.id,
      requestId: context.requestId,
      eventType: 'login_blocked_locked',
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      locationHint: context.locationHint,
      severity: 'warn',
      message: 'Login blocked because account is temporarily locked.',
      metadata: { lockedUntil: user.locked_until },
    })
    return res.status(423).json({ message: 'Account is temporarily locked. Please try again later.' })
  }

  const passwordMatch = await bcrypt.compare(parsed.data.password, user.password_hash)
  if (!passwordMatch) {
    const failedAttempts = user.failed_login_attempts + 1
    const shouldLock = !isDevelopmentDemoUser(user) && failedAttempts >= config.failedLoginLockThreshold
    const lockedUntil = shouldLock
      ? new Date(Date.now() + config.failedLoginLockMinutes * 60 * 1000).toISOString()
      : null

    userModel.updateRiskState(user.id, {
      failedLoginAttempts: failedAttempts,
      riskScore: Math.max(user.risk_score || 0, failedAttempts * 10),
      reason: shouldLock ? 'too_many_failed_login_attempts' : 'invalid_password',
      lockedUntil,
    })

    auditLogService.logEvent({
      userId: user.id,
      requestId: context.requestId,
      eventType: 'login_failed',
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      locationHint: context.locationHint,
      severity: 'warn',
      message: 'Login failed due to invalid password.',
      metadata: { failedAttempts, lockedUntil },
    })
    return res.status(401).json({ message: 'Invalid email or password.' })
  }

  if (!user.email_verified_at) {
    return res.json(await issueEmailVerificationChallenge(user, context))
  }

  const risk = isDevelopmentDemoUser(user)
    ? { shouldLock: false }
    : fraudDetectionService.detectLoginRisk(user, context)
  if (risk.shouldLock) {
    return res.status(423).json({
      message: 'Login was blocked because the activity looks suspicious. Please retry later or contact support.',
    })
  }

  if (isDevelopmentDemoUser(user)) {
    userModel.resetFailedAttempts(user.id)
    auditLogService.logEvent({
      userId: user.id,
      requestId: context.requestId,
      eventType: 'login_success',
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      locationHint: context.locationHint,
      severity: 'info',
      message: 'Demo user completed login without MFA.',
    })

    return res.json({
      token: signAccessToken(user),
      user: publicUser(user),
    })
  }

  return res.json(await issueMfaChallenge(user, 'login', context))
}

async function verifyLogin(req, res) {
  const parsed = otpVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid OTP verification payload.', issues: parsed.error.flatten() })
  }

  let pending
  try {
    pending = jwt.verify(parsed.data.pendingToken, config.jwtSecret)
  } catch (error) {
    return res.status(401).json({ message: 'Pending MFA token expired or invalid.' })
  }

  if (pending.stage !== 'mfa-pending' || pending.purpose !== 'login') {
    return res.status(400).json({ message: 'Invalid MFA verification context.' })
  }

  const user = userModel.findById(pending.sub)
  const challenge = otpModel.findById(parsed.data.challengeId)
  if (!user || !challenge || challenge.user_id !== user.id) {
    return res.status(404).json({ message: 'OTP challenge not found.' })
  }

  const verification = await otpService.verifyChallenge({
    challenge,
    user,
    code: parsed.data.code,
  })

  if (!verification.ok) {
    const context = getRequestContext(req)
    auditLogService.logEvent({
      userId: user.id,
      requestId: context.requestId,
      eventType: 'mfa_verification_failed',
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      locationHint: context.locationHint,
      severity: 'warn',
      message: verification.reason,
      metadata: { challengeId: challenge.id },
    })
    return res.status(401).json({ message: verification.reason })
  }

  userModel.resetFailedAttempts(user.id)
  const updatedUser = userModel.findById(user.id)
  const context = getRequestContext(req)
  auditLogService.logEvent({
    userId: user.id,
    requestId: context.requestId,
    eventType: 'login_success',
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
    locationHint: context.locationHint,
    severity: 'info',
    message: 'User completed MFA login.',
    metadata: { deviceFingerprint: context.deviceFingerprint },
  })

  return res.json({
    token: signAccessToken(updatedUser),
    user: publicUser(updatedUser),
  })
}

async function verifyEmail(req, res) {
  const parsed = otpVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid email verification payload.', issues: parsed.error.flatten() })
  }

  let pending
  try {
    pending = jwt.verify(parsed.data.pendingToken, config.jwtSecret)
  } catch (_error) {
    return res.status(401).json({ message: 'Pending verification token expired or invalid.' })
  }

  if (pending.stage !== 'mfa-pending' || pending.purpose !== 'email-verification') {
    return res.status(400).json({ message: 'Invalid email verification context.' })
  }

  const user = userModel.findById(pending.sub)
  const challenge = otpModel.findById(parsed.data.challengeId)
  if (!user || !challenge || challenge.user_id !== user.id) {
    return res.status(404).json({ message: 'Email verification challenge not found.' })
  }

  const verification = await otpService.verifyChallenge({
    challenge,
    user,
    code: parsed.data.code,
  })

  if (!verification.ok) {
    return res.status(401).json({ message: verification.reason })
  }

  userModel.markEmailVerified(user.id)
  const verifiedUser = userModel.findById(user.id)
  const context = getRequestContext(req)
  auditLogService.logEvent({
    userId: user.id,
    requestId: context.requestId,
    eventType: 'email_verified',
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
    locationHint: context.locationHint,
    severity: 'info',
    message: 'User verified their email address.',
  })

  return res.json({
    token: signAccessToken(verifiedUser),
    user: publicUser(verifiedUser),
  })
}

async function createActionChallenge(req, res) {
  const parsed = challengeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid MFA challenge payload.', issues: parsed.error.flatten() })
  }

  const context = getRequestContext(req)
  const response = await issueMfaChallenge(req.currentUser, parsed.data.purpose, context)
  auditLogService.logEvent({
    userId: req.currentUser.id,
    requestId: context.requestId,
    eventType: 'mfa_action_challenge_created',
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
    locationHint: context.locationHint,
    severity: 'info',
    message: 'Step-up MFA challenge created for a sensitive action.',
    metadata: { purpose: parsed.data.purpose, challengeId: response.challengeId, channel: response.channel },
  })
  return res.json(response)
}

async function verifyActionChallenge(req, res) {
  const parsed = z.object({
    challengeId: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/),
  }).safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid MFA verification payload.', issues: parsed.error.flatten() })
  }

  const challenge = otpModel.findById(parsed.data.challengeId)
  if (!challenge || challenge.user_id !== req.currentUser.id) {
    return res.status(404).json({ message: 'OTP challenge not found.' })
  }

  const verification = await otpService.verifyChallenge({
    challenge,
    user: req.currentUser,
    code: parsed.data.code,
  })

  if (!verification.ok) {
    return res.status(401).json({ message: verification.reason })
  }

  auditLogService.logEvent({
    userId: req.currentUser.id,
    requestId: req.requestId,
    eventType: 'mfa_action_challenge_verified',
    severity: 'info',
    message: 'Step-up MFA challenge verified for a sensitive action.',
    metadata: { challengeId: challenge.id },
  })

  return res.json({
    token: signAccessToken(req.currentUser, nowIso()),
    user: publicUser(userModel.findById(req.currentUser.id)),
  })
}

function me(req, res) {
  return res.json({ user: publicUser(req.currentUser) })
}

function updateProfile(req, res) {
  const parsed = profileUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid profile update payload.', issues: parsed.error.flatten() })
  }

  const phone = typeof parsed.data.phone === 'string' ? parsed.data.phone.trim() : ''
  const normalizedPhone = phone || null

  if (parsed.data.preferredOtpChannel === 'sms' && !normalizedPhone) {
    return res.status(400).json({ message: 'A phone number is required to enable SMS OTP delivery.' })
  }

  if (normalizedPhone) {
    const existingPhoneUser = userModel.findByPhone(normalizedPhone)
    if (existingPhoneUser && existingPhoneUser.id !== req.currentUser.id) {
      return res.status(409).json({ message: 'An account with that phone number already exists.' })
    }
  }

  const updatedUser = userModel.updateProfile(req.currentUser.id, {
    nameEncrypted: encryptText(parsed.data.name),
    phoneHash: normalizedPhone ? hashLookup(normalizedPhone) : null,
    phoneEncrypted: normalizedPhone ? encryptText(normalizedPhone) : null,
    preferredOtpChannel: parsed.data.preferredOtpChannel,
  })

  auditLogService.logEvent({
    userId: req.currentUser.id,
    requestId: req.requestId,
    eventType: 'profile_updated',
    severity: 'info',
    message: 'Account profile details were updated.',
    metadata: {
      preferredOtpChannel: parsed.data.preferredOtpChannel,
      phoneUpdated: Boolean(normalizedPhone),
    },
  })

  return res.json({ user: publicUser(updatedUser) })
}

function startTotpSetup(req, res) {
  const enrollment = otpService.createTotpEnrollment(req.currentUser.email)
  userModel.saveTotpSecret(req.currentUser.id, encryptText(enrollment.secret), false)
  auditLogService.logEvent({
    userId: req.currentUser.id,
    requestId: req.requestId,
    eventType: 'mfa_totp_setup_started',
    severity: 'info',
    message: 'Authenticator MFA setup started.',
  })
  return res.json({
    secret: enrollment.secret,
    otpAuthUrl: enrollment.otpAuthUrl,
  })
}

function enableTotp(req, res) {
  const parsed = totpEnableSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid TOTP payload.', issues: parsed.error.flatten() })
  }

  const refreshedUser = userModel.findById(req.currentUser.id)
  if (!refreshedUser?.totp_secret_encrypted) {
    return res.status(400).json({ message: 'TOTP setup has not been started.' })
  }

  const secret = decryptText(refreshedUser.totp_secret_encrypted)
  const verified = require('../services/totpService.cjs').verifyTotp(secret, parsed.data.code)
  if (!verified) {
    return res.status(401).json({ message: 'Invalid authenticator code.' })
  }

  userModel.saveTotpSecret(req.currentUser.id, refreshedUser.totp_secret_encrypted, true)
  auditLogService.logEvent({
    userId: req.currentUser.id,
    requestId: req.requestId,
    eventType: 'mfa_totp_enabled',
    severity: 'info',
    message: 'Authenticator MFA enabled.',
  })

  const updated = userModel.findById(req.currentUser.id)
  return res.json({ user: publicUser(updated) })
}

module.exports = {
  signup,
  login,
  verifyLogin,
  verifyEmail,
  createActionChallenge,
  verifyActionChallenge,
  me,
  updateProfile,
  startTotpSetup,
  enableTotp,
}

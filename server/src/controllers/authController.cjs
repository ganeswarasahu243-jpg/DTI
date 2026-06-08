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
  role: z.enum(['user']).default('user'),
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

const sendOtpSchema = z.discriminatedUnion('flow', [
  signupSchema.extend({
    flow: z.literal('signup'),
  }),
  loginSchema.extend({
    flow: z.literal('login'),
  }),
])

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

function otpDeliveryFailureResponse(error) {
  if (error) {
    console.error('[otp-delivery-failure]', {
      message: error?.message,
      code: error?.code,
      responseCode: error?.responseCode,
    })
  }

  const details = config.env === 'development' && error?.message
    ? ` (${error.message})`
    : ''

  return {
    statusCode: 502,
    body: {
      message: `Unable to send OTP email right now. Please check email configuration and try again.${details}`,
    },
  }
}

async function issueMfaChallenge(user, purpose, context, options = {}) {
  const channel = options.channel || otpService.resolvePreferredOtpChannel(user)
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
    devOtpCode:
      config.env === 'development' && delivery?.provider === 'preview'
        ? String(delivery.preview?.code || '')
        : undefined,
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
    devOtpCode:
      config.env === 'development' && delivery?.provider === 'preview'
        ? String(delivery.preview?.code || '')
        : undefined,
  }
}

async function createSignupChallenge(payload, req) {
  if (
    payload.preferredOtpChannel === 'sms' &&
    !payload.phone
  ) {
    return { statusCode: 400, body: { message: 'A phone number is required to enable SMS OTP delivery.' } }
  }

  if (
    payload.inactivityTimerDays != null &&
    !config.inactivityTimerOptionsDays.includes(payload.inactivityTimerDays)
  ) {
    return {
      statusCode: 400,
      body: {
        message: `Inactivity timer must be one of: ${config.inactivityTimerOptionsDays.join(', ')} days.`,
      },
    }
  }

  const existing = userModel.findByEmail(payload.email)
  if (existing) {
    return { statusCode: 409, body: { message: 'An account with that email already exists.' } }
  }

  if (payload.phone && userModel.findByPhone(payload.phone)) {
    return { statusCode: 409, body: { message: 'An account with that phone number already exists.' } }
  }

  const passwordHash = await bcrypt.hash(payload.password, 12)
  const user = userModel.createUser({
    emailEncrypted: encryptText(payload.email),
    emailHash: hashLookup(payload.email),
    nameEncrypted: encryptText(payload.name),
    phoneEncrypted: payload.phone ? encryptText(payload.phone) : null,
    phoneHash: payload.phone ? hashLookup(payload.phone) : null,
    passwordHash,
    role: payload.role,
    preferredOtpChannel: payload.preferredOtpChannel,
    inactivityTimerDays: payload.inactivityTimerDays || config.inactivityThresholdDays,
  })

  const hydratedUser = {
    ...user,
    email: payload.email,
    name: payload.name,
    phone: payload.phone || null,
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

  try {
    return {
      statusCode: 201,
      body: await issueEmailVerificationChallenge(hydratedUser, context),
    }
  } catch (error) {
    return otpDeliveryFailureResponse(error)
  }
}

async function createLoginChallenge(payload, req, options = {}) {
  const forceOtp = Boolean(options.forceOtp)
  const user = userModel.findByEmail(payload.email)
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
      metadata: { email: payload.email },
    })
    return { statusCode: 401, body: { message: 'Invalid email or password.' } }
  }

  if (user.role === 'nominee') {
    return { statusCode: 403, body: { message: 'Nominee account access has been disabled.' } }
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
    return { statusCode: 423, body: { message: 'Account is temporarily locked. Please try again later.' } }
  }

  const passwordMatch = await bcrypt.compare(payload.password, user.password_hash)
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
    return { statusCode: 401, body: { message: 'Invalid email or password.' } }
  }

  if (!user.email_verified_at) {
    try {
      return {
        statusCode: 200,
        body: await issueEmailVerificationChallenge(user, context),
      }
    } catch (error) {
      return otpDeliveryFailureResponse(error)
    }
  }

  const risk = isDevelopmentDemoUser(user)
    ? { shouldLock: false }
    : fraudDetectionService.detectLoginRisk(user, context)
  if (risk.shouldLock) {
    return {
      statusCode: 423,
      body: {
        message: 'Login was blocked because the activity looks suspicious. Please retry later or contact support.',
      },
    }
  }

  if (isDevelopmentDemoUser(user) && !forceOtp) {
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

    return {
      statusCode: 200,
      body: {
        token: signAccessToken(user),
        user: publicUser(user),
      },
    }
  }

  try {
    return {
      statusCode: 200,
      body: await issueMfaChallenge(user, 'login', context, { channel: 'email' }),
    }
  } catch (error) {
    return otpDeliveryFailureResponse(error)
  }
}

async function finalizeOtpVerification(payload, req, expectedPurpose = null) {
  let pending
  try {
    pending = jwt.verify(payload.pendingToken, config.jwtSecret)
  } catch (_error) {
    return { statusCode: 401, body: { message: 'Pending verification token expired or invalid.' } }
  }

  if (pending.stage !== 'mfa-pending') {
    return { statusCode: 400, body: { message: 'Invalid verification context.' } }
  }

  if (expectedPurpose && pending.purpose !== expectedPurpose) {
    return { statusCode: 400, body: { message: 'Invalid verification context.' } }
  }

  if (!['login', 'email-verification'].includes(pending.purpose)) {
    return { statusCode: 400, body: { message: 'OTP verification is not available for this flow.' } }
  }

  const user = userModel.findById(pending.sub)
  const challenge = otpModel.findById(payload.challengeId)
  if (!user || !challenge || challenge.user_id !== user.id) {
    return { statusCode: 404, body: { message: 'OTP challenge not found.' } }
  }

  const verification = await otpService.verifyChallenge({
    challenge,
    user,
    code: payload.code,
  })

  const context = getRequestContext(req)
  if (!verification.ok) {
    auditLogService.logEvent({
      userId: user.id,
      requestId: context.requestId,
      eventType: pending.purpose === 'login' ? 'mfa_verification_failed' : 'email_verification_failed',
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      locationHint: context.locationHint,
      severity: 'warn',
      message: verification.reason,
      metadata: { challengeId: challenge.id, purpose: pending.purpose },
    })
    return { statusCode: 401, body: { message: verification.reason } }
  }

  if (pending.purpose === 'login') {
    userModel.resetFailedAttempts(user.id)
    const updatedUser = userModel.findById(user.id)
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

    return {
      statusCode: 200,
      body: {
        token: signAccessToken(updatedUser),
        user: publicUser(updatedUser),
      },
    }
  }

  userModel.markEmailVerified(user.id)
  const verifiedUser = userModel.findById(user.id)
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

  return {
    statusCode: 200,
    body: {
      token: signAccessToken(verifiedUser),
      user: publicUser(verifiedUser),
    },
  }
}

async function signup(req, res) {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid signup payload.', issues: parsed.error.flatten() })
  }

  const result = await createSignupChallenge(parsed.data, req)
  return res.status(result.statusCode).json(result.body)
}

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid login payload.', issues: parsed.error.flatten() })
  }

  const result = await createLoginChallenge(parsed.data, req)
  return res.status(result.statusCode).json(result.body)
}

async function sendOtp(req, res) {
  const parsed = sendOtpSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid send OTP payload.', issues: parsed.error.flatten() })
  }

  if (parsed.data.flow === 'signup') {
    const result = await createSignupChallenge(parsed.data, req)
    const statusCode = result.statusCode === 201 ? 200 : result.statusCode
    return res.status(statusCode).json(result.body)
  }

  const result = await createLoginChallenge(parsed.data, req, { forceOtp: true })
  return res.status(result.statusCode).json(result.body)
}

async function verifyLogin(req, res) {
  const parsed = otpVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid OTP verification payload.', issues: parsed.error.flatten() })
  }

  const result = await finalizeOtpVerification(parsed.data, req, 'login')
  return res.status(result.statusCode).json(result.body)
}

async function verifyEmail(req, res) {
  const parsed = otpVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid email verification payload.', issues: parsed.error.flatten() })
  }

  const result = await finalizeOtpVerification(parsed.data, req, 'email-verification')
  return res.status(result.statusCode).json(result.body)
}

async function verifyOtp(req, res) {
  const parsed = otpVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid OTP verification payload.', issues: parsed.error.flatten() })
  }

  const result = await finalizeOtpVerification(parsed.data, req)
  return res.status(result.statusCode).json(result.body)
}

async function createActionChallenge(req, res) {
  const parsed = challengeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid MFA challenge payload.', issues: parsed.error.flatten() })
  }

  const context = getRequestContext(req)
  let response
  try {
    response = await issueMfaChallenge(req.currentUser, parsed.data.purpose, context)
  } catch (error) {
    const deliveryFailure = otpDeliveryFailureResponse(error)
    return res.status(deliveryFailure.statusCode).json(deliveryFailure.body)
  }
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
  sendOtp,
  verifyOtp,
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

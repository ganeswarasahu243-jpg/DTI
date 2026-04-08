const bcrypt = require('bcryptjs')
const otpModel = require('../models/otpModel.cjs')
const { config } = require('../config/env.cjs')
const { addSeconds } = require('../utils/time.cjs')
const { decryptText } = require('./encryptionService.cjs')
const { generateSecret, verifyTotp, buildOtpAuthUrl } = require('./totpService.cjs')
const notificationService = require('./notificationService.cjs')

function generateEmailOtp() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
}

async function createChallenge({ user, purpose, channel, metadata = {} }) {
  const ttlSeconds = purpose === 'email-verification' ? config.emailVerificationTtlSeconds : config.otpTtlSeconds
  const expiresAt = addSeconds(new Date(), ttlSeconds).toISOString()

  if (channel === 'totp') {
    const challenge = otpModel.createChallenge({
      userId: user.id,
      purpose,
      channel,
      otpHash: null,
      expiresAt,
      maxAttempts: config.otpMaxAttempts,
      metadata,
    })

    return { challenge, delivery: { channel: 'totp', delivered: true } }
  }

  const otp = generateEmailOtp()
  const otpHash = await bcrypt.hash(otp, 10)
  const challenge = otpModel.createChallenge({
    userId: user.id,
    purpose,
    channel,
    otpHash,
    expiresAt,
    maxAttempts: config.otpMaxAttempts,
    metadata,
  })

  const delivery = channel === 'sms'
    ? await notificationService.sendOtpSms(decryptText(user.phone_encrypted), otp, purpose)
    : await notificationService.sendOtpEmail(decryptText(user.email_encrypted), otp, purpose)

  return { challenge, delivery }
}

async function verifyChallenge({ challenge, user, code }) {
  if (!challenge || challenge.consumed_at) {
    return { ok: false, reason: 'OTP challenge not found.' }
  }

  if (new Date(challenge.expires_at) < new Date()) {
    return { ok: false, reason: 'OTP challenge expired.' }
  }

  if (challenge.attempts >= challenge.max_attempts) {
    return { ok: false, reason: 'Maximum OTP attempts exceeded.' }
  }

  otpModel.incrementAttempts(challenge.id)

  if (challenge.channel === 'totp') {
    if (!user.totp_secret_encrypted || !user.mfa_totp_enabled) {
      return { ok: false, reason: 'Authenticator MFA is not enabled.' }
    }

    const secret = decryptText(user.totp_secret_encrypted)
    if (!verifyTotp(secret, code)) {
      return { ok: false, reason: 'Invalid authenticator code.' }
    }
  } else {
    const match = await bcrypt.compare(String(code), challenge.otp_hash || '')
    if (!match) {
      return { ok: false, reason: 'Invalid OTP code.' }
    }
  }

  otpModel.consume(challenge.id)
  return { ok: true }
}

function createTotpEnrollment(userEmail) {
  const secret = generateSecret()
  const otpAuthUrl = buildOtpAuthUrl({
    issuer: 'LOOM',
    accountName: userEmail,
    secret,
  })

  return { secret, otpAuthUrl }
}

function resolvePreferredOtpChannel(user) {
  if (user.mfa_totp_enabled) {
    return 'totp'
  }

  if (user.preferred_otp_channel === 'sms' && user.phone_encrypted) {
    return 'sms'
  }

  return 'email'
}

module.exports = { createChallenge, verifyChallenge, createTotpEnrollment, resolvePreferredOtpChannel }

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { config } = require('../config/env.cjs')
const userModel = require('../models/userModel.cjs')
const { encryptText, hashLookup } = require('./encryptionService.cjs')

function isConfigured() {
  return Boolean(config.supabase.jwtSecret)
}

function verifySupabaseToken(token) {
  if (!isConfigured()) {
    return null
  }

  try {
    const payload = jwt.verify(token, config.supabase.jwtSecret)
    if (!payload?.email || !payload?.sub) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function normalizeRole(payload) {
  const role = payload?.user_metadata?.role || payload?.app_metadata?.role
  return role === 'nominee' || role === 'admin' ? role : 'user'
}

function normalizePreferredOtpChannel(payload) {
  return payload?.user_metadata?.preferredOtpChannel === 'sms' ? 'sms' : 'email'
}

function normalizeInactivityTimerDays(payload) {
  const value = Number(payload?.user_metadata?.inactivityTimerDays)
  return Number.isInteger(value) && value > 0 ? value : config.inactivityThresholdDays
}

function syncUserFromSupabasePayload(payload) {
  const email = String(payload.email).trim().toLowerCase()
  const name = String(payload.user_metadata?.name || payload.user_metadata?.full_name || email.split('@')[0]).trim()
  const phone = typeof payload.user_metadata?.phone === 'string' && payload.user_metadata.phone.trim()
    ? payload.user_metadata.phone.trim()
    : null

  const baseUser = {
    emailHash: hashLookup(email),
    emailEncrypted: encryptText(email),
    nameEncrypted: encryptText(name),
    phoneHash: phone ? hashLookup(phone) : null,
    phoneEncrypted: phone ? encryptText(phone) : null,
    role: normalizeRole(payload),
    preferredOtpChannel: normalizePreferredOtpChannel(payload),
    inactivityTimerDays: normalizeInactivityTimerDays(payload),
  }

  const existing = userModel.findByEmail(email)
  if (!existing) {
    const created = userModel.createUser({
      ...baseUser,
      passwordHash: bcrypt.hashSync(`supabase:${payload.sub}`, 10),
    })
    userModel.markEmailVerified(created.id)
    return userModel.findById(created.id)
  }

  return userModel.syncExternalUser(existing.id, {
    nameEncrypted: baseUser.nameEncrypted,
    phoneHash: baseUser.phoneHash,
    phoneEncrypted: baseUser.phoneEncrypted,
    role: baseUser.role,
    preferredOtpChannel: baseUser.preferredOtpChannel,
    inactivityTimerDays: baseUser.inactivityTimerDays,
    emailVerifiedAt: new Date().toISOString(),
  })
}

module.exports = {
  isConfigured,
  verifySupabaseToken,
  syncUserFromSupabasePayload,
}

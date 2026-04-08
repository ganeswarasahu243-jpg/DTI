const crypto = require('crypto')
const { db } = require('../db/database.cjs')
const { hashLookup } = require('../services/encryptionService.cjs')
const { nowIso } = require('../utils/time.cjs')

const insertUser = db.prepare(`
  INSERT INTO users (
    id, email_hash, email_encrypted, name_encrypted, phone_hash, phone_encrypted,
    password_hash, role, preferred_otp_channel,
    mfa_email_enabled, mfa_totp_enabled, trusted_circle_threshold, inactivity_timer_days,
    failed_login_attempts, risk_score, last_activity_at, last_verified_alive_at, created_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?,
    1, 0, ?, ?,
    0, 0, ?, ?, ?
  )
`)

const findByEmailHashStmt = db.prepare('SELECT * FROM users WHERE email_hash = ?')
const findByPhoneHashStmt = db.prepare('SELECT * FROM users WHERE phone_hash = ?')
const findByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?')
const updateRiskStateStmt = db.prepare(`
  UPDATE users
  SET failed_login_attempts = ?, risk_score = ?, flagged_at = ?, flagged_reason = ?, locked_until = ?
  WHERE id = ?
`)
const resetFailedAttemptsStmt = db.prepare(`
  UPDATE users
  SET failed_login_attempts = 0, risk_score = 0, flagged_reason = NULL, flagged_at = NULL,
      locked_until = NULL, last_login_at = ?, last_activity_at = ?, last_verified_alive_at = ?
  WHERE id = ?
`)
const updateLastActivityStmt = db.prepare('UPDATE users SET last_activity_at = ? WHERE id = ?')
const updateTotpSecretStmt = db.prepare('UPDATE users SET totp_secret_encrypted = ?, mfa_totp_enabled = ? WHERE id = ?')
const updateThresholdStmt = db.prepare('UPDATE users SET trusted_circle_threshold = ? WHERE id = ?')
const updateInactivityTimerStmt = db.prepare('UPDATE users SET inactivity_timer_days = ? WHERE id = ?')
const updateProfileStmt = db.prepare(`
  UPDATE users
  SET name_encrypted = ?, phone_hash = ?, phone_encrypted = ?, preferred_otp_channel = ?
  WHERE id = ?
`)
const markEmailVerifiedStmt = db.prepare('UPDATE users SET email_verified_at = ?, verification_sent_at = ? WHERE id = ?')
const markVerificationSentStmt = db.prepare('UPDATE users SET verification_sent_at = ? WHERE id = ?')
const syncExternalUserStmt = db.prepare(`
  UPDATE users
  SET name_encrypted = ?, phone_hash = ?, phone_encrypted = ?, role = ?, preferred_otp_channel = ?,
      inactivity_timer_days = ?, email_verified_at = ?, verification_sent_at = ?
  WHERE id = ?
`)
const listUsersStmt = db.prepare('SELECT * FROM users')
const seedUpdateStmt = db.prepare(`
  UPDATE users
  SET email_encrypted = ?, name_encrypted = ?, phone_hash = ?, phone_encrypted = ?,
      password_hash = ?, role = ?, preferred_otp_channel = ?, trusted_circle_threshold = ?,
      inactivity_timer_days = ?, mfa_email_enabled = 1
  WHERE id = ?
`)

function createUser({
  emailEncrypted,
  emailHash,
  nameEncrypted,
  phoneEncrypted = null,
  phoneHash = null,
  passwordHash,
  role,
  threshold = 2,
  preferredOtpChannel = 'email',
  inactivityTimerDays = 60,
}) {
  const id = crypto.randomUUID()
  const createdAt = nowIso()
  insertUser.run(
    id,
    emailHash,
    emailEncrypted,
    nameEncrypted,
    phoneHash,
    phoneEncrypted,
    passwordHash,
    role,
    preferredOtpChannel,
    threshold,
    inactivityTimerDays,
    createdAt,
    createdAt,
    createdAt,
  )
  return findById(id)
}

function findByEmail(email) {
  return findByEmailHashStmt.get(hashLookup(email)) || null
}

function findByEmailHash(emailHash) {
  return findByEmailHashStmt.get(emailHash) || null
}

function findByPhone(phone) {
  return findByPhoneHashStmt.get(hashLookup(phone)) || null
}

function findById(id) {
  return findByIdStmt.get(id) || null
}

function updateRiskState(userId, { failedLoginAttempts, riskScore, reason, lockedUntil }) {
  const flaggedAt = reason ? nowIso() : null
  updateRiskStateStmt.run(
    failedLoginAttempts,
    riskScore,
    flaggedAt,
    reason || null,
    lockedUntil || null,
    userId,
  )
}

function resetFailedAttempts(userId) {
  const timestamp = nowIso()
  resetFailedAttemptsStmt.run(timestamp, timestamp, timestamp, userId)
}

function touchActivity(userId) {
  updateLastActivityStmt.run(nowIso(), userId)
}

function saveTotpSecret(userId, encryptedSecret, enabled) {
  updateTotpSecretStmt.run(encryptedSecret, enabled ? 1 : 0, userId)
}

function updateTrustedCircleThreshold(userId, threshold) {
  updateThresholdStmt.run(threshold, userId)
}

function updateInactivityTimer(userId, inactivityTimerDays) {
  updateInactivityTimerStmt.run(inactivityTimerDays, userId)
}

function updateProfile(userId, {
  nameEncrypted,
  phoneHash,
  phoneEncrypted,
  preferredOtpChannel,
}) {
  updateProfileStmt.run(
    nameEncrypted,
    phoneHash || null,
    phoneEncrypted || null,
    preferredOtpChannel,
    userId,
  )

  return findById(userId)
}

function markEmailVerified(userId) {
  const timestamp = nowIso()
  markEmailVerifiedStmt.run(timestamp, timestamp, userId)
}

function markVerificationSent(userId) {
  markVerificationSentStmt.run(nowIso(), userId)
}

function syncExternalUser(userId, {
  nameEncrypted,
  phoneHash,
  phoneEncrypted,
  role,
  preferredOtpChannel,
  inactivityTimerDays,
  emailVerifiedAt,
}) {
  syncExternalUserStmt.run(
    nameEncrypted,
    phoneHash || null,
    phoneEncrypted || null,
    role,
    preferredOtpChannel,
    inactivityTimerDays,
    emailVerifiedAt || nowIso(),
    nowIso(),
    userId,
  )

  return findById(userId)
}

function listUsers() {
  return listUsersStmt.all()
}

function listInactiveUsers(referenceDate = new Date()) {
  return listUsers().filter((user) => {
    const lastActivity = new Date(user.last_activity_at)
    const thresholdDays = Number(user.inactivity_timer_days || 0)
    if (!Number.isFinite(thresholdDays) || thresholdDays <= 0) {
      return false
    }

    const cutoff = new Date(referenceDate.getTime() - thresholdDays * 24 * 60 * 60 * 1000)
    return lastActivity <= cutoff
  })
}

function updateUserForSeed(userId, {
  emailEncrypted,
  nameEncrypted,
  phoneHash,
  phoneEncrypted,
  passwordHash,
  role,
  preferredOtpChannel,
  threshold,
  inactivityTimerDays,
}) {
  seedUpdateStmt.run(
    emailEncrypted,
    nameEncrypted,
    phoneHash || null,
    phoneEncrypted || null,
    passwordHash,
    role,
    preferredOtpChannel,
    threshold,
    inactivityTimerDays,
    userId,
  )

  return findById(userId)
}

module.exports = {
  createUser,
  findByEmail,
  findByEmailHash,
  findByPhone,
  findById,
  updateRiskState,
  resetFailedAttempts,
  touchActivity,
  saveTotpSecret,
  updateTrustedCircleThreshold,
  updateInactivityTimer,
  updateProfile,
  markEmailVerified,
  markVerificationSent,
  syncExternalUser,
  listUsers,
  listInactiveUsers,
  updateUserForSeed,
}

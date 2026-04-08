const crypto = require('crypto')
const { db } = require('../db/database.cjs')
const { hashLookup } = require('../services/encryptionService.cjs')
const { nowIso } = require('../utils/time.cjs')

const insertStmt = db.prepare(`
  INSERT INTO admin_accounts (
    id, email_hash, email_encrypted, name_encrypted, password_hash,
    failed_login_attempts, locked_until, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)
`)

const findByIdStmt = db.prepare('SELECT * FROM admin_accounts WHERE id = ?')
const findByEmailHashStmt = db.prepare('SELECT * FROM admin_accounts WHERE email_hash = ?')
const updateCredentialsStmt = db.prepare(`
  UPDATE admin_accounts
  SET email_hash = ?, email_encrypted = ?, name_encrypted = ?, password_hash = ?, updated_at = ?
  WHERE id = ?
`)
const updateRiskStateStmt = db.prepare(`
  UPDATE admin_accounts
  SET failed_login_attempts = ?, locked_until = ?, updated_at = ?
  WHERE id = ?
`)
const resetLoginStateStmt = db.prepare(`
  UPDATE admin_accounts
  SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
  WHERE id = ?
`)

function createAdminAccount({ emailEncrypted, emailHash, nameEncrypted, passwordHash }) {
  const id = crypto.randomUUID()
  const timestamp = nowIso()
  insertStmt.run(id, emailHash, emailEncrypted, nameEncrypted, passwordHash, timestamp, timestamp)
  return findById(id)
}

function findById(id) {
  return findByIdStmt.get(id) || null
}

function findByEmail(email) {
  return findByEmailHashStmt.get(hashLookup(email)) || null
}

function updateCredentials(adminId, { emailEncrypted, emailHash, nameEncrypted, passwordHash }) {
  updateCredentialsStmt.run(emailHash, emailEncrypted, nameEncrypted, passwordHash, nowIso(), adminId)
  return findById(adminId)
}

function updateRiskState(adminId, { failedLoginAttempts, lockedUntil }) {
  updateRiskStateStmt.run(failedLoginAttempts, lockedUntil || null, nowIso(), adminId)
}

function resetLoginState(adminId) {
  const timestamp = nowIso()
  resetLoginStateStmt.run(timestamp, timestamp, adminId)
}

module.exports = {
  createAdminAccount,
  findById,
  findByEmail,
  updateCredentials,
  updateRiskState,
  resetLoginState,
}

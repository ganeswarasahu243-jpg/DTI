const crypto = require('crypto')
const { db } = require('../db/database.cjs')
const { nowIso } = require('../utils/time.cjs')

const createStmt = db.prepare(`
  INSERT INTO otp_challenges (
    id, user_id, purpose, channel, otp_hash, expires_at,
    attempts, max_attempts, metadata_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
`)
const findStmt = db.prepare('SELECT * FROM otp_challenges WHERE id = ?')
const latestByUserStmt = db.prepare(`
  SELECT * FROM otp_challenges
  WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL
  ORDER BY datetime(created_at) DESC
  LIMIT 1
`)
const bumpAttemptsStmt = db.prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?')
const consumeStmt = db.prepare('UPDATE otp_challenges SET consumed_at = ? WHERE id = ?')

function createChallenge({ userId, purpose, channel, otpHash, expiresAt, maxAttempts, metadata }) {
  const id = crypto.randomUUID()
  createStmt.run(
    id,
    userId,
    purpose,
    channel,
    otpHash || null,
    expiresAt,
    maxAttempts,
    metadata ? JSON.stringify(metadata) : null,
    nowIso(),
  )

  return findById(id)
}

function findById(id) {
  return findStmt.get(id) || null
}

function findLatestActive(userId, purpose) {
  return latestByUserStmt.get(userId, purpose) || null
}

function incrementAttempts(id) {
  bumpAttemptsStmt.run(id)
}

function consume(id) {
  consumeStmt.run(nowIso(), id)
}

module.exports = {
  createChallenge,
  findById,
  findLatestActive,
  incrementAttempts,
  consume,
}

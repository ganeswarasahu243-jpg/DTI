const crypto = require('crypto')
const { db } = require('../db/database.cjs')
const { nowIso } = require('../utils/time.cjs')

const insertStmt = db.prepare(`
  INSERT INTO claims (
    id, owner_user_id, trusted_circle_id, claimant_user_id,
    claimant_name_encrypted, claimant_contact_hash, claimant_contact_encrypted, claimant_channel,
    deceased_contact_hash, deceased_contact_encrypted,
    otp_hash, otp_expires_at, otp_attempts, otp_max_attempts,
    approval_threshold, status, created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?,
    ?, ?, 0, ?,
    ?, ?, ?, ?
  )
`)

const findByIdStmt = db.prepare('SELECT * FROM claims WHERE id = ?')
const incrementOtpAttemptsStmt = db.prepare(`
  UPDATE claims
  SET otp_attempts = otp_attempts + 1, updated_at = ?
  WHERE id = ?
`)
const markOtpVerifiedStmt = db.prepare(`
  UPDATE claims
  SET otp_verified_at = ?, status = ?, updated_at = ?
  WHERE id = ?
`)
const submitStmt = db.prepare(`
  UPDATE claims
  SET id_proof_name_encrypted = ?, id_proof_mime_type = ?, id_proof_storage_key = ?,
      id_proof_size = ?, id_proof_cipher_meta = ?, demo_timer_minutes = ?, timer_expires_at = ?,
      status = ?, submitted_at = ?, updated_at = ?
  WHERE id = ?
`)
const updateStatusStmt = db.prepare(`
  UPDATE claims
  SET status = ?, access_token_jti = ?, access_granted_at = ?, access_denied_at = ?, updated_at = ?
  WHERE id = ?
`)

function createClaim(payload) {
  const id = crypto.randomUUID()
  const timestamp = nowIso()
  insertStmt.run(
    id,
    payload.ownerUserId,
    payload.trustedCircleId,
    payload.claimantUserId || null,
    payload.claimantNameEncrypted,
    payload.claimantContactHash,
    payload.claimantContactEncrypted,
    payload.claimantChannel,
    payload.deceasedContactHash,
    payload.deceasedContactEncrypted,
    payload.otpHash,
    payload.otpExpiresAt,
    payload.otpMaxAttempts,
    payload.approvalThreshold,
    payload.status || 'pending_verification',
    timestamp,
    timestamp,
  )

  return findById(id)
}

function findById(id) {
  return findByIdStmt.get(id) || null
}

function incrementOtpAttempts(id) {
  incrementOtpAttemptsStmt.run(nowIso(), id)
}

function markOtpVerified(id) {
  const timestamp = nowIso()
  markOtpVerifiedStmt.run(timestamp, 'otp_verified', timestamp, id)
}

function submitClaim(id, payload) {
  const timestamp = nowIso()
  submitStmt.run(
    payload.idProofNameEncrypted,
    payload.idProofMimeType,
    payload.idProofStorageKey,
    payload.idProofSize,
    payload.idProofCipherMeta,
    payload.demoTimerMinutes,
    payload.timerExpiresAt,
    payload.status || 'pending',
    timestamp,
    timestamp,
    id,
  )

  return findById(id)
}

function updateStatus(id, { status, accessTokenJti = null, accessGrantedAt = null, accessDeniedAt = null }) {
  updateStatusStmt.run(status, accessTokenJti, accessGrantedAt, accessDeniedAt, nowIso(), id)
  return findById(id)
}

module.exports = {
  createClaim,
  findById,
  incrementOtpAttempts,
  markOtpVerified,
  submitClaim,
  updateStatus,
}

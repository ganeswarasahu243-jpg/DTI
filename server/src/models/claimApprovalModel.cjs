const crypto = require('crypto')
const { db } = require('../db/database.cjs')
const { nowIso } = require('../utils/time.cjs')

const insertStmt = db.prepare(`
  INSERT INTO claim_approvals (
    id, claim_id, trusted_circle_id, approver_user_id,
    approval_token_hash, approval_token_expires_at, approved_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const listByClaimStmt = db.prepare(`
  SELECT claim_approvals.*, trusted_circle.nominee_name_encrypted, trusted_circle.nominee_email_encrypted
  FROM claim_approvals
  INNER JOIN trusted_circle ON trusted_circle.id = claim_approvals.trusted_circle_id
  WHERE claim_approvals.claim_id = ?
  ORDER BY datetime(claim_approvals.created_at) ASC
`)

const findByClaimAndTokenHashStmt = db.prepare(`
  SELECT claim_approvals.*, trusted_circle.owner_user_id, trusted_circle.nominee_user_id,
         trusted_circle.nominee_name_encrypted, trusted_circle.nominee_email_encrypted
  FROM claim_approvals
  INNER JOIN trusted_circle ON trusted_circle.id = claim_approvals.trusted_circle_id
  WHERE claim_approvals.claim_id = ? AND claim_approvals.approval_token_hash = ?
`)

const approveStmt = db.prepare(`
  UPDATE claim_approvals
  SET approver_user_id = ?, approved_at = ?, updated_at = ?
  WHERE id = ?
`)

const approvedCountStmt = db.prepare(`
  SELECT COUNT(*) AS count
  FROM claim_approvals
  WHERE claim_id = ? AND approved_at IS NOT NULL
`)

function createApprovalInvite(payload) {
  const id = crypto.randomUUID()
  const timestamp = nowIso()
  insertStmt.run(
    id,
    payload.claimId,
    payload.trustedCircleId,
    null,
    payload.approvalTokenHash,
    payload.approvalTokenExpiresAt,
    null,
    timestamp,
    timestamp,
  )
}

function listByClaim(claimId) {
  return listByClaimStmt.all(claimId)
}

function findByClaimAndTokenHash(claimId, approvalTokenHash) {
  return findByClaimAndTokenHashStmt.get(claimId, approvalTokenHash) || null
}

function approve(approvalId, approverUserId = null) {
  const timestamp = nowIso()
  approveStmt.run(approverUserId, timestamp, timestamp, approvalId)
}

function approvedCount(claimId) {
  return approvedCountStmt.get(claimId)?.count || 0
}

module.exports = {
  createApprovalInvite,
  listByClaim,
  findByClaimAndTokenHash,
  approve,
  approvedCount,
}

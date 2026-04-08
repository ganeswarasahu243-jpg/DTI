const crypto = require('crypto')
const { db } = require('../db/database.cjs')
const { nowIso } = require('../utils/time.cjs')

const activeStmt = db.prepare(`
  SELECT * FROM release_requests
  WHERE user_id = ? AND status IN ('pending_alerts', 'awaiting_consensus')
  ORDER BY datetime(created_at) DESC
  LIMIT 1
`)
const byIdStmt = db.prepare('SELECT * FROM release_requests WHERE id = ?')
const latestReleasedStmt = db.prepare(`
  SELECT *
  FROM release_requests
  WHERE user_id = ? AND status = 'released'
  ORDER BY datetime(released_at) DESC, datetime(updated_at) DESC
  LIMIT 1
`)
const createStmt = db.prepare(`
  INSERT INTO release_requests (
    id, user_id, status, reason, inactivity_threshold_days, grace_period_days,
    approval_threshold, alerts_sent, triggered_at, last_alert_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
`)
const listActiveStmt = db.prepare(`
  SELECT * FROM release_requests
  WHERE status IN ('pending_alerts', 'awaiting_consensus')
`)
const updateAlertStmt = db.prepare('UPDATE release_requests SET alerts_sent = ?, last_alert_at = ?, updated_at = ? WHERE id = ?')
const updateStatusStmt = db.prepare('UPDATE release_requests SET status = ?, updated_at = ?, cancelled_at = ?, released_at = ? WHERE id = ?')
const insertApprovalStmt = db.prepare(`
  INSERT INTO release_approvals (id, release_request_id, nominee_user_id, approved_at)
  VALUES (?, ?, ?, ?)
`)
const approvalCountStmt = db.prepare('SELECT COUNT(*) AS count FROM release_approvals WHERE release_request_id = ?')
const approvalExistsStmt = db.prepare('SELECT id FROM release_approvals WHERE release_request_id = ? AND nominee_user_id = ?')

function findActiveForUser(userId) {
  return activeStmt.get(userId) || null
}

function findById(id) {
  return byIdStmt.get(id) || null
}

function findLatestReleasedForUser(userId) {
  return latestReleasedStmt.get(userId) || null
}

function createReleaseRequest({ userId, reason, inactivityThresholdDays, gracePeriodDays, approvalThreshold, triggeredAt }) {
  const id = crypto.randomUUID()
  const now = nowIso()
  createStmt.run(
    id,
    userId,
    'pending_alerts',
    reason,
    inactivityThresholdDays,
    gracePeriodDays,
    approvalThreshold,
    triggeredAt,
    triggeredAt,
    now,
    now,
  )
  return findActiveForUser(userId)
}

function listActive() {
  return listActiveStmt.all()
}

function recordAlert(requestId, alertsSent, timestamp) {
  updateAlertStmt.run(alertsSent, timestamp, timestamp, requestId)
}

function markCancelled(requestId) {
  const now = nowIso()
  updateStatusStmt.run('cancelled', now, now, null, requestId)
}

function markAwaitingConsensus(requestId) {
  updateStatusStmt.run('awaiting_consensus', nowIso(), null, null, requestId)
}

function markReleased(requestId) {
  const now = nowIso()
  updateStatusStmt.run('released', now, null, now, requestId)
}

function addApproval(requestId, nomineeUserId) {
  insertApprovalStmt.run(crypto.randomUUID(), requestId, nomineeUserId, nowIso())
}

function hasApproval(requestId, nomineeUserId) {
  return Boolean(approvalExistsStmt.get(requestId, nomineeUserId))
}

function approvalCount(requestId) {
  return approvalCountStmt.get(requestId)?.count || 0
}

module.exports = {
  findActiveForUser,
  findById,
  findLatestReleasedForUser,
  createReleaseRequest,
  listActive,
  recordAlert,
  markCancelled,
  markAwaitingConsensus,
  markReleased,
  addApproval,
  hasApproval,
  approvalCount,
}

const crypto = require('crypto')
const { db } = require('../db/database.cjs')
const { config } = require('../config/env.cjs')
const { nowIso } = require('../utils/time.cjs')

const insertStmt = db.prepare(`
  INSERT INTO activity_logs (
    id, user_id, request_id, event_type, ip_address, device_info, location_hint,
    severity, message, metadata_json, integrity_prev_hash, integrity_hash, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const latestIntegrityStmt = db.prepare(`
  SELECT integrity_hash
  FROM activity_logs
  ORDER BY datetime(created_at) DESC, rowid DESC
  LIMIT 1
`)

const recentByTypeStmt = db.prepare(`
  SELECT * FROM activity_logs
  WHERE user_id = ? AND event_type = ?
  ORDER BY datetime(created_at) DESC
  LIMIT ?
`)

const failedAttemptsSinceStmt = db.prepare(`
  SELECT COUNT(*) AS count FROM activity_logs
  WHERE user_id = ? AND event_type = 'login_failed' AND datetime(created_at) >= datetime(?)
`)

const listByUserStmt = db.prepare(`
  SELECT *
  FROM activity_logs
  WHERE user_id = ?
  ORDER BY datetime(created_at) DESC, rowid DESC
  LIMIT ?
`)

function computeIntegrityHash(payload) {
  return crypto
    .createHmac('sha256', config.auditLogSecret)
    .update(JSON.stringify(payload))
    .digest('hex')
}

function insertLog({
  userId,
  requestId,
  eventType,
  ipAddress,
  deviceInfo,
  locationHint,
  severity = 'info',
  message,
  metadata,
}) {
  const createdAt = nowIso()
  const prevHash = latestIntegrityStmt.get()?.integrity_hash || null
  const integrityHash = computeIntegrityHash({
    prevHash,
    userId: userId || null,
    requestId: requestId || null,
    eventType,
    ipAddress: ipAddress || null,
    deviceInfo: deviceInfo || null,
    locationHint: locationHint || null,
    severity,
    message,
    metadata: metadata || null,
    createdAt,
  })

  insertStmt.run(
    crypto.randomUUID(),
    userId || null,
    requestId || null,
    eventType,
    ipAddress || null,
    deviceInfo || null,
    locationHint || null,
    severity,
    message,
    metadata ? JSON.stringify(metadata) : null,
    prevHash,
    integrityHash,
    createdAt,
  )
}

function recentByType(userId, eventType, limit = 5) {
  return recentByTypeStmt.all(userId, eventType, limit)
}

function failedAttemptsSince(userId, sinceIso) {
  const row = failedAttemptsSinceStmt.get(userId, sinceIso)
  return row?.count || 0
}

function listByUser(userId, limit = 100) {
  return listByUserStmt.all(userId, limit)
}

module.exports = { insertLog, recentByType, failedAttemptsSince, listByUser }

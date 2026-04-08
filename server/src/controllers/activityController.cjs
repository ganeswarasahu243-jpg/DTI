const activityLogModel = require('../models/activityLogModel.cjs')

function listLogs(req, res) {
  const logs = activityLogModel.listByUser(req.currentUser.id, 100).map((entry) => ({
    id: entry.id,
    requestId: entry.request_id,
    eventType: entry.event_type,
    ipAddress: entry.ip_address,
    deviceInfo: entry.device_info,
    locationHint: entry.location_hint,
    severity: entry.severity,
    message: entry.message,
    metadata: entry.metadata_json ? safeParseJson(entry.metadata_json) : null,
    integrityHash: entry.integrity_hash,
    createdAt: entry.created_at,
  }))

  return res.json({ logs })
}

function safeParseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

module.exports = { listLogs }

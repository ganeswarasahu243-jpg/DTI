const activityLogModel = require('../models/activityLogModel.cjs')
const userModel = require('../models/userModel.cjs')
const { config } = require('../config/env.cjs')
const auditLogService = require('./auditLogService.cjs')

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function detectLoginRisk(user, context) {
  const recentSuccess = activityLogModel.recentByType(user.id, 'login_success', 5)
  const failuresLastHour = activityLogModel.failedAttemptsSince(
    user.id,
    new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  )

  const anomalies = []
  let riskScore = 0
  const seenDevice = recentSuccess.some((entry) => {
    const metadata = entry.metadata_json ? JSON.parse(entry.metadata_json) : {}
    return metadata.deviceFingerprint === context.deviceFingerprint
  })
  const seenLocation = recentSuccess.some((entry) => entry.location_hint === context.locationHint)

  if (!seenDevice && recentSuccess.length > 0) {
    anomalies.push('new_device_login')
    riskScore += 35
  }

  if (!seenLocation && recentSuccess.length > 0) {
    anomalies.push('unusual_location')
    riskScore += 35
  }

  if (failuresLastHour >= 3 || user.failed_login_attempts >= 3) {
    anomalies.push('multiple_failed_login_attempts')
    riskScore += 30
  }

  const lockedUntil =
    riskScore >= config.suspiciousLoginThreshold
      ? minutesFromNow(config.suspiciousLoginLockMinutes)
      : null

  if (anomalies.length > 0 || riskScore > 0) {
    userModel.updateRiskState(user.id, {
      failedLoginAttempts: Math.max(user.failed_login_attempts, failuresLastHour),
      riskScore,
      reason: anomalies.join(', ') || 'suspicious_activity',
      lockedUntil,
    })

    auditLogService.logEvent({
      userId: user.id,
      eventType: 'fraud_anomaly_detected',
      ipAddress: context.ipAddress,
      requestId: context.requestId,
      deviceInfo: context.deviceInfo,
      locationHint: context.locationHint,
      severity: 'warn',
      message: `Fraud detection flagged: ${anomalies.join(', ')}`,
      metadata: {
        anomalies,
        riskScore,
        lockedUntil,
        deviceFingerprint: context.deviceFingerprint,
      },
    })
  }

  return {
    anomalies,
    riskScore,
    lockedUntil,
    shouldLock: Boolean(lockedUntil),
  }
}

module.exports = { detectLoginRisk }

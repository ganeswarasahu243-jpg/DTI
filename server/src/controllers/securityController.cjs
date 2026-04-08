const { z } = require('zod')
const releaseRequestModel = require('../models/releaseRequestModel.cjs')
const trustedCircleService = require('../services/trustedCircleService.cjs')
const auditLogService = require('../services/auditLogService.cjs')
const userModel = require('../models/userModel.cjs')
const { config } = require('../config/env.cjs')

const inactivityTimerSchema = z.object({
  days: z.number().int(),
})

function getPosture(req, res) {
  const refreshedUser = userModel.findById(req.currentUser.id)
  if (!refreshedUser) {
    return res.status(404).json({ message: 'User not found.' })
  }

  const circle = trustedCircleService.getTrustedCircleSummary(
    refreshedUser.id,
    refreshedUser.trusted_circle_threshold,
  )
  const activeReleaseRequest = releaseRequestModel.findActiveForUser(refreshedUser.id)

  return res.json({
    mfa: {
      email: Boolean(refreshedUser.mfa_email_enabled),
      totp: Boolean(refreshedUser.mfa_totp_enabled),
      recentWindowMinutes: config.recentMfaMinutes,
    },
    risk: {
      lockedUntil: refreshedUser.locked_until || null,
      flaggedAt: refreshedUser.flagged_at || null,
      flaggedReason: refreshedUser.flagged_reason || null,
      riskScore: refreshedUser.risk_score || 0,
    },
    deadManSwitch: {
      timerDays: refreshedUser.inactivity_timer_days,
      allowedOptionsDays: config.inactivityTimerOptionsDays,
      activeRequest: activeReleaseRequest,
    },
    trustedCircle: {
      nomineeCount: circle.nomineeCount,
      minimumThreshold: circle.minimumThreshold,
      effectiveThreshold: circle.effectiveThreshold,
    },
    zeroTrust: {
      transport: config.enforceHttps ? 'https-required' : 'https-recommended-for-development',
      auth: 'jwt-bearer-with-step-up-mfa',
      audit: 'tamper-evident-hash-chain',
    },
  })
}

function updateInactivityTimer(req, res) {
  const parsed = inactivityTimerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid inactivity timer payload.', issues: parsed.error.flatten() })
  }

  if (!config.inactivityTimerOptionsDays.includes(parsed.data.days)) {
    return res.status(400).json({
      message: `Timer must be one of: ${config.inactivityTimerOptionsDays.join(', ')} days.`,
    })
  }

  userModel.updateInactivityTimer(req.currentUser.id, parsed.data.days)
  auditLogService.logEvent({
    userId: req.currentUser.id,
    requestId: req.requestId,
    eventType: 'dead_man_switch_timer_updated',
    severity: 'info',
    message: 'User updated their dead-man switch inactivity timer.',
    metadata: { timerDays: parsed.data.days },
  })

  return res.json({ inactivityTimerDays: parsed.data.days })
}

module.exports = { getPosture, updateInactivityTimer }

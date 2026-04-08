const userModel = require('../models/userModel.cjs')
const releaseRequestModel = require('../models/releaseRequestModel.cjs')
const auditLogService = require('./auditLogService.cjs')
const notificationService = require('./notificationService.cjs')
const trustedCircleService = require('./trustedCircleService.cjs')
const { addDays, nowIso } = require('../utils/time.cjs')
const { config } = require('../config/env.cjs')

function cancelForRenewedActivity(userId, request, reason) {
  releaseRequestModel.markCancelled(request.id)
  auditLogService.logEvent({
    userId,
    eventType: 'release_workflow_cancelled_activity',
    severity: 'info',
    message: reason,
    metadata: { requestId: request.id },
  })
}

function isOwnerStillInactive(user, request) {
  return new Date(user.last_activity_at) <= new Date(request.triggered_at)
}

function evaluateInactiveUsers() {
  const users = userModel.listInactiveUsers(new Date())

  for (const user of users) {
    if (releaseRequestModel.findActiveForUser(user.id)) {
      continue
    }

    const circle = trustedCircleService.getTrustedCircleSummary(
      user.id,
      user.trusted_circle_threshold,
    )
    if (circle.nomineeCount === 0) {
      auditLogService.logEvent({
        userId: user.id,
        eventType: 'release_workflow_skipped',
        severity: 'warn',
        message: 'Dead-man switch skipped because no trusted circle nominees are configured.',
        metadata: { inactivityTimerDays: user.inactivity_timer_days },
      })
      continue
    }

    const request = releaseRequestModel.createReleaseRequest({
      userId: user.id,
      reason: 'dead_man_switch',
      inactivityThresholdDays: user.inactivity_timer_days,
      gracePeriodDays: config.releaseGraceDays,
      approvalThreshold: circle.effectiveThreshold,
      triggeredAt: nowIso(),
    })

    notificationService.sendReleaseAlert(user.id, 'Release workflow triggered due to inactivity.')
    auditLogService.logEvent({
      userId: user.id,
      eventType: 'release_workflow_triggered',
      severity: 'warn',
      message: 'Dead-man switch triggered release workflow.',
      metadata: { requestId: request.id },
    })
  }
}

function progressReleaseRequests() {
  const activeRequests = releaseRequestModel.listActive()

  for (const request of activeRequests) {
    const owner = userModel.findById(request.user_id)
    if (!owner) {
      continue
    }

    if (request.reason === 'dead_man_switch' && !isOwnerStillInactive(owner, request)) {
      cancelForRenewedActivity(
        request.user_id,
        request,
        'Dead-man switch cancelled because the owner became active again.',
      )
      continue
    }

    const graceDeadline = addDays(new Date(request.triggered_at), request.grace_period_days)

    if (request.status === 'pending_alerts' && new Date() < graceDeadline && request.alerts_sent < config.releaseAlertCount) {
      const elapsed = Date.now() - new Date(request.last_alert_at || request.triggered_at).getTime()
      const cadenceMs = Math.max(1, Math.floor((request.grace_period_days * 24 * 60 * 60 * 1000) / config.releaseAlertCount))

      if (elapsed >= cadenceMs) {
        const nextAlertCount = request.alerts_sent + 1
        releaseRequestModel.recordAlert(request.id, nextAlertCount, nowIso())
        notificationService.sendReleaseAlert(request.user_id, `Release workflow reminder ${nextAlertCount}.`)
        auditLogService.logEvent({
          userId: request.user_id,
          eventType: 'release_alert_sent',
          severity: 'warn',
          message: `Release alert ${nextAlertCount} sent.`,
          metadata: { requestId: request.id },
        })
      }
    }

    if (new Date() >= graceDeadline && request.status === 'pending_alerts') {
      releaseRequestModel.markAwaitingConsensus(request.id)
      notificationService.sendReleaseAlert(
        request.user_id,
        'Release workflow is now awaiting trusted circle consensus.',
      )
      auditLogService.logEvent({
        userId: request.user_id,
        eventType: 'release_consensus_required',
        severity: 'warn',
        message: 'Release request is now waiting for trusted circle approvals.',
        metadata: { requestId: request.id },
      })
    }

    if (
      request.status === 'awaiting_consensus' &&
      new Date() >= graceDeadline &&
      releaseRequestModel.approvalCount(request.id) >= request.approval_threshold
    ) {
      auditLogService.logEvent({
        userId: request.user_id,
        eventType: 'release_verification_passed',
        severity: 'warn',
        message: 'Release request passed inactivity verification and trusted circle consensus.',
        metadata: { requestId: request.id, approvalThreshold: request.approval_threshold },
      })
      releaseRequestModel.markReleased(request.id)
      auditLogService.logEvent({
        userId: request.user_id,
        eventType: 'release_completed',
        severity: 'critical',
        message: 'Release workflow completed after trusted circle consensus.',
        metadata: { requestId: request.id },
      })
    }
  }
}

function handleUserActivity(user) {
  const request = releaseRequestModel.findActiveForUser(user.id)
  if (!request || request.reason !== 'dead_man_switch') {
    return
  }

  cancelForRenewedActivity(
    user.id,
    request,
    'Dead-man switch cancelled automatically after renewed authenticated activity.',
  )
}

function startReleaseScheduler() {
  evaluateInactiveUsers()
  progressReleaseRequests()
  setInterval(() => {
    evaluateInactiveUsers()
    progressReleaseRequests()
  }, config.releaseSweepMs).unref()
}

module.exports = { startReleaseScheduler, progressReleaseRequests, handleUserActivity }

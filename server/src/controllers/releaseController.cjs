const releaseRequestModel = require('../models/releaseRequestModel.cjs')
const trustedCircleModel = require('../models/trustedCircleModel.cjs')
const auditLogService = require('../services/auditLogService.cjs')
const { progressReleaseRequests } = require('../services/releaseService.cjs')
const trustedCircleService = require('../services/trustedCircleService.cjs')
const { config } = require('../config/env.cjs')
const { nowIso } = require('../utils/time.cjs')

function status(req, res) {
  const request = releaseRequestModel.findActiveForUser(req.currentUser.id)
  return res.json({ request })
}

function trigger(req, res) {
  if (releaseRequestModel.findActiveForUser(req.currentUser.id)) {
    return res.status(409).json({ message: 'A release workflow is already active.' })
  }

  const circle = trustedCircleService.getTrustedCircleSummary(
    req.currentUser.id,
    req.currentUser.trusted_circle_threshold,
  )
  if (circle.nomineeCount === 0) {
    return res.status(400).json({ message: 'Add at least one trusted nominee before triggering release.' })
  }

  const request = releaseRequestModel.createReleaseRequest({
    userId: req.currentUser.id,
    reason: 'manual_release_trigger',
    inactivityThresholdDays: req.currentUser.inactivity_timer_days,
    gracePeriodDays: config.releaseGraceDays,
    approvalThreshold: circle.effectiveThreshold,
    triggeredAt: nowIso(),
  })

  auditLogService.logEvent({
    userId: req.currentUser.id,
    requestId: req.requestId,
    eventType: 'release_workflow_triggered_manual',
    severity: 'warn',
    message: 'User manually triggered the release workflow.',
    metadata: { requestId: request.id, approvalThreshold: circle.effectiveThreshold },
  })

  return res.status(201).json({ request })
}

function cancel(req, res) {
  const request = releaseRequestModel.findActiveForUser(req.currentUser.id)
  if (!request) {
    return res.status(404).json({ message: 'No active release workflow found.' })
  }

  releaseRequestModel.markCancelled(request.id)
  auditLogService.logEvent({
    userId: req.currentUser.id,
    requestId: req.requestId,
    eventType: 'release_workflow_cancelled',
    severity: 'info',
    message: 'User cancelled the release workflow.',
    metadata: { requestId: request.id },
  })

  return res.json({ cancelled: true })
}

function approve(req, res) {
  const request = releaseRequestModel.findById(req.params.requestId)
  if (!request) {
    return res.status(404).json({ message: 'Release request not found.' })
  }

  const authorized = trustedCircleModel.isAuthorizedNominee(request.user_id, req.currentUser.id)
  if (!authorized) {
    return res.status(403).json({ message: 'You are not in the trusted circle for this request.' })
  }

  if (request.status !== 'awaiting_consensus') {
    return res.status(409).json({ message: 'This release request is not accepting approvals yet.' })
  }

  if (releaseRequestModel.hasApproval(request.id, req.currentUser.id)) {
    return res.status(409).json({ message: 'You have already approved this release.' })
  }

  releaseRequestModel.addApproval(request.id, req.currentUser.id)
  auditLogService.logEvent({
    userId: request.user_id,
    requestId: req.requestId,
    eventType: 'release_approval_recorded',
    severity: 'warn',
    message: 'Trusted nominee approved a release request.',
    metadata: { requestId: request.id, nomineeUserId: req.currentUser.id },
  })

  progressReleaseRequests()
  return res.json({
    approvals: releaseRequestModel.approvalCount(request.id),
    threshold: request.approval_threshold,
  })
}

module.exports = { status, trigger, cancel, approve }

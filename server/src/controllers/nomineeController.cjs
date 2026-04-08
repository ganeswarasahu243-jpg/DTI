const { z } = require('zod')
const trustedCircleModel = require('../models/trustedCircleModel.cjs')
const userModel = require('../models/userModel.cjs')
const auditLogService = require('../services/auditLogService.cjs')
const trustedCircleService = require('../services/trustedCircleService.cjs')
const { encryptText, decryptText, hashLookup } = require('../services/encryptionService.cjs')

const nomineeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
})

const thresholdSchema = z.object({
  threshold: z.number().int().min(1).max(10),
})

function listNominees(req, res) {
  const refreshedUser = userModel.findById(req.currentUser.id)
  if (!refreshedUser) {
    return res.status(404).json({ message: 'User not found.' })
  }

  const circle = trustedCircleService.getTrustedCircleSummary(
    refreshedUser.id,
    refreshedUser.trusted_circle_threshold,
  )
  const nominees = trustedCircleModel.listByOwner(refreshedUser.id).map((entry) => ({
    id: entry.id,
    nomineeUserId: entry.nominee_user_id,
    email: decryptText(entry.nominee_email_encrypted),
    name: decryptText(entry.nominee_name_encrypted),
    createdAt: entry.created_at,
  }))

  return res.json({
    threshold: circle.effectiveThreshold,
    minimumThreshold: circle.minimumThreshold,
    nomineeCount: circle.nomineeCount,
    nominees,
  })
}

function addNominee(req, res) {
  const parsed = nomineeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid nominee payload.', issues: parsed.error.flatten() })
  }

  const nomineeUser = userModel.findByEmail(parsed.data.email)
  if (nomineeUser?.id === req.currentUser.id) {
    return res.status(400).json({ message: 'You cannot add yourself to your trusted circle.' })
  }

  const existingNominee = trustedCircleModel.findByOwnerAndEmailHash(req.currentUser.id, hashLookup(parsed.data.email))
  if (existingNominee) {
    return res.status(409).json({ message: 'That trusted nominee has already been added.' })
  }

  trustedCircleModel.addNominee({
    ownerUserId: req.currentUser.id,
    nomineeUserId: nomineeUser?.id || null,
    nomineeEmailHash: hashLookup(parsed.data.email),
    nomineeEmailEncrypted: encryptText(parsed.data.email),
    nomineeNameEncrypted: encryptText(parsed.data.name),
  })

  auditLogService.logEvent({
    userId: req.currentUser.id,
    requestId: req.requestId,
    eventType: 'trusted_circle_nominee_added',
    severity: 'info',
    message: 'Trusted circle nominee added.',
    metadata: { nomineeEmail: parsed.data.email },
  })

  return listNominees(req, res)
}

function updateThreshold(req, res) {
  const parsed = thresholdSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid threshold payload.', issues: parsed.error.flatten() })
  }

  const nomineeCount = trustedCircleModel.listByOwner(req.currentUser.id).length
  const minimumThreshold = trustedCircleService.computeMajorityThreshold(nomineeCount)
  if (parsed.data.threshold > nomineeCount) {
    return res.status(400).json({ message: 'Threshold cannot exceed the number of trusted nominees.' })
  }

  if (parsed.data.threshold < minimumThreshold) {
    return res.status(400).json({
      message: `Threshold must be at least the current majority requirement of ${minimumThreshold}.`,
    })
  }

  userModel.updateTrustedCircleThreshold(req.currentUser.id, parsed.data.threshold)
  auditLogService.logEvent({
    userId: req.currentUser.id,
    requestId: req.requestId,
    eventType: 'trusted_circle_threshold_updated',
    severity: 'info',
    message: 'Trusted circle approval threshold updated.',
    metadata: { threshold: parsed.data.threshold },
  })

  return res.json({ threshold: parsed.data.threshold, minimumThreshold })
}

module.exports = { listNominees, addNominee, updateThreshold }

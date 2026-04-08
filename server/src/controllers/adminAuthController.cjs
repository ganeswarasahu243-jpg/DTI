const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const adminAccountModel = require('../models/adminAccountModel.cjs')
const auditLogService = require('../services/auditLogService.cjs')
const { config } = require('../config/env.cjs')
const { decryptText } = require('../services/encryptionService.cjs')
const { getRequestContext } = require('../services/requestContextService.cjs')

const adminLoginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
})

function signAdminToken(admin) {
  return jwt.sign(
    {
      sub: admin.id,
      actorType: 'admin_account',
      role: 'admin',
      scope: 'admin-portal',
      email: decryptText(admin.email_encrypted),
      name: decryptText(admin.name_encrypted),
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  )
}

function publicAdmin(admin) {
  return {
    id: admin.id,
    email: decryptText(admin.email_encrypted),
    name: decryptText(admin.name_encrypted),
    role: 'admin',
    label: 'Demo Admin Access',
    demoMode: true,
    lockedUntil: admin.locked_until || null,
  }
}

async function login(req, res) {
  const parsed = adminLoginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid admin login payload.', issues: parsed.error.flatten() })
  }

  const context = getRequestContext(req)
  const admin = adminAccountModel.findByEmail(parsed.data.email)
  if (!admin) {
    auditLogService.logEvent({
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      locationHint: context.locationHint,
      eventType: 'admin_login_failed',
      severity: 'warn',
      message: 'Admin login failed for unknown email.',
      metadata: { email: parsed.data.email },
    })
    return res.status(401).json({ message: 'Invalid admin email or password.' })
  }

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    auditLogService.logEvent({
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      locationHint: context.locationHint,
      eventType: 'admin_login_locked',
      severity: 'warn',
      message: 'Admin login blocked because the account is temporarily locked.',
      metadata: { adminId: admin.id, lockedUntil: admin.locked_until },
    })
    return res.status(423).json({ message: 'Admin account is temporarily locked. Please try again later.' })
  }

  const passwordMatch = await bcrypt.compare(parsed.data.password, admin.password_hash)
  if (!passwordMatch) {
    const failedAttempts = (admin.failed_login_attempts || 0) + 1
    const lockedUntil =
      failedAttempts >= config.failedLoginLockThreshold
        ? new Date(Date.now() + config.failedLoginLockMinutes * 60 * 1000).toISOString()
        : null

    adminAccountModel.updateRiskState(admin.id, {
      failedLoginAttempts: failedAttempts,
      lockedUntil,
    })

    auditLogService.logEvent({
      requestId: context.requestId,
      ipAddress: context.ipAddress,
      deviceInfo: context.deviceInfo,
      locationHint: context.locationHint,
      eventType: 'admin_login_failed',
      severity: 'warn',
      message: 'Admin login failed because of an invalid password.',
      metadata: { adminId: admin.id, failedAttempts, lockedUntil },
    })
    return res.status(401).json({ message: 'Invalid admin email or password.' })
  }

  adminAccountModel.resetLoginState(admin.id)
  const refreshedAdmin = adminAccountModel.findById(admin.id)
  auditLogService.logEvent({
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    deviceInfo: context.deviceInfo,
    locationHint: context.locationHint,
    eventType: 'admin_login_success',
    severity: 'info',
    message: 'Demo admin authenticated successfully.',
    metadata: { adminId: admin.id },
  })

  return res.json({
    token: signAdminToken(refreshedAdmin),
    admin: publicAdmin(refreshedAdmin),
  })
}

module.exports = { login }

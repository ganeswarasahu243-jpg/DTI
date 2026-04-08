const jwt = require('jsonwebtoken')
const { config } = require('../config/env.cjs')
const adminAccountModel = require('../models/adminAccountModel.cjs')
const userModel = require('../models/userModel.cjs')
const { decryptText } = require('../services/encryptionService.cjs')
const supabaseAuthService = require('../services/supabaseAuthService.cjs')

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing bearer token.' })
  }

  try {
    const token = authHeader.slice('Bearer '.length)
    let payload
    let authSource = 'local'

    try {
      payload = jwt.verify(token, config.jwtSecret)
    } catch {
      payload = supabaseAuthService.verifySupabaseToken(token)
      authSource = payload ? 'supabase' : 'unknown'
    }

    if (!payload) {
      return res.status(401).json({ message: 'Invalid or expired token.' })
    }

    if (payload.actorType === 'admin_account') {
      const admin = adminAccountModel.findById(payload.sub)
      if (!admin) {
        return res.status(401).json({ message: 'Admin account not found.' })
      }

      if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
        return res.status(423).json({ message: 'Admin account is temporarily locked.' })
      }

      req.auth = payload
      req.currentAdmin = {
        ...admin,
        email: decryptText(admin.email_encrypted),
        name: decryptText(admin.name_encrypted),
        role: 'admin',
      }
      req.currentPrincipal = req.currentAdmin
      return next()
    }

    const user = authSource === 'supabase'
      ? supabaseAuthService.syncUserFromSupabasePayload(payload)
      : userModel.findById(payload.sub)

    if (!user) {
      return res.status(401).json({ message: 'User not found.' })
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ message: 'Account is temporarily locked.' })
    }

    req.auth = {
      ...payload,
      mfaVerifiedAt: payload.mfaVerifiedAt || new Date().toISOString(),
    }
    req.currentUser = {
      ...user,
      email: decryptText(user.email_encrypted),
      name: decryptText(user.name_encrypted),
    }
    req.currentPrincipal = req.currentUser
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const principal = req.currentPrincipal || req.currentUser || req.currentAdmin
    if (!principal) {
      return res.status(401).json({ message: 'Authentication required.' })
    }

    if (!roles.includes(principal.role)) {
      return res.status(403).json({ message: 'Insufficient role permissions.' })
    }

    return next()
  }
}

function requireRecentMfa(req, res, next) {
  const verifiedAt = req.auth?.mfaVerifiedAt
  if (!verifiedAt) {
    return res.status(403).json({ message: 'MFA verification required.' })
  }

  const ageMs = Date.now() - new Date(verifiedAt).getTime()
  if (ageMs > config.recentMfaMinutes * 60 * 1000) {
    return res.status(403).json({ message: 'Recent MFA verification required.' })
  }

  return next()
}

module.exports = { authRequired, requireRoles, requireRecentMfa }

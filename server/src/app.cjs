const express = require('express')
const cors = require('cors')
const { migrate } = require('./db/migrate.cjs')
const { config } = require('./config/env.cjs')
const { assignRequestMetadata } = require('./middleware/requestMetadataMiddleware.cjs')
const { setSecurityHeaders } = require('./middleware/securityHeadersMiddleware.cjs')
const { enforceTrustedOrigin, isTrustedOrigin } = require('./middleware/originProtectionMiddleware.cjs')
const { asyncHandler } = require('./utils/controller.cjs')

migrate()

const { enforceHttps } = require('./middleware/httpsMiddleware.cjs')
const { createRateLimit } = require('./middleware/rateLimitMiddleware.cjs')
const { authRequired, requireRoles, requireRecentMfa } = require('./middleware/authMiddleware.cjs')
const { claimAccessRequired } = require('./middleware/claimAccessMiddleware.cjs')
const { trackActivity } = require('./middleware/activityMiddleware.cjs')
const adminAuthController = require('./controllers/adminAuthController.cjs')
const authController = require('./controllers/authController.cjs')
const activityController = require('./controllers/activityController.cjs')
const nomineeController = require('./controllers/nomineeController.cjs')
const releaseController = require('./controllers/releaseController.cjs')
const securityController = require('./controllers/securityController.cjs')
const assetController = require('./controllers/assetController.cjs')
const claimController = require('./controllers/claimController.cjs')
const { ensureDemoAdminSeed } = require('./services/adminSeedService.cjs')
const { ensureDemoSeed } = require('./services/demoSeedService.cjs')
const { startReleaseScheduler } = require('./services/releaseService.cjs')

const app = express()
app.set('trust proxy', true)
app.use(assignRequestMetadata)
app.use(cors({
  origin(origin, callback) {
    if (!origin || isTrustedOrigin(origin)) {
      return callback(null, true)
    }

    return callback(new Error('Origin is not allowed by CORS policy.'))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  credentials: false,
}))
app.use(express.json({ limit: '8mb' }))
app.use(setSecurityHeaders)
app.use(enforceHttps)
app.use(enforceTrustedOrigin)
app.use(createRateLimit({ windowMs: config.generalRateWindowMs, max: config.generalRateMax }))

const authLimiter = createRateLimit({
  windowMs: config.authRateWindowMs,
  max: config.authRateMax,
  skip(req) {
    if (config.env !== 'development') {
      return false
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    return email.endsWith('@loom-demo.local')
  },
})
const claimLimiter = createRateLimit({ windowMs: config.authRateWindowMs, max: Math.max(3, Math.floor(config.authRateMax / 2)) })

app.post('/api/auth/signup', authLimiter, asyncHandler(authController.signup))
app.post('/api/auth/login', authLimiter, asyncHandler(authController.login))
app.post('/api/auth/verify-email', authLimiter, asyncHandler(authController.verifyEmail))
app.post('/api/auth/mfa/verify-login', authLimiter, asyncHandler(authController.verifyLogin))
app.post('/admin/login', authLimiter, asyncHandler(adminAuthController.login))
app.post('/api/auth/mfa/challenge', authRequired, trackActivity, asyncHandler(authController.createActionChallenge))
app.post('/api/auth/mfa/verify-action', authRequired, trackActivity, asyncHandler(authController.verifyActionChallenge))
app.post('/api/auth/mfa/totp/setup', authRequired, trackActivity, requireRecentMfa, asyncHandler(authController.startTotpSetup))
app.post('/api/auth/mfa/totp/enable', authRequired, trackActivity, requireRecentMfa, asyncHandler(authController.enableTotp))

app.post('/api/claim/request', claimLimiter, asyncHandler(claimController.requestOtp))
app.post('/api/claim/verify-otp', claimLimiter, asyncHandler(claimController.verifyOtp))
app.post('/api/claim/submit', claimLimiter, asyncHandler(claimController.submitClaim))
app.post('/api/claim/status', asyncHandler(claimController.status))
app.post('/api/claim/approve', claimLimiter, asyncHandler(claimController.approve))
app.get('/api/claim/access/assets', claimAccessRequired, asyncHandler(claimController.accessAssets))

app.get('/api/protected/me', authRequired, trackActivity, asyncHandler(authController.me))
app.patch('/api/protected/me', authRequired, trackActivity, asyncHandler(authController.updateProfile))
app.get('/api/protected/dashboard', authRequired, trackActivity, (_req, res) => res.json({ ok: true }))
app.get('/api/protected/admin', authRequired, trackActivity, requireRoles('admin'), (_req, res) => res.json({ ok: true }))
app.get('/api/activity-logs', authRequired, trackActivity, asyncHandler(activityController.listLogs))
app.get('/api/security/posture', authRequired, trackActivity, requireRoles('user', 'admin'), asyncHandler(securityController.getPosture))
app.post('/api/security/inactivity-timer', authRequired, trackActivity, requireRoles('user', 'admin'), requireRecentMfa, asyncHandler(securityController.updateInactivityTimer))

app.get('/api/nominees', authRequired, trackActivity, requireRoles('user', 'admin'), asyncHandler(nomineeController.listNominees))
app.post('/api/nominees', authRequired, trackActivity, requireRoles('user', 'admin'), requireRecentMfa, asyncHandler(nomineeController.addNominee))
app.post('/api/nominees/threshold', authRequired, trackActivity, requireRoles('user', 'admin'), requireRecentMfa, asyncHandler(nomineeController.updateThreshold))

app.get('/api/assets', authRequired, trackActivity, requireRoles('user', 'nominee', 'admin'), asyncHandler(assetController.listAssets))
app.post('/api/assets', authRequired, trackActivity, requireRoles('user', 'admin'), requireRecentMfa, asyncHandler(assetController.createAsset))
app.get('/api/assets/:assetId', authRequired, trackActivity, requireRecentMfa, asyncHandler(assetController.getAsset))
app.post('/api/assets/:assetId/signed-url', authRequired, trackActivity, requireRecentMfa, asyncHandler(assetController.createSignedDownloadUrl))
app.post('/api/assets/:assetId/transfer', authRequired, trackActivity, requireRoles('user', 'admin'), requireRecentMfa, asyncHandler(assetController.transferAsset))
app.get('/api/files/:fileId', authRequired, trackActivity, requireRecentMfa, asyncHandler(assetController.downloadFile))

app.get('/api/release/status', authRequired, trackActivity, requireRoles('user', 'admin'), asyncHandler(releaseController.status))
app.post('/api/release/trigger', authRequired, trackActivity, requireRoles('user', 'admin'), requireRecentMfa, asyncHandler(releaseController.trigger))
app.post('/api/release/cancel', authRequired, trackActivity, requireRoles('user', 'admin'), requireRecentMfa, asyncHandler(releaseController.cancel))
app.post('/api/release/:requestId/approve', authRequired, trackActivity, requireRoles('nominee', 'admin'), requireRecentMfa, asyncHandler(releaseController.approve))

app.use((error, _req, res, _next) => {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500
  console.error('[api-error]', {
    message: error?.message,
    stack: error?.stack,
  })
  if (error.message === 'Origin is not allowed by CORS policy.') {
    return res.status(403).json({ message: error.message })
  }

  return res.status(status).json({
    message: status >= 500 ? 'Internal server error.' : error?.message || 'Request failed.',
  })
})

startReleaseScheduler()
const startup = Promise.all([
  ensureDemoAdminSeed(),
  ensureDemoSeed(),
]).catch((error) => {
  console.error('Unable to complete API startup seeding.', error)
  throw error
})

module.exports = { app, startup }

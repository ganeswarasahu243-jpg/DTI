const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..', '..')
const workspaceRootDir = path.resolve(rootDir, '..')
const dataDir = path.join(rootDir, 'data')
const storageDir = path.join(rootDir, 'storage')
const privateUploadsDir = path.join(storageDir, 'private')
const claimProofsDir = path.join(storageDir, 'claim-proofs')
const envFilePath = path.join(rootDir, '.env')
const workspaceEnvFilePath = path.join(workspaceRootDir, '.env')

loadEnvFile(envFilePath)
loadEnvFile(workspaceEnvFilePath)

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1')

    if (key && process.env[key] == null) {
      process.env[key] = value
    }
  }
}

function toNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function flag(value, fallback = false) {
  if (value == null) {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

function parseCsv(value, fallback = []) {
  if (!value) {
    return fallback
  }

  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function readSecret(name, { minLength = 32, bytes = 32 } = {}) {
  const value = process.env[name]
  if (typeof value === 'string' && value.trim().length >= minLength) {
    return value.trim()
  }

  if (flag(process.env.ALLOW_INSECURE_DEV_DEFAULTS, false) && (process.env.NODE_ENV || 'development') === 'development') {
    return crypto.randomBytes(bytes).toString('base64url')
  }

  throw new Error(`${name} must be set to a strong secret in the environment.`)
}

function parseEncryptionKey(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return null
  }

  if (normalized.startsWith('base64:')) {
    return Buffer.from(normalized.slice('base64:'.length), 'base64')
  }

  if (normalized.startsWith('hex:')) {
    return Buffer.from(normalized.slice('hex:'.length), 'hex')
  }

  return Buffer.from(normalized, 'utf8')
}

function readEncryptionKey() {
  const raw = process.env.ENCRYPTION_KEY
  const parsed = parseEncryptionKey(raw)
  if (parsed?.length === 32) {
    return parsed
  }

  if (flag(process.env.ALLOW_INSECURE_DEV_DEFAULTS, false) && (process.env.NODE_ENV || 'development') === 'development') {
    return crypto.randomBytes(32)
  }

  throw new Error(
    'ENCRYPTION_KEY must be provided as a 32-byte key. Use base64:<value> or hex:<value>.',
  )
}

function readInactivityOptions() {
  const values = parseCsv(process.env.INACTIVITY_TIMER_OPTIONS_DAYS, ['30', '60', '90'])
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0)

  return values.length > 0 ? [...new Set(values)].sort((a, b) => a - b) : [30, 60, 90]
}

const env = process.env.NODE_ENV || 'development'
const defaultAppBaseUrl = env === 'development' ? 'http://localhost:5173' : 'https://loom.local'
const appBaseUrl = process.env.APP_BASE_URL || defaultAppBaseUrl
const defaultAllowedOrigins = env === 'development'
  ? [appBaseUrl, 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']
  : [appBaseUrl]
const explicitAllowedOrigins = parseCsv(process.env.ALLOWED_ORIGINS)
const allowedOrigins = env === 'development'
  ? [...new Set([...defaultAllowedOrigins, ...explicitAllowedOrigins])]
  : [...new Set(explicitAllowedOrigins.length > 0 ? explicitAllowedOrigins : defaultAllowedOrigins)]
const inactivityTimerOptionsDays = readInactivityOptions()
const defaultInactivityThresholdDays = toNumber(
  process.env.INACTIVITY_THRESHOLD_DAYS,
  inactivityTimerOptionsDays.includes(60) ? 60 : inactivityTimerOptionsDays[0],
)

const config = {
  env,
  port: toNumber(process.env.AUTH_PORT, 4000),
  jwtSecret: readSecret('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  pendingTokenExpiresInMinutes: toNumber(process.env.PENDING_TOKEN_TTL_MINUTES, 10),
  encryptionKey: readEncryptionKey(),
  signedUrlSecret: readSecret('SIGNED_URL_SECRET'),
  auditLogSecret: readSecret('AUDIT_LOG_SECRET'),
  claimAccessSecret: readSecret('CLAIM_ACCESS_SECRET'),
  demoAdminEmail: process.env.DEMO_ADMIN_EMAIL || 'demo_admin@loom.local',
  demoAdminPassword: process.env.DEMO_ADMIN_PASSWORD || 'Demo@1234',
  demoAdminName: process.env.DEMO_ADMIN_NAME || 'Demo Admin Access',
  demoAdminResetOnBoot: flag(process.env.DEMO_ADMIN_RESET_ON_BOOT, false),
  otpTtlSeconds: toNumber(process.env.OTP_TTL_SECONDS, 90),
  otpMaxAttempts: toNumber(process.env.OTP_MAX_ATTEMPTS, 3),
  claimOtpTtlSeconds: toNumber(process.env.CLAIM_OTP_TTL_SECONDS, 300),
  claimOtpMaxAttempts: toNumber(process.env.CLAIM_OTP_MAX_ATTEMPTS, 3),
  claimAccessTokenMinutes: toNumber(process.env.CLAIM_ACCESS_TOKEN_MINUTES, 10),
  claimApprovalTokenHours: toNumber(process.env.CLAIM_APPROVAL_TOKEN_HOURS, 12),
  claimStatusPollSeconds: toNumber(process.env.CLAIM_STATUS_POLL_SECONDS, 5),
  emailVerificationTtlSeconds: toNumber(process.env.EMAIL_VERIFICATION_TTL_SECONDS, 600),
  claimIdProofLimitBytes: toNumber(process.env.CLAIM_ID_PROOF_LIMIT_BYTES, 3 * 1024 * 1024),
  claimDemoTimerOptionsMinutes: parseCsv(process.env.CLAIM_DEMO_TIMER_OPTIONS_MINUTES, ['3', '5', '10'])
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0),
  recentMfaMinutes: toNumber(process.env.RECENT_MFA_MINUTES, 10),
  inactivityThresholdDays: defaultInactivityThresholdDays,
  inactivityTimerOptionsDays,
  releaseGraceDays: toNumber(process.env.RELEASE_GRACE_DAYS, 7),
  releaseAlertCount: toNumber(process.env.RELEASE_ALERT_COUNT, 3),
  releaseSweepMs: toNumber(process.env.RELEASE_SWEEP_MS, 60_000),
  releaseVerificationWindowMinutes: toNumber(process.env.RELEASE_VERIFICATION_WINDOW_MINUTES, 15),
  authRateWindowMs: toNumber(process.env.AUTH_RATE_WINDOW_MS, 15 * 60 * 1000),
  authRateMax: toNumber(process.env.AUTH_RATE_MAX, 20),
  generalRateWindowMs: toNumber(process.env.GENERAL_RATE_WINDOW_MS, 60 * 1000),
  generalRateMax: toNumber(process.env.GENERAL_RATE_MAX, 120),
  suspiciousLoginThreshold: toNumber(process.env.SUSPICIOUS_LOGIN_THRESHOLD, 70),
  suspiciousLoginLockMinutes: toNumber(process.env.SUSPICIOUS_LOGIN_LOCK_MINUTES, 30),
  failedLoginLockThreshold: toNumber(process.env.FAILED_LOGIN_LOCK_THRESHOLD, 5),
  failedLoginLockMinutes: toNumber(process.env.FAILED_LOGIN_LOCK_MINUTES, 15),
  fileSizeLimitBytes: toNumber(process.env.FILE_SIZE_LIMIT_BYTES, 5 * 1024 * 1024),
  enforceHttps: flag(process.env.ENFORCE_HTTPS, env === 'production'),
  appBaseUrl,
  allowedOrigins,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: toNumber(process.env.SMTP_PORT, 465),
    secure: flag(process.env.SMTP_SECURE, true),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@loom.local',
  },
  supabase: {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
  },
  allowedFileTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  allowedClaimProofTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  dataDir,
  storageDir,
  privateUploadsDir,
  claimProofsDir,
  databasePath: path.join(dataDir, 'loom.sqlite'),
}

module.exports = { config }

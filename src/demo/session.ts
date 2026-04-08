import type { ActivityLog } from '../activity/api'
import type { AuthChallengePurpose, AuthChallengeResponse, AuthResponse, AuthUser } from '../auth/types'
import type { AssetSummary } from '../assets/api'
import type { NomineeSummary } from '../nominees/api'
import type { SecurityPosture } from '../security/api'

const DEMO_PASSWORD = 'DemoPass123!'
const DEMO_TOKEN_PREFIX = 'demo-token:'
const DEMO_OTP = '123456'

const STORAGE_KEYS = {
  assets: 'loom.demo.assets',
  activity: 'loom.demo.activity',
  nominees: 'loom.demo.nominees',
}

const demoUsers: AuthUser[] = [
  {
    id: 'demo-owner',
    email: 'owner@loom-demo.local',
    role: 'user',
    name: 'Olivia Owner',
    emailVerifiedAt: new Date('2026-04-01T09:00:00.000Z').toISOString(),
    phone: '+15550000001',
    riskScore: 18,
    preferredOtpChannel: 'email',
    trustedCircleThreshold: 2,
    inactivityTimerDays: 30,
    mfa: {
      email: true,
      totp: false,
    },
  },
  {
    id: 'demo-priya',
    email: 'priya@loom-demo.local',
    role: 'nominee',
    name: 'Priya Nominee',
    emailVerifiedAt: new Date('2026-04-01T09:05:00.000Z').toISOString(),
    phone: '+15550000002',
    riskScore: 12,
    preferredOtpChannel: 'email',
    trustedCircleThreshold: 2,
    inactivityTimerDays: 30,
    mfa: {
      email: true,
      totp: false,
    },
  },
  {
    id: 'demo-marcus',
    email: 'marcus@loom-demo.local',
    role: 'nominee',
    name: 'Marcus Nominee',
    emailVerifiedAt: new Date('2026-04-01T09:10:00.000Z').toISOString(),
    phone: '+15550000003',
    riskScore: 10,
    preferredOtpChannel: 'sms',
    trustedCircleThreshold: 2,
    inactivityTimerDays: 30,
    mfa: {
      email: false,
      totp: false,
    },
  },
]

const initialAssets: AssetSummary[] = [
  {
    id: 'demo-asset-1',
    title: 'Family Trust Ledger',
    type: 'Trust Document',
    details: 'Primary trust allocation, trustee instructions, and beneficiary distribution notes.',
    financialData: 'Portfolio reserve: $410,000. Settlement account reference ending in 1902.',
    hasFile: false,
    fileMimeType: null,
    createdAt: '2026-04-02T08:00:00.000Z',
    updatedAt: '2026-04-07T10:20:00.000Z',
    ownerName: 'Olivia Owner',
    ownerEmail: 'owner@loom-demo.local',
  },
  {
    id: 'demo-asset-2',
    title: 'Digital Wallet Custody Notes',
    type: 'Digital Asset',
    details: 'Custody process, multisig recovery instructions, and exchange transfer checklist.',
    financialData: 'Treasury wallet reserve: 12.45 BTC equivalent under estate governance.',
    hasFile: false,
    fileMimeType: null,
    createdAt: '2026-04-03T08:00:00.000Z',
    updatedAt: '2026-04-07T16:45:00.000Z',
    ownerName: 'Olivia Owner',
    ownerEmail: 'owner@loom-demo.local',
  },
]

const initialNominees: NomineeSummary = {
  threshold: 2,
  minimumThreshold: 1,
  nomineeCount: 2,
  nominees: [
    {
      id: 'demo-nominee-1',
      nomineeUserId: 'demo-priya',
      email: 'priya@loom-demo.local',
      name: 'Priya Nominee',
      createdAt: '2026-04-02T09:00:00.000Z',
    },
    {
      id: 'demo-nominee-2',
      nomineeUserId: 'demo-marcus',
      email: 'marcus@loom-demo.local',
      name: 'Marcus Nominee',
      createdAt: '2026-04-02T09:05:00.000Z',
    },
  ],
}

const initialActivity: ActivityLog[] = [
  {
    id: 'demo-log-1',
    requestId: 'demo-request-1',
    eventType: 'AUTH_LOGIN_SUCCESS',
    ipAddress: '127.0.0.1',
    deviceInfo: 'Demo Browser',
    locationHint: 'Local demo',
    severity: 'info',
    message: 'Demo owner access verified and workspace unlocked.',
    metadata: { source: 'demo-mode' },
    integrityHash: null,
    createdAt: '2026-04-08T07:30:00.000Z',
  },
  {
    id: 'demo-log-2',
    requestId: 'demo-request-2',
    eventType: 'TRUSTED_CIRCLE_READY',
    ipAddress: '127.0.0.1',
    deviceInfo: 'Demo Browser',
    locationHint: 'Local demo',
    severity: 'info',
    message: 'Trusted circle is configured with two nominee approvals.',
    metadata: { source: 'demo-mode' },
    integrityHash: null,
    createdAt: '2026-04-08T06:00:00.000Z',
  },
  {
    id: 'demo-log-3',
    requestId: 'demo-request-3',
    eventType: 'ASSET_REVIEWED',
    ipAddress: '127.0.0.1',
    deviceInfo: 'Demo Browser',
    locationHint: 'Local demo',
    severity: 'info',
    message: 'Vault asset integrity review completed successfully.',
    metadata: { source: 'demo-mode' },
    integrityHash: null,
    createdAt: '2026-04-07T17:00:00.000Z',
  },
]

function canUseStorage() {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback
  }

  try {
    const raw = globalThis.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) {
    return
  }

  globalThis.localStorage.setItem(key, JSON.stringify(value))
}

function cloneUser(user: AuthUser) {
  return JSON.parse(JSON.stringify(user)) as AuthUser
}

export function isDemoEmail(email: string) {
  return demoUsers.some((user) => user.email === email.trim().toLowerCase())
}

export function isDemoToken(token: string | null | undefined) {
  return Boolean(token?.startsWith(DEMO_TOKEN_PREFIX))
}

export function getDemoUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = demoUsers.find((entry) => entry.email === normalizedEmail)
  return user ? cloneUser(user) : null
}

export function getDemoUserFromToken(token: string) {
  if (!isDemoToken(token)) {
    return null
  }

  const email = token.slice(DEMO_TOKEN_PREFIX.length)
  return getDemoUserByEmail(email)
}

export function authenticateDemoUser(payload: { email: string; password: string }): AuthResponse {
  const user = getDemoUserByEmail(payload.email)

  if (!user || payload.password !== DEMO_PASSWORD) {
    throw new Error('Invalid demo credentials.')
  }

  return {
    token: `${DEMO_TOKEN_PREFIX}${user.email}`,
    user,
    requiresMfa: false,
  }
}

export function createDemoChallenge(purpose: Exclude<AuthChallengePurpose, 'login' | 'email-verification'>): AuthChallengeResponse {
  return {
    purpose,
    challengeId: `demo-${purpose}`,
    channel: 'email',
    pendingToken: `demo-pending-${purpose}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    devOtp: DEMO_OTP,
    requiresMfa: true,
  }
}

export function verifyDemoOtp(code: string) {
  if (code !== DEMO_OTP) {
    throw new Error('Invalid demo OTP.')
  }
}

export function getDemoAssets(token: string) {
  const user = getDemoUserFromToken(token)
  const assets = readJson(STORAGE_KEYS.assets, initialAssets)

  if (!user) {
    return []
  }

  return assets.map((asset) => ({
    ...asset,
    ownerName: asset.ownerName || 'Olivia Owner',
    ownerEmail: asset.ownerEmail || 'owner@loom-demo.local',
  }))
}

export function getDemoAssetsByEmail(email: string) {
  const user = getDemoUserByEmail(email)

  if (!user) {
    return []
  }

  const assets = readJson(STORAGE_KEYS.assets, initialAssets)
  return assets.map((asset) => ({
    ...asset,
    ownerName: asset.ownerName || 'Olivia Owner',
    ownerEmail: asset.ownerEmail || 'owner@loom-demo.local',
  }))
}

export function getDemoAsset(assetId: string, token: string) {
  const assets = getDemoAssets(token)
  return assets.find((asset) => asset.id === assetId) || null
}

export function getDemoAssetByEmail(assetId: string, email: string) {
  const assets = getDemoAssetsByEmail(email)
  return assets.find((asset) => asset.id === assetId) || null
}

export function createDemoAsset(
  payload: {
    title: string
    type: string
    details: string
    financialData?: string
    file?: {
      name: string
      mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'
      base64: string
    }
  },
  token: string,
) {
  const user = getDemoUserFromToken(token)

  if (!user || user.role === 'nominee') {
    throw new Error('Only the owner demo account can add assets.')
  }

  const assets = getDemoAssets(token)
  const assetId = `demo-asset-${Date.now()}`
  const timestamp = new Date().toISOString()
  const nextAsset: AssetSummary = {
    id: assetId,
    title: payload.title.trim(),
    type: payload.type.trim(),
    details: payload.details.trim(),
    financialData: payload.financialData?.trim() || null,
    hasFile: Boolean(payload.file),
    fileMimeType: payload.file?.mimeType || null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ownerName: user.name,
    ownerEmail: user.email,
  }

  writeJson(STORAGE_KEYS.assets, [nextAsset, ...assets])
  return { assetId }
}

export function getDemoActivityLogs() {
  return readJson(STORAGE_KEYS.activity, initialActivity)
}

export function getDemoNominees(token: string) {
  const user = getDemoUserFromToken(token)

  if (!user) {
    throw new Error('Authentication required.')
  }

  return readJson(STORAGE_KEYS.nominees, initialNominees)
}

export function addDemoNominee(payload: { name: string; email: string }, token: string) {
  const user = getDemoUserFromToken(token)

  if (!user || user.role === 'nominee') {
    throw new Error('Only the owner demo account can add nominees.')
  }

  const current = getDemoNominees(token)
  const nextNominee = {
    id: `demo-nominee-${Date.now()}`,
    nomineeUserId: null,
    email: payload.email.trim().toLowerCase(),
    name: payload.name.trim(),
    createdAt: new Date().toISOString(),
  }
  const next = {
    ...current,
    nomineeCount: current.nominees.length + 1,
    nominees: [...current.nominees, nextNominee],
  }

  writeJson(STORAGE_KEYS.nominees, next)
  return next
}

export function updateDemoThreshold(payload: { threshold: number }, token: string) {
  const user = getDemoUserFromToken(token)

  if (!user || user.role === 'nominee') {
    throw new Error('Only the owner demo account can update threshold settings.')
  }

  const current = getDemoNominees(token)
  const maxThreshold = Math.max(current.nominees.length, 1)
  const threshold = Math.max(current.minimumThreshold, Math.min(payload.threshold, maxThreshold))
  const next = { ...current, threshold }
  writeJson(STORAGE_KEYS.nominees, next)
  return {
    threshold,
    minimumThreshold: current.minimumThreshold,
  }
}

export function updateDemoProfile(
  payload: {
    name: string
    phone?: string | null
    preferredOtpChannel: 'email' | 'sms'
  },
  token: string,
) {
  const current = getDemoUserFromToken(token)

  if (!current) {
    throw new Error('Authentication required.')
  }

  const nextUser: AuthUser = {
    ...current,
    name: payload.name.trim() || current.name,
    phone: payload.phone?.trim() || null,
    preferredOtpChannel: payload.preferredOtpChannel,
  }

  return nextUser
}

export function getDemoSecurityPosture(token: string): SecurityPosture {
  const user = getDemoUserFromToken(token)
  const nominees = getDemoNominees(token)

  return {
    mfa: {
      email: Boolean(user?.mfa?.email),
      totp: Boolean(user?.mfa?.totp),
      recentWindowMinutes: 15,
    },
    risk: {
      lockedUntil: null,
      flaggedAt: user?.flaggedAt || null,
      flaggedReason: user?.flaggedReason || null,
      riskScore: user?.riskScore || 12,
    },
    deadManSwitch: {
      timerDays: user?.inactivityTimerDays || 30,
      allowedOptionsDays: [15, 30, 45, 60, 90],
      activeRequest: null,
    },
    trustedCircle: {
      nomineeCount: nominees.nomineeCount,
      minimumThreshold: nominees.minimumThreshold,
      effectiveThreshold: nominees.threshold,
    },
    zeroTrust: {
      transport: 'TLS 1.3',
      auth: 'Demo token with local MFA preview',
      audit: 'Local demo activity log',
    },
  }
}

export function updateDemoInactivityTimer(days: number, token: string) {
  const user = getDemoUserFromToken(token)

  if (!user) {
    throw new Error('Authentication required.')
  }

  return {
    inactivityTimerDays: Math.max(15, Math.min(days, 90)),
  }
}

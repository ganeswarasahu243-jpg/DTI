import {
  addDemoNominee,
  createDemoAsset,
  createDemoChallenge,
  getDemoActivityLogs,
  getDemoAsset,
  getDemoAssets,
  getDemoNominees,
  getDemoSecurityPosture,
  getDemoUserFromToken,
  isDemoToken,
  updateDemoInactivityTimer,
  updateDemoProfile,
  updateDemoThreshold,
  verifyDemoOtp,
} from '../demo/session'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || ''

type ApiRequestOptions = RequestInit & {
  token?: string | null
}

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function buildUrl(input: string | URL) {
  if (input instanceof URL) {
    return input.toString()
  }

  if (/^https?:\/\//i.test(input)) {
    return input
  }

  return `${API_BASE_URL}${input}`
}

function getPathname(input: string | URL) {
  if (input instanceof URL) {
    return input.pathname
  }

  if (/^https?:\/\//i.test(input)) {
    return new URL(input).pathname
  }

  return input
}

async function resolveDemoRequest<T>(input: string | URL, options: ApiRequestOptions): Promise<T> {
  const token = options.token as string
  const method = (options.method || 'GET').toUpperCase()
  const path = getPathname(input)
  const parseBody = () => {
    if (!options.body || typeof options.body !== 'string') {
      return null
    }

    try {
      return JSON.parse(options.body)
    } catch {
      return null
    }
  }

  if (path === '/api/protected/me' && method === 'GET') {
    return { user: getDemoUserFromToken(token) } as T
  }

  if (path === '/api/assets' && method === 'GET') {
    const assets = getDemoAssets(token)
    return { assets, count: assets.length } as T
  }

  if (path.startsWith('/api/assets/') && method === 'GET') {
    const assetId = decodeURIComponent(path.slice('/api/assets/'.length))
    const asset = getDemoAsset(assetId, token)

    if (!asset) {
      throw new ApiError('Asset not found.', 404)
    }

    return asset as T
  }

  if (path === '/api/assets' && method === 'POST') {
    return createDemoAsset(parseBody(), token) as T
  }

  if (path === '/api/activity-logs' && method === 'GET') {
    return { logs: getDemoActivityLogs() } as T
  }

  if (path === '/api/nominees' && method === 'GET') {
    return getDemoNominees(token) as T
  }

  if (path === '/api/nominees' && method === 'POST') {
    return addDemoNominee(parseBody(), token) as T
  }

  if (path === '/api/nominees/threshold' && method === 'POST') {
    return updateDemoThreshold(parseBody(), token) as T
  }

  if (path === '/api/security/posture' && method === 'GET') {
    return getDemoSecurityPosture(token) as T
  }

  if (path === '/api/security/inactivity-timer' && method === 'POST') {
    return updateDemoInactivityTimer(parseBody()?.days, token) as T
  }

  if (path === '/api/protected/me' && method === 'PATCH') {
    return { user: updateDemoProfile(parseBody(), token) } as T
  }

  if (path === '/api/auth/mfa/challenge' && method === 'POST') {
    return createDemoChallenge(parseBody()?.purpose) as T
  }

  if (path === '/api/auth/mfa/verify-action' && method === 'POST') {
    verifyDemoOtp(parseBody()?.code)
    const user = getDemoUserFromToken(token)
    if (!user) {
      throw new ApiError('Authentication required.', 401)
    }
    return {
      token,
      user,
      requiresMfa: false,
    } as T
  }

  throw new ApiError('This demo action is not available in offline mode yet.', 501)
}

export async function apiRequest<T>(input: string | URL, options: ApiRequestOptions = {}): Promise<T> {
  const { token, headers, ...init } = options
  const requestHeaders = new Headers(headers || {})
  const tokenWasProvided = Object.prototype.hasOwnProperty.call(options, 'token')

  if (tokenWasProvided && !token) {
    throw new ApiError('Authentication required. Please sign in again.', 401)
  }

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
  }

  if (init.body && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  if (token && isDemoToken(token)) {
    return resolveDemoRequest<T>(input, options)
  }

  let response: Response

  try {
    response = await fetch(buildUrl(input), {
      ...init,
      headers: requestHeaders,
    })
  } catch {
    throw new ApiError('Unable to reach the LOOM API. Start the backend with `npm run dev:api` and try again.', 0)
  }

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await response.json().catch(() => ({})) : await response.text().catch(() => '')

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string'
        ? data.message
        : 'Request failed.'

    throw new ApiError(message, response.status, data)
  }

  return data as T
}

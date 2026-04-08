import { apiRequest } from '../lib/api'

export type SecurityPosture = {
  mfa: {
    email: boolean
    totp: boolean
    recentWindowMinutes: number
  }
  risk: {
    lockedUntil: string | null
    flaggedAt: string | null
    flaggedReason: string | null
    riskScore: number
  }
  deadManSwitch: {
    timerDays: number
    allowedOptionsDays: number[]
    activeRequest: unknown
  }
  trustedCircle: {
    nomineeCount: number
    minimumThreshold: number
    effectiveThreshold: number
  }
  zeroTrust: {
    transport: string
    auth: string
    audit: string
  }
}

export function fetchSecurityPosture(token: string) {
  return apiRequest<SecurityPosture>('/api/security/posture', { token })
}

export function updateInactivityTimer(days: number, token: string) {
  return apiRequest<{ inactivityTimerDays: number }>('/api/security/inactivity-timer', {
    method: 'POST',
    token,
    body: JSON.stringify({ days }),
  })
}

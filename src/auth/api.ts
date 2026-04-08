import type { AuthChallengePurpose, AuthChallengeResponse, AuthResponse, AuthUser, UserRole } from './types'
import { apiRequest } from '../lib/api'

export function signup(payload: {
  email: string
  password: string
  role: UserRole
  name: string
  phone?: string
  preferredOtpChannel?: 'email' | 'sms'
  inactivityTimerDays?: number
}) {
  return apiRequest<AuthChallengeResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function login(payload: { email: string; password: string }) {
  return apiRequest<AuthChallengeResponse | AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function verifyLoginMfa(payload: { pendingToken: string; challengeId: string; code: string }) {
  return apiRequest<AuthResponse>('/api/auth/mfa/verify-login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function verifyEmail(payload: { pendingToken: string; challengeId: string; code: string }) {
  return apiRequest<AuthResponse>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createActionMfaChallenge(payload: { purpose: Exclude<AuthChallengePurpose, 'login' | 'email-verification'> }, token: string) {
  return apiRequest<AuthChallengeResponse>('/api/auth/mfa/challenge', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export function verifyActionMfa(payload: { challengeId: string; code: string }, token: string) {
  return apiRequest<AuthResponse>('/api/auth/mfa/verify-action', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export function fetchCurrentUser(token: string) {
  return apiRequest<{ user: AuthUser }>('/api/protected/me', { token })
}

export function updateCurrentUserProfile(payload: {
  name: string
  phone?: string | null
  preferredOtpChannel: 'email' | 'sms'
}, token: string) {
  return apiRequest<{ user: AuthUser }>('/api/protected/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  })
}

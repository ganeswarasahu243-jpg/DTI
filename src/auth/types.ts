export type UserRole = 'user' | 'nominee' | 'admin'
export type AuthMode = 'local' | 'supabase'
export type AuthChallengePurpose =
  | 'login'
  | 'email-verification'
  | 'asset-access'
  | 'nominee-change'
  | 'release-trigger'
  | 'file-access'
  | 'transfer'

export type AuthUser = {
  id: string
  email: string
  role: UserRole
  name: string
  emailVerifiedAt?: string | null
  phone?: string | null
  flaggedAt?: string | null
  flaggedReason?: string | null
  lockedUntil?: string | null
  riskScore?: number
  preferredOtpChannel?: 'email' | 'sms'
  trustedCircleThreshold?: number
  inactivityTimerDays?: number
  mfa?: {
    email: boolean
    totp: boolean
  }
}

export type AuthResponse = {
  token: string
  user: AuthUser
  requiresMfa?: false
}

export type AuthChallengeResponse = {
  purpose: AuthChallengePurpose
  challengeId: string
  channel: 'email' | 'sms' | 'totp'
  pendingToken: string
  expiresAt: string
  devOtp?: string
  requiresMfa?: true
  requiresEmailVerification?: true
}

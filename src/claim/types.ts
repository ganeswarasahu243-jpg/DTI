export type ClaimStatus =
  | 'pending_verification'
  | 'otp_verified'
  | 'pending'
  | 'waiting_for_other_approvals'
  | 'access_granted'
  | 'access_denied'

export type ClaimApproval = {
  id: string
  name: string
  email: string
  approvedAt: string | null
}

export type DevApprovalToken = {
  trustedCircleId: string
  name: string
  email: string
  approvalToken: string
  expiresAt: string
}

export type ClaimSummary = {
  id: string
  status: ClaimStatus
  statusLabel: 'Pending Verification' | 'OTP Verified' | 'Waiting for Other Approvals' | 'Access Granted' | 'Access Denied'
  claimantName: string
  claimantContact: string
  demoTimerMinutes?: number | null
  timerExpiresAt?: string | null
  otpExpiresAt?: string | null
  otpVerifiedAt?: string | null
  approvalThreshold: number
  approvalCount: number
  submittedAt?: string | null
  accessGrantedAt?: string | null
  demoMode: boolean
  demoTimerOptionsMinutes: number[]
  pollIntervalSeconds: number
  approvals: ClaimApproval[]
  portalToken?: string
  accessToken?: string
  accessTokenExpiresInMinutes?: number
  devOtp?: string
  devApprovalTokens?: DevApprovalToken[]
}

export type ClaimAssetsResponse = {
  claimId: string
  ownerUserId: string
  readOnly: true
  assets: Array<{
    id: string
    title: string
    type: string
    details: string
    financialData: string | null
    hasFile: boolean
    updatedAt: string
  }>
}

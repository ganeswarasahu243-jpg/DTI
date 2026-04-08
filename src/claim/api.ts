import type { ClaimAssetsResponse, ClaimSummary } from './types'
import { apiRequest } from '../lib/api'

export function requestClaimOtp(payload: {
  deceasedIdentifier: string
  claimantName: string
  claimantContact: string
}) {
  return apiRequest<ClaimSummary>('/api/claim/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function verifyClaimOtp(payload: { portalToken: string; code: string }) {
  return apiRequest<ClaimSummary>('/api/claim/verify-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function submitClaim(payload: {
  portalToken: string
  timerMinutes: number
  idProof: { name: string; mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'; base64: string }
}) {
  return apiRequest<ClaimSummary>('/api/claim/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchClaimStatus(payload: { portalToken: string }) {
  return apiRequest<ClaimSummary>('/api/claim/status', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function approveClaim(payload: { claimId: string; approvalToken: string }) {
  return apiRequest<{
    claimId: string
    status: ClaimSummary['status']
    statusLabel: ClaimSummary['statusLabel']
    approvalCount: number
    approvalThreshold: number
  }>('/api/claim/approve', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchClaimAssets(accessToken: string) {
  return apiRequest<ClaimAssetsResponse>('/api/claim/access/assets', { token: accessToken })
}

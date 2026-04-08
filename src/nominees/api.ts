import { apiRequest } from '../lib/api'

export type Nominee = {
  id: string
  nomineeUserId: string | null
  email: string
  name: string
  createdAt: string
}

export type NomineeSummary = {
  threshold: number
  minimumThreshold: number
  nomineeCount: number
  nominees: Nominee[]
}

export function fetchNominees(token: string) {
  return apiRequest<NomineeSummary>('/api/nominees', { token })
}

export function addNominee(payload: { name: string; email: string }, token: string) {
  return apiRequest<NomineeSummary>('/api/nominees', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export function updateNomineeThreshold(payload: { threshold: number }, token: string) {
  return apiRequest<{ threshold: number; minimumThreshold: number }>('/api/nominees/threshold', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

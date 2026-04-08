import { apiRequest } from '../lib/api'

export type ActivityLog = {
  id: string
  requestId: string | null
  eventType: string
  ipAddress: string | null
  deviceInfo: string | null
  locationHint: string | null
  severity: string
  message: string
  metadata: unknown
  integrityHash: string | null
  createdAt: string
}

export function fetchActivityLogs(token: string) {
  return apiRequest<{ logs: ActivityLog[] }>('/api/activity-logs', { token })
}

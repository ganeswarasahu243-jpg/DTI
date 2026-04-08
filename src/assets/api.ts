import { apiRequest } from '../lib/api'

export type AssetSummary = {
  id: string
  title: string
  type: string
  details: string
  financialData: string | null
  hasFile: boolean
  fileMimeType: string | null
  createdAt: string
  updatedAt: string
  ownerName?: string | null
  ownerEmail?: string | null
}

export type AssetsResponse = {
  assets: AssetSummary[]
  count: number
}

export function fetchAssets(token: string) {
  return apiRequest<AssetsResponse>('/api/assets', { token })
}

export function fetchAsset(assetId: string, token: string) {
  return apiRequest<AssetSummary>(`/api/assets/${encodeURIComponent(assetId)}`, { token })
}

export function createAsset(
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
  return apiRequest<{ assetId: string }>('/api/assets', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

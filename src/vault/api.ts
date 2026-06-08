import { apiRequest } from '../lib/api'

export type NomineeVaultPreview = {
  id: string
  title: string
  type: string
  updatedAt: string
}

export type NomineeVault = {
  id: string
  ownerUserId: string
  ownerName: string
  ownerEmail: string
  assetCount: number
  eligibleForClaim: boolean
  preview: NomineeVaultPreview[]
}

export type NomineeVaultsResponse = {
  vaults: NomineeVault[]
  count: number
}

export function fetchNomineeVaults(token: string) {
  return apiRequest<NomineeVaultsResponse>('/api/vault/nominee', { token })
}

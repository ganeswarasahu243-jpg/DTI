import { useEffect, useMemo, useState } from 'react'
import { Landmark, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchAssets, type AssetSummary } from '../assets/api'
import { useAuth } from '../auth/AuthContext'
import { requestClaimOtp } from '../claim/api'
import { getDemoAssetsByEmail, isDemoEmail } from '../demo/session'
import { fetchNomineeVaults, type NomineeVault } from '../vault/api'
import { Button } from '../components/ui/Button'
import { PageTransition } from '../components/ui/PageTransition'
import { Reveal } from '../components/ui/Reveal'
import { SecureActionMenu } from '../components/ui/SecureActionMenu'

type VaultStatus = 'Active' | 'Locked' | 'Pending'
type VaultRole = 'Owner' | 'Nominee'

type VaultCardData = {
  id: string
  name: string
  status: VaultStatus
  role: VaultRole
  assetCount: number
  ownerName: string
  ownerEmail: string
  preview: Array<{ id: string; title: string; type: string }>
}

function statusTone(status: VaultStatus) {
  if (status === 'Active') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
  }

  if (status === 'Pending') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-500'
  }

  return 'border-rose-500/30 bg-rose-500/10 text-rose-400'
}

function VaultCard({
  vault,
  onAction,
  loading,
}: {
  vault: VaultCardData
  onAction: (vault: VaultCardData) => void
  loading?: boolean
}) {
  return (
    <article className="card-hover rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_20px_50px_-36px_rgba(56,189,248,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-semibold text-[var(--text-primary)]">{vault.name}</p>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone(vault.status)}`}>
          {vault.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2">
          Role: <span className="font-semibold text-[var(--text-primary)]">{vault.role}</span>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2">
          Assets: <span className="font-semibold text-[var(--text-primary)]">{vault.assetCount}</span>
        </div>
      </div>

      {vault.role === 'Nominee' ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3 text-sm text-[var(--text-secondary)]">
          <p>
            Owner: <span className="font-semibold text-[var(--text-primary)]">{vault.ownerName}</span>
          </p>
          {vault.preview.length ? (
            <div className="mt-2 space-y-1">
              {vault.preview.map((item) => (
                <p key={item.id} className="truncate">
                  {item.title} ({item.type})
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2">No preview available yet.</p>
          )}
        </div>
      ) : null}

      <div className="mt-5">
        <Button onClick={() => onAction(vault)} className="w-full sm:w-auto" disabled={loading}>
          {loading
            ? 'Starting...'
            : vault.role === 'Owner'
              ? 'Open Vault'
              : 'Access Vault'}
        </Button>
      </div>
    </article>
  )
}

function toOwnerVaultCard(userEmail: string, assets: AssetSummary[]): VaultCardData {
  return {
    id: 'vault-owner-primary',
    name: 'My Vault',
    status: assets.length ? 'Active' : 'Pending',
    role: 'Owner',
    assetCount: assets.length,
    ownerName: 'You',
    ownerEmail: userEmail,
    preview: assets.slice(0, 3).map((asset) => ({ id: asset.id, title: asset.title, type: asset.type })),
  }
}

function toNomineeCard(vault: NomineeVault): VaultCardData {
  return {
    id: vault.id,
    name: `${vault.ownerName} Vault`,
    status: vault.assetCount > 0 ? 'Active' : 'Locked',
    role: 'Nominee',
    assetCount: vault.assetCount,
    ownerName: vault.ownerName,
    ownerEmail: vault.ownerEmail,
    preview: vault.preview.map((item) => ({ id: item.id, title: item.title, type: item.type })),
  }
}

export default function DigitalVaultPage() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [nomineeVaults, setNomineeVaults] = useState<NomineeVault[]>([])
  const [error, setError] = useState('')
  const [openOwnerVaultId, setOpenOwnerVaultId] = useState<string | null>(null)
  const [accessingVaultId, setAccessingVaultId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAssets() {
      if (!token || !user) {
        return
      }

      try {
        const response = await fetchAssets(token)
        if (!cancelled) {
          setAssets(response.assets)
          setError('')
        }
      } catch (loadError) {
        const fallbackAssets = user.email && isDemoEmail(user.email) ? getDemoAssetsByEmail(user.email) : []
        if (!cancelled) {
          if (fallbackAssets.length) {
            setAssets(fallbackAssets)
            setError('')
          } else {
            setAssets([])
            setError(loadError instanceof Error ? loadError.message : 'Unable to load vaults.')
          }
        }
      }
    }

    loadAssets()
    return () => {
      cancelled = true
    }
  }, [token, user])

  useEffect(() => {
    let cancelled = false

    async function loadNomineeVaults() {
      if (!token || !user) {
        return
      }

      console.log('[digital-vault-debug] loggedInUserId =', user.id)

      try {
        const response = await fetchNomineeVaults(token)
        console.log('[digital-vault-debug] nomineeVaults response =', response)
        if (!cancelled) {
          setNomineeVaults(response.vaults)
        }
      } catch (loadError) {
        if (!cancelled) {
          setNomineeVaults([])
          setError((prev) => prev || (loadError instanceof Error ? loadError.message : 'Unable to load nominee vaults.'))
        }
      }
    }

    loadNomineeVaults()

    return () => {
      cancelled = true
    }
  }, [token, user])

  const ownerEmail = user?.email || ''

  const myVaults = useMemo(() => {
    if (!user || (user.role !== 'user' && user.role !== 'admin')) {
      return [] as VaultCardData[]
    }

    const mine = assets.filter((asset) => !asset.ownerEmail || asset.ownerEmail === ownerEmail)
    return [toOwnerVaultCard(ownerEmail, mine)]
  }, [assets, ownerEmail, user])

  const nomineeVaultCards = useMemo(
    () => nomineeVaults.map(toNomineeCard),
    [nomineeVaults],
  )

  const openOwnerAssets = useMemo(() => {
    if (!openOwnerVaultId || !ownerEmail) {
      return []
    }

    return assets.filter((asset) => !asset.ownerEmail || asset.ownerEmail === ownerEmail)
  }, [assets, openOwnerVaultId, ownerEmail])

  const handleOpenOwnerVault = (vault: VaultCardData) => {
    setOpenOwnerVaultId(vault.id)
  }

  async function handleAccessNomineeVault(vault: VaultCardData) {
    if (!user?.name) {
      setError('Profile details are required before starting claim access.')
      return
    }

    if (!user.phone) {
      setError('Add your phone number in Profile before starting claim access.')
      return
    }

    setError('')
    setAccessingVaultId(vault.id)

    try {
      const response = await requestClaimOtp({
        deceasedIdentifier: vault.ownerEmail,
        claimantName: user.name,
        claimantContact: user.phone,
      })

      navigate('/claim-access', {
        state: {
          prefill: {
            deceasedIdentifier: vault.ownerEmail,
            claimantName: user.name,
            claimantContact: user.phone,
          },
          portalToken: response.portalToken || null,
          initialStatus: response,
          sourceVault: {
            ownerName: vault.ownerName,
            ownerEmail: vault.ownerEmail,
          },
        },
      })
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : 'Unable to start claim access for this vault.')
    } finally {
      setAccessingVaultId(null)
    }
  }

  return (
    <PageTransition className="space-y-7">
      <Reveal>
        <section className="section-shell hero-panel rounded-[2rem] p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="eyebrow">Digital Vault</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">Unified vault access workspace</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-secondary)]">
                Manage ownership vaults and nominee-shared access in one clean, verified flow with clear claim status checkpoints.
              </p>
            </div>
            <div className="w-full sm:w-[240px]">
              <SecureActionMenu fullWidth />
            </div>
          </div>
        </section>
      </Reveal>

      <section className="grid gap-6 xl:grid-cols-2">
        <Reveal>
          <div className="panel rounded-[2rem] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Owner Space</p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">My Vault</h2>
              </div>
              <Landmark className="h-5 w-5 text-[var(--accent)]" />
            </div>

            <div className="space-y-4">
              {myVaults.length ? myVaults.map((vault) => (
                <VaultCard key={vault.id} vault={vault} onAction={handleOpenOwnerVault} />
              )) : (
                <div className="rounded-[1.75rem] border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--text-secondary)]">
                  Nominee accounts do not own vaults in this workspace.
                </div>
              )}
            </div>

            {openOwnerVaultId ? (
              <div className="mt-6 rounded-[1.75rem] border border-[var(--border)] bg-[var(--bg-muted)] p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--text-muted)]">Opened vault</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">My Vault Contents</p>
                <div className="mt-4 grid gap-3">
                  {openOwnerAssets.length ? openOwnerAssets.map((asset) => (
                    <div key={asset.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                      <p className="font-semibold text-[var(--text-primary)]">{asset.title}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{asset.type}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-[var(--text-secondary)]">No assets yet. Use Secure Action to add one.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="panel rounded-[2rem] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Nominee Space</p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Nominee Vaults</h2>
              </div>
              <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
            </div>

            <div className="space-y-4">
              {nomineeVaultCards.length ? nomineeVaultCards.map((vault) => (
                <VaultCard
                  key={vault.id}
                  vault={vault}
                  onAction={handleAccessNomineeVault}
                  loading={accessingVaultId === vault.id}
                />
              )) : (
                <div className="rounded-[1.75rem] border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-6 text-sm text-[var(--text-secondary)]">
                  No nominee vaults available
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      {error ? (
        <div className="rounded-[1.5rem] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}
    </PageTransition>
  )
}

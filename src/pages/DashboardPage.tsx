import { useEffect, useMemo, useState } from 'react'
import { Activity, Clock3, Landmark, LockKeyhole, Pencil, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchActivityLogs, type ActivityLog } from '../activity/api'
import { deleteAsset, fetchAssets, updateAsset, type AssetSummary } from '../assets/api'
import { useAuth } from '../auth/AuthContext'
import type { AuthChallengeResponse } from '../auth/types'
import { fetchNominees, type NomineeSummary } from '../nominees/api'
import { fetchSecurityPosture, type SecurityPosture } from '../security/api'
import { getDemoAssetsByEmail, isDemoEmail } from '../demo/session'
import { AnimatedProgressBar } from '../components/ui/AnimatedProgressBar'
import { Button } from '../components/ui/Button'
import { PageTransition } from '../components/ui/PageTransition'
import { Reveal } from '../components/ui/Reveal'
import { SecureActionMenu } from '../components/ui/SecureActionMenu'

const quickActions = [
  { label: 'Open Digital Vault', href: '/digital-vault', icon: Landmark, description: 'View owner vaults, shared access, and current claim eligibility states.' },
  { label: 'Manage Trusted Circle', href: '/nominees', icon: Users, description: 'Update your trusted circle and configure approval responsibilities.' },
  { label: 'Set Timer', href: '/security', icon: Clock3, description: 'Adjust inactivity settings and release verification controls.' },
]
const assetTypes = ['Investment', 'Digital Asset', 'Real Estate', 'Document', 'Trust Document']
type AssetFormState = {
  title: string
  type: string
  financialData: string
  details: string
}

function toAssetForm(asset: AssetSummary): AssetFormState {
  return {
    title: asset.title,
    type: asset.type,
    financialData: asset.financialData || '',
    details: asset.details,
  }
}

export default function DashboardPage() {
  const { user, token, requestActionChallenge, verifyOtp } = useAuth()
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [nominees, setNominees] = useState<NomineeSummary | null>(null)
  const [posture, setPosture] = useState<SecurityPosture | null>(null)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [assetsError, setAssetsError] = useState('')
  const [assetActionError, setAssetActionError] = useState('')
  const [assetActionSuccess, setAssetActionSuccess] = useState('')
  const [editingAsset, setEditingAsset] = useState<AssetSummary | null>(null)
  const [editForm, setEditForm] = useState<AssetFormState>({ title: '', type: 'Investment', financialData: '', details: '' })
  const [deleteTarget, setDeleteTarget] = useState<AssetSummary | null>(null)
  const [assetActionLoading, setAssetActionLoading] = useState<'update' | 'delete' | ''>('')
  const [mfaChallenge, setMfaChallenge] = useState<AuthChallengeResponse | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaIntent, setMfaIntent] = useState<'update' | 'delete' | null>(null)

  async function refreshAssets() {
    if (!token || !user) {
      return
    }

    try {
      const response = await fetchAssets(token)
      setAssets(response.assets)
      setAssetsError('')
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load shared assets.'
      const fallbackAssets = user.email && isDemoEmail(user.email) ? getDemoAssetsByEmail(user.email) : []

      if (fallbackAssets.length) {
        setAssets(fallbackAssets)
        setAssetsError('')
      } else {
        setAssets([])
        setAssetsError(message)
      }
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      if (!token || !user) {
        return
      }

      try {
        const ownerPromises = user.role === 'user' || user.role === 'admin'
          ? Promise.allSettled([fetchNominees(token), fetchSecurityPosture(token)])
          : Promise.resolve([])

        const [activityResult, assetsResult, ownerResults] = await Promise.allSettled([
          fetchActivityLogs(token),
          fetchAssets(token),
          ownerPromises,
        ])

        if (cancelled) {
          return
        }

        if (activityResult.status === 'fulfilled') {
          setLogs(activityResult.value.logs.slice(0, 3))
        } else {
          setLogs([])
        }

        if (assetsResult.status === 'fulfilled') {
          setAssets(assetsResult.value.assets)
          setAssetsError('')
        } else {
          const message = assetsResult.reason instanceof Error ? assetsResult.reason.message : 'Unable to load shared assets.'
          const fallbackAssets = user.email && isDemoEmail(user.email) ? getDemoAssetsByEmail(user.email) : []

          if (fallbackAssets.length) {
            setAssets(fallbackAssets)
            setAssetsError('')
          } else {
            setAssets([])
            setAssetsError(message)
          }
        }

        if (ownerResults.status === 'fulfilled' && Array.isArray(ownerResults.value)) {
          const [nomineesResult, postureResult] = ownerResults.value
          if (nomineesResult?.status === 'fulfilled') {
            setNominees(nomineesResult.value)
          }
          if (postureResult?.status === 'fulfilled') {
            setPosture(postureResult.value)
          }
        }
      } catch {}
    }

    loadDashboard()

    return () => {
      cancelled = true
    }
  }, [token, user])

  const consensusReadiness = useMemo(() => {
    if (!nominees) {
      return 0
    }

    if (nominees.nomineeCount === 0) {
      return 0
    }

    return Math.min(100, Math.round((nominees.threshold / nominees.nomineeCount) * 100))
  }, [nominees])

  const canManageVault = user?.role === 'user' || user?.role === 'admin'
  const isEditFormValid = editForm.title.trim().length >= 3 && editForm.type.trim().length >= 2 && editForm.details.trim().length >= 10

  function openEditModal(asset: AssetSummary) {
    setEditingAsset(asset)
    setEditForm(toAssetForm(asset))
    setAssetActionError('')
    setAssetActionSuccess('')
    setMfaChallenge(null)
    setMfaCode('')
    setMfaIntent(null)
  }

  function closeEditModal() {
    if (assetActionLoading) {
      return
    }

    setEditingAsset(null)
    setMfaChallenge(null)
    setMfaCode('')
    setMfaIntent(null)
  }

  async function requestAssetMfa(intent: 'update' | 'delete', message: string) {
    const challenge = await requestActionChallenge({ purpose: 'asset-access' })
    setMfaIntent(intent)
    setMfaChallenge(challenge)
    setMfaCode('')
    setAssetActionError(message)
  }

  async function performUpdate() {
    if (!token || !editingAsset || !isEditFormValid) {
      return
    }

    const response = await updateAsset(editingAsset.id, {
      title: editForm.title.trim(),
      type: editForm.type.trim(),
      details: editForm.details.trim(),
      financialData: editForm.financialData.trim(),
    }, token)

    setAssets((current) => current.map((asset) => (asset.id === response.asset.id ? response.asset : asset)))
    setEditingAsset(null)
    setAssetActionSuccess('Asset updated successfully.')
    await refreshAssets()
  }

  async function handleUpdateAsset() {
    if (!isEditFormValid) {
      setAssetActionError('Complete the asset name, type, and description before saving.')
      return
    }

    setAssetActionLoading('update')
    setAssetActionError('')
    setAssetActionSuccess('')

    try {
      await performUpdate()
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unable to update the asset.'
      if (message.includes('Recent MFA verification required')) {
        try {
          await requestAssetMfa('update', 'Complete the MFA step below, then we will save the asset update.')
        } catch (challengeError) {
          setAssetActionError(challengeError instanceof Error ? challengeError.message : message)
        }
      } else {
        setAssetActionError(message)
      }
    } finally {
      setAssetActionLoading('')
    }
  }

  async function performDelete() {
    if (!token || !deleteTarget) {
      return
    }

    const removedId = deleteTarget.id
    await deleteAsset(removedId, token)
    setAssets((current) => current.filter((asset) => asset.id !== removedId))
    setDeleteTarget(null)
    setAssetActionSuccess('Asset removed from your portfolio.')
    await refreshAssets()
  }

  async function handleDeleteAsset() {
    setAssetActionLoading('delete')
    setAssetActionError('')
    setAssetActionSuccess('')

    try {
      await performDelete()
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Unable to delete the asset.'
      if (message.includes('Recent MFA verification required')) {
        try {
          await requestAssetMfa('delete', 'Complete the MFA step below, then we will remove this asset.')
        } catch (challengeError) {
          setAssetActionError(challengeError instanceof Error ? challengeError.message : message)
        }
      } else {
        setAssetActionError(message)
      }
    } finally {
      setAssetActionLoading('')
    }
  }

  async function handleVerifyAssetMfa() {
    if (!mfaChallenge || !mfaIntent || mfaCode.length !== 6) {
      return
    }

    setAssetActionLoading(mfaIntent)
    setAssetActionError('')
    setAssetActionSuccess('')

    try {
      await verifyOtp({
        pendingToken: mfaChallenge.pendingToken,
        challengeId: mfaChallenge.challengeId,
        code: mfaCode,
        purpose: mfaChallenge.purpose,
      })

      if (mfaIntent === 'update') {
        await performUpdate()
      } else {
        await performDelete()
      }

      setMfaChallenge(null)
      setMfaCode('')
      setMfaIntent(null)
    } catch (verifyError) {
      setAssetActionError(verifyError instanceof Error ? verifyError.message : 'Unable to verify MFA.')
    } finally {
      setAssetActionLoading('')
    }
  }

  return (
    <PageTransition className="space-y-6">
      <Reveal>
        <section className="section-shell hero-panel rounded-[2rem] p-6 sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
            <div>
              <p className="eyebrow">{canManageVault ? 'Owner workspace' : 'Nominee workspace'}</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
                {user?.name ? `${user.name.split(' ')[0]}'s secure legacy hub` : 'Secure legacy hub'}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-secondary)]">
                Monitor stored assets, trusted contacts, and release readiness from one encrypted control center.
              </p>
              <div className="mt-8 w-full sm:w-auto">
                <SecureActionMenu fullWidth />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="panel card-hover rounded-[1.75rem] p-5">
                <p className="text-sm text-[var(--text-muted)]">Stored Assets</p>
                <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{assets.length}</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Loaded from encrypted backend storage.</p>
              </div>
              <div className="panel card-hover rounded-[1.75rem] p-5">
                <p className="text-sm text-[var(--text-muted)]">Trusted Members</p>
                <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{nominees?.nomineeCount ?? 0}</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Consensus-ready primary and fallback contacts.</p>
              </div>
              <div className="panel card-hover rounded-[1.75rem] p-5">
                <p className="text-sm text-[var(--text-muted)]">Active Timer</p>
                <p className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{posture?.deadManSwitch.timerDays ?? user?.inactivityTimerDays ?? 60}d</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Current inactivity safeguard before release review.</p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <section className="grid gap-6 xl:grid-cols-[0.68fr_0.32fr]">
        <div className="space-y-6">
          <Reveal>
            <div className="panel rounded-[2rem] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">Quick actions</p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Move your inheritance plan forward</h2>
                </div>
                <div className="icon-chip">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {quickActions.filter((action) => canManageVault || action.href !== '/security').map((action, index) => (
                  <Reveal key={action.label} delay={index * 0.05}>
                    <Link to={action.href} className="card-hover rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 transition">
                      <action.icon className="h-5 w-5 text-[var(--accent)]" />
                      <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{action.label}</h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{action.description}</p>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="panel rounded-[2rem] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">Stored assets</p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Portfolio overview</h2>
                </div>
                {canManageVault ? <Link to="/assets/new" className="text-sm font-semibold text-[var(--accent)] transition-all duration-300 ease-in-out hover:translate-x-1">Add more</Link> : null}
              </div>

              {assetActionError ? (
                <div className="mt-5 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {assetActionError}
                </div>
              ) : null}

              {assetActionSuccess ? (
                <div className="mt-5 rounded-3xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-200">
                  {assetActionSuccess}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {assets.length ? assets.map((asset, index) => (
                  <Reveal key={asset.id} delay={index * 0.04}>
                    <article className="card-hover rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                      <Link to={`/assets/${asset.id}`} className="block">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.26em] text-[var(--text-muted)]">{asset.type}</p>
                            <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{asset.title}</h3>
                            {!canManageVault && asset.ownerName ? (
                              <p className="mt-2 text-sm text-[var(--text-secondary)]">Shared by {asset.ownerName}</p>
                            ) : null}
                          </div>
                          <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                            {asset.hasFile ? 'File' : 'Data'}
                          </span>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{asset.details}</p>
                        <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                          <span>{asset.financialData || 'No financial data'}</span>
                          <span>{new Date(asset.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </Link>

                      {canManageVault ? (
                        <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            onClick={() => openEditModal(asset)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setDeleteTarget(asset)
                              setAssetActionError('')
                              setAssetActionSuccess('')
                              setMfaChallenge(null)
                              setMfaCode('')
                              setMfaIntent(null)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  </Reveal>
                )) : (
                  <div className="rounded-[1.75rem] border border-dashed border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
                    {assetsError || (
                      canManageVault
                        ? 'No persisted assets yet. Add your first asset to store it in the vault.'
                        : 'No assets are available for this nominee account yet.'
                    )}
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        </div>

        <div className="space-y-6">
          <Reveal delay={0.08}>
            <div className="panel rounded-[2rem] p-6">
              <p className="eyebrow">Security snapshot</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Trust posture</h2>
              <div className="mt-6 space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
                    <span>MFA coverage</span>
                    <span>{posture?.mfa.email || posture?.mfa.totp ? '100%' : '0%'}</span>
                  </div>
                  <AnimatedProgressBar value={posture?.mfa.email || posture?.mfa.totp ? 100 : 0} />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">
                    <span>Consensus readiness</span>
                    <span>{consensusReadiness}%</span>
                  </div>
                  <AnimatedProgressBar value={consensusReadiness} />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  { icon: LockKeyhole, label: 'Encryption at rest', value: 'Enabled' },
                  { icon: ShieldCheck, label: 'Fraud monitoring', value: posture ? `Risk score ${posture.risk.riskScore}` : 'Active' },
                  { icon: Clock3, label: 'Timer verification', value: `${posture?.deadManSwitch.timerDays ?? user?.inactivityTimerDays ?? 60} day window` },
                ].map((item) => (
                  <div key={item.label} className="card-hover rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 text-[var(--accent)]" />
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{item.label}</p>
                        <p className="text-sm text-[var(--text-secondary)]">{item.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="panel rounded-[2rem] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">Recent actions</p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Activity timeline</h2>
                </div>
                <Activity className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <div className="mt-6 space-y-4">
                {logs.length ? logs.map((item, index) => (
                  <Reveal key={item.id} delay={index * 0.05}>
                    <div className="card-hover rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                      <p className="font-semibold text-[var(--text-primary)]">{item.eventType}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{item.message}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.26em] text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </Reveal>
                )) : (
                  <div className="card-hover rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-secondary)]">
                    Activity will appear here after authenticated actions are recorded.
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {editingAsset ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-xl">
          <div className="w-full max-w-2xl rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-[0_30px_120px_-40px_rgba(0,0,0,0.95)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Update asset</p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Edit portfolio record</h2>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeEditModal} aria-label="Close edit asset modal">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Asset name</span>
                <input
                  value={editForm.title}
                  onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                  className="field-input"
                  placeholder="Enter asset name"
                />
              </label>

              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Asset type</span>
                <select
                  value={editForm.type}
                  onChange={(event) => setEditForm((current) => ({ ...current, type: event.target.value }))}
                  className="field-input"
                >
                  {assetTypes.map((type) => (
                    <option key={type} value={type} className="bg-slate-950 text-white">
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Financial data or estimated value</span>
                <input
                  value={editForm.financialData}
                  onChange={(event) => setEditForm((current) => ({ ...current, financialData: event.target.value }))}
                  className="field-input"
                  placeholder="$120,000"
                />
              </label>

              <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                <span>Description</span>
                <textarea
                  value={editForm.details}
                  onChange={(event) => setEditForm((current) => ({ ...current, details: event.target.value }))}
                  rows={5}
                  className="field-input"
                  placeholder="Describe the asset and inheritance instructions."
                />
              </label>
            </div>

            {mfaChallenge && mfaIntent === 'update' ? (
              <div className="mt-5 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                <p className="font-semibold">Recent MFA required before saving this asset.</p>
                <input
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  inputMode="numeric"
                  className="mt-3 field-input"
                />
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={closeEditModal} disabled={Boolean(assetActionLoading)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={mfaChallenge && mfaIntent === 'update' ? handleVerifyAssetMfa : handleUpdateAsset}
                disabled={!isEditFormValid || assetActionLoading === 'update' || (mfaChallenge && mfaIntent === 'update' && mfaCode.length !== 6)}
              >
                {assetActionLoading === 'update'
                  ? 'Saving...'
                  : mfaChallenge && mfaIntent === 'update'
                    ? 'Verify and save'
                    : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-xl">
          <div className="w-full max-w-lg rounded-[2rem] border border-[var(--border)] bg-[var(--surface-strong)] p-6 shadow-[0_30px_120px_-40px_rgba(0,0,0,0.95)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Remove asset</p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{deleteTarget.title}</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(assetActionLoading)}
                aria-label="Close delete asset confirmation"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="mt-5 text-sm leading-7 text-[var(--text-secondary)]">
              Are you sure you want to remove this asset from your portfolio?
            </p>

            {mfaChallenge && mfaIntent === 'delete' ? (
              <div className="mt-5 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                <p className="font-semibold">Recent MFA required before removing this asset.</p>
                <input
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  inputMode="numeric"
                  className="mt-3 field-input"
                />
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={Boolean(assetActionLoading)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={mfaChallenge && mfaIntent === 'delete' ? handleVerifyAssetMfa : handleDeleteAsset}
                disabled={assetActionLoading === 'delete' || (mfaChallenge && mfaIntent === 'delete' && mfaCode.length !== 6)}
              >
                {assetActionLoading === 'delete'
                  ? 'Removing...'
                  : mfaChallenge && mfaIntent === 'delete'
                    ? 'Verify and remove'
                    : 'Remove asset'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageTransition>
  )
}

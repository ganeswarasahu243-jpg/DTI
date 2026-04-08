import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowUpRight, Clock3, LockKeyhole, Plus, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchActivityLogs, type ActivityLog } from '../activity/api'
import { fetchAssets, type AssetSummary } from '../assets/api'
import { useAuth } from '../auth/AuthContext'
import { fetchNominees, type NomineeSummary } from '../nominees/api'
import { fetchSecurityPosture, type SecurityPosture } from '../security/api'
import { getDemoAssetsByEmail, isDemoEmail } from '../demo/session'
import { AnimatedProgressBar } from '../components/ui/AnimatedProgressBar'
import { Button } from '../components/ui/Button'
import { PageTransition } from '../components/ui/PageTransition'
import { Reveal } from '../components/ui/Reveal'

const quickActions = [
  { label: 'Add Asset', href: '/assets/new', icon: Plus, description: 'Store a new document, wallet, or inheritance instruction.' },
  { label: 'Add Trusted Contact', href: '/nominees', icon: Users, description: 'Update your trusted circle and configure approval responsibilities.' },
  { label: 'Set Timer', href: '/security', icon: Clock3, description: 'Adjust inactivity settings and release verification controls.' },
]

export default function DashboardPage() {
  const { user, token } = useAuth()
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [nominees, setNominees] = useState<NomineeSummary | null>(null)
  const [posture, setPosture] = useState<SecurityPosture | null>(null)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [assetsError, setAssetsError] = useState('')

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
              <div className="mt-7 flex flex-wrap gap-3">
                {canManageVault ? (
                  <>
                    <Link to="/assets/new">
                      <Button>
                        Add Asset
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link to="/nominees">
                      <Button variant="secondary">Manage Trusted Circle</Button>
                    </Link>
                  </>
                ) : (
                  <Link to="/profile">
                    <Button variant="secondary">View Profile</Button>
                  </Link>
                )}
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
                {quickActions.filter((action) => canManageVault || action.href !== '/assets/new').map((action, index) => (
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

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {assets.length ? assets.map((asset, index) => (
                  <Reveal key={asset.id} delay={index * 0.04}>
                    <Link to={`/assets/${asset.id}`} className="block">
                      <article className="card-hover rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5">
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
                      </article>
                    </Link>
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
    </PageTransition>
  )
}

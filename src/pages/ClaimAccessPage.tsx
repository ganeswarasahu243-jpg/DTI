import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  approveClaim,
  fetchClaimAssets,
  fetchClaimStatus,
  requestClaimOtp,
  submitClaim,
  verifyClaimOtp,
} from '../claim/api'
import type { ClaimAssetsResponse } from '../claim/types'
import { AnimatedProgressBar } from '../components/ui/AnimatedProgressBar'
import { AnimatedCountdown } from '../components/ui/AnimatedCountdown'
import { Button } from '../components/ui/Button'
import { PageTransition } from '../components/ui/PageTransition'
import { Reveal } from '../components/ui/Reveal'
import { Spinner } from '../components/ui/Spinner'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  KeyRound,
  Landmark,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react'

const statusOrder = [
  'Pending Verification',
  'OTP Verified',
  'Waiting for Other Approvals',
  'Access Granted',
  'Access Denied',
] as const

const timerOptions = [3, 5, 10] as const
const demoClaimants = [
  {
    label: 'Use Priya Demo Claimant',
    deceasedIdentifier: 'owner@loom-demo.local',
    claimantName: 'Priya Nominee',
    claimantContact: 'priya@loom-demo.local',
  },
  {
    label: 'Use Marcus Demo Claimant',
    deceasedIdentifier: 'owner@loom-demo.local',
    claimantName: 'Marcus Nominee',
    claimantContact: 'marcus@loom-demo.local',
  },
] as const

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Unable to read the selected file.'))
        return
      }

      resolve(result.split(',')[1] || '')
    }
    reader.onerror = () => reject(new Error('Unable to read the selected file.'))
    reader.readAsDataURL(file)
  })
}

function formatRemaining(iso: string | null | undefined, nowMs: number) {
  if (!iso) {
    return 'Timer not started'
  }

  const distanceMs = new Date(iso).getTime() - nowMs
  if (distanceMs <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.floor(distanceMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function ClaimAccessPage() {
  const [form, setForm] = useState({
    deceasedIdentifier: '',
    claimantName: '',
    claimantContact: '',
    otpCode: '',
  })
  const [selectedTimer, setSelectedTimer] = useState<number>(3)
  const [idProof, setIdProof] = useState<File | null>(null)
  const [portalToken, setPortalToken] = useState<string | null>(null)
  const [status, setStatus] = useState<Awaited<ReturnType<typeof requestClaimOtp>> | null>(null)
  const [assetsResponse, setAssetsResponse] = useState<ClaimAssetsResponse | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!portalToken || !status?.submittedAt || status.status === 'access_denied') {
      return
    }

    const interval = window.setInterval(async () => {
      try {
        const nextStatus = await fetchClaimStatus({ portalToken })
        setStatus((prev) => ({
          ...nextStatus,
          devApprovalTokens: prev?.devApprovalTokens || nextStatus.devApprovalTokens,
        }))

        if (nextStatus.portalToken) {
          setPortalToken(nextStatus.portalToken)
        }
      } catch {
        window.clearInterval(interval)
      }
    }, (status.pollIntervalSeconds || 5) * 1000)

    return () => window.clearInterval(interval)
  }, [portalToken, status?.pollIntervalSeconds, status?.status, status?.submittedAt])

  useEffect(() => {
    const accessToken = status?.accessToken
    if (!accessToken) {
      return
    }

    const token = accessToken
    let cancelled = false

    async function loadAssets() {
      try {
        const response = await fetchClaimAssets(token)
        if (!cancelled) {
          setAssetsResponse(response)
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load read-only assets.')
        }
      }
    }

    loadAssets()

    return () => {
      cancelled = true
    }
  }, [status?.accessToken])

  async function handleRequestOtp() {
    setLoadingAction('request')
    setError('')
    setSuccess('')

    try {
      const response = await requestClaimOtp({
        deceasedIdentifier: form.deceasedIdentifier,
        claimantName: form.claimantName,
        claimantContact: form.claimantContact,
      })

      setStatus(response)
      setPortalToken(response.portalToken || null)
      setAssetsResponse(null)
      if (response.devOtp) {
        setForm((prev) => ({ ...prev, otpCode: response.devOtp || '' }))
      }
      setSuccess(
        response.devOtp
          ? 'OTP generated in development mode. The demo OTP has been filled in for you below because email delivery is not configured yet.'
          : 'OTP sent to the trusted claimant contact. Continue with verification.',
      )
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request OTP.')
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleVerifyOtp() {
    if (!portalToken) {
      setError('Request an OTP before verification.')
      return
    }

    setLoadingAction('verify')
    setError('')
    setSuccess('')

    try {
      const response = await verifyClaimOtp({
        portalToken,
        code: form.otpCode,
      })

      setStatus((prev) => ({ ...prev, ...response, devApprovalTokens: prev?.devApprovalTokens }))
      setPortalToken(response.portalToken || portalToken)
      setSuccess('OTP verified. Upload ID proof and submit the claim.')
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify OTP.')
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleSubmitClaim() {
    if (!portalToken) {
      setError('Verify OTP before submitting the claim.')
      return
    }

    if (!idProof) {
      setError('Upload an ID proof document before submitting the claim.')
      return
    }

    setLoadingAction('submit')
    setError('')
    setSuccess('')

    try {
      const base64 = await toBase64(idProof)
      const mimeType = idProof.type as 'application/pdf' | 'image/jpeg' | 'image/png'
      const response = await submitClaim({
        portalToken,
        timerMinutes: selectedTimer,
        idProof: {
          name: idProof.name,
          mimeType,
          base64,
        },
      })

      setStatus(response)
      setPortalToken(response.portalToken || portalToken)
      setSuccess('Claim submitted. Demo timer is now running while approvals are collected.')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the claim.')
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleApprove(approvalToken: string) {
    if (!status) {
      return
    }

    setLoadingAction(approvalToken)
    setError('')
    setSuccess('')

    try {
      await approveClaim({ claimId: status.id, approvalToken })
      if (portalToken) {
        const nextStatus = await fetchClaimStatus({ portalToken })
        setStatus((prev) => ({
          ...nextStatus,
          devApprovalTokens: prev?.devApprovalTokens,
        }))
        setPortalToken(nextStatus.portalToken || portalToken)
      }

      setSuccess('Trusted circle approval recorded.')
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Unable to record approval.')
    } finally {
      setLoadingAction(null)
    }
  }

  const activeStatusLabel = status?.statusLabel || 'Pending Verification'
  const progressValue = activeStatusLabel === 'Access Denied' ? 100 : (statusOrder.indexOf(activeStatusLabel) + 1) * 25
  const completedStepCount =
    activeStatusLabel === 'Access Denied' ? 4 : statusOrder.indexOf(activeStatusLabel) + 1
  const countdownLabel = formatRemaining(status?.timerExpiresAt, nowMs)

  return (
    <PageTransition className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <div className="mt-4 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <Reveal>
          <section className="section-shell hero-panel rounded-[2rem] p-5 sm:p-8 lg:rounded-[2.5rem] lg:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <div className="trust-chip text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
                <Clock3 className="h-4 w-4" />
                Demo Mode: Short Timer Enabled
              </div>
              <Link to="/" className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                Return to LOOM home
              </Link>
            </div>

            <div className="mt-7 max-w-3xl space-y-5">
              <p className="eyebrow">Claim Access Portal</p>
              <h1 className="text-balance text-4xl font-semibold leading-none text-[var(--text-primary)] sm:text-5xl">
                A separate, limited-access path for trusted inheritance claims.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[var(--text-secondary)]">
                This flow never signs claimants into the full account. It verifies identity, gathers approvals,
                and issues a short-lived read-only token only after the right checks are complete.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="panel card-hover rounded-[1.75rem] p-5">
                <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
                <p className="mt-4 text-sm font-semibold text-[var(--text-primary)]">Claim-scoped JWT only</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  No full account access, ever. The portal stays isolated from login and signup.
                </p>
              </div>
              <div className="panel card-hover rounded-[1.75rem] p-5">
                <Users className="h-5 w-5 text-[var(--accent)]" />
                <p className="mt-4 text-sm font-semibold text-[var(--text-primary)]">Majority approval required</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Trusted circle votes are timestamped, deduplicated, and audit logged.
                </p>
              </div>
              <div className="panel card-hover rounded-[1.75rem] p-5">
                <Landmark className="h-5 w-5 text-[var(--accent)]" />
                <p className="mt-4 text-sm font-semibold text-[var(--text-primary)]">Read-only asset reveal</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  Assets appear only after OTP, timer expiry, and approvals all align.
                </p>
              </div>
            </div>
          </section>
          </Reveal>

          <Reveal delay={0.05}>
          <section className="panel rounded-[2rem] p-5 sm:p-7 lg:rounded-[2.5rem]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Progress</p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Status tracking</h2>
              </div>
              <motion.div layout className={`rounded-full px-4 py-2 text-sm font-semibold ${
                activeStatusLabel === 'Access Granted'
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : activeStatusLabel === 'Access Denied'
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
              }`}>
                {activeStatusLabel}
              </motion.div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.26em] text-[var(--text-muted)]">
                <span>Claim progress</span>
                <span>{progressValue}%</span>
              </div>
              <AnimatedProgressBar value={progressValue} />
            </div>

            <div className="mt-6 space-y-3">
              {statusOrder.map((label, index) => {
                const isCurrent = label === activeStatusLabel
                const isCompleted = completedStepCount > index + 1 || (activeStatusLabel === 'Access Granted' && label !== 'Access Denied')
                const Icon = activeStatusLabel === 'Access Denied' && label === 'Access Denied' ? XCircle : CheckCircle2

                return (
                  <motion.div
                    key={label}
                    layout
                    className={`rounded-[1.5rem] border px-4 py-4 transition ${
                      isCurrent
                        ? 'border-[var(--border-strong)] bg-[var(--accent-soft)]'
                        : isCompleted
                          ? 'border-emerald-500/20 bg-emerald-500/10'
                          : 'border-[var(--border)] bg-[var(--surface)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isCurrent ? 'text-[var(--accent)]' : isCompleted ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`} />
                      <p className="font-semibold text-[var(--text-primary)]">{label}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AnimatedCountdown value={countdownLabel} label="Countdown" />
              <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="text-sm text-[var(--text-muted)]">Approval progress</p>
                <p className="mt-2 text-4xl font-semibold text-[var(--text-primary)]">
                  {status ? `${status.approvalCount}/${status.approvalThreshold}` : '0/0'}
                </p>
                <div className="mt-4">
                  <AnimatedProgressBar
                    value={
                      status?.approvalThreshold
                        ? Math.min(100, (status.approvalCount / status.approvalThreshold) * 100)
                        : 0
                    }
                  />
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Majority consensus before asset access</p>
              </div>
            </div>
          </section>
          </Reveal>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.68fr_0.32fr]">
          <Reveal>
          <section className="panel rounded-[2rem] p-5 sm:p-7 lg:rounded-[2.5rem]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Step-by-step claim</p>
                <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">Verify identity and submit</h2>
              </div>
              <div className="icon-chip">
                <KeyRound className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-8 space-y-8">
              <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--text-primary)]">Demo</div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">Quick demo claim access</p>
                    <p className="text-sm text-[var(--text-secondary)]">Use a seeded trusted claimant so OTP and approvals work immediately in local development.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {demoClaimants.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          deceasedIdentifier: preset.deceasedIdentifier,
                          claimantName: preset.claimantName,
                          claimantContact: preset.claimantContact,
                        }))
                        setError('')
                        setSuccess(`Filled demo claimant: ${preset.claimantContact}`)
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-muted)] p-4 text-sm text-[var(--text-secondary)]">
                  Owner: <span className="font-semibold text-[var(--text-primary)]">owner@loom-demo.local</span>
                  <br />
                  Claimants: <span className="font-semibold text-[var(--text-primary)]">priya@loom-demo.local</span> or <span className="font-semibold text-[var(--text-primary)]">marcus@loom-demo.local</span>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--text-primary)]">1</div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">Identify the owner</p>
                    <p className="text-sm text-[var(--text-secondary)]">Enter the registered email or phone of the deceased user.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm text-[var(--text-primary)] md:col-span-2">
                    <span className="mb-2 block text-[var(--text-secondary)]">Registered email or phone of deceased user</span>
                    <input
                      value={form.deceasedIdentifier}
                      onChange={(event) => setForm((prev) => ({ ...prev, deceasedIdentifier: event.target.value }))}
                      placeholder="owner@loom.local or +15551234567"
                      className="field-input"
                    />
                  </label>
                  <label className="block text-sm text-[var(--text-primary)]">
                    <span className="mb-2 block text-[var(--text-secondary)]">Claimant name</span>
                    <input
                      value={form.claimantName}
                      onChange={(event) => setForm((prev) => ({ ...prev, claimantName: event.target.value }))}
                      placeholder="Ariana Ray"
                      className="field-input"
                    />
                  </label>
                  <label className="block text-sm text-[var(--text-primary)]">
                    <span className="mb-2 block text-[var(--text-secondary)]">Claimant email or phone</span>
                    <input
                      value={form.claimantContact}
                      onChange={(event) => setForm((prev) => ({ ...prev, claimantContact: event.target.value }))}
                      placeholder="trusted-contact@loom.local"
                      className="field-input"
                    />
                  </label>
                </div>
                <div className="mt-5">
                  <Button onClick={handleRequestOtp} disabled={loadingAction === 'request'} className="w-full sm:w-auto">
                    {loadingAction === 'request' ? <Spinner className="border-slate-900/20 border-t-slate-950" /> : null}
                    {loadingAction === 'request' ? 'Requesting OTP...' : 'Request OTP'}
                  </Button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--text-primary)]">2</div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">Verify claimant OTP</p>
                    <p className="text-sm text-[var(--text-secondary)]">OTPs expire in 5 minutes and are protected by retry limits.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-[0.54fr_0.46fr]">
                  <label className="block text-sm text-[var(--text-primary)]">
                    <span className="mb-2 block text-[var(--text-secondary)]">OTP input</span>
                    <input
                      value={form.otpCode}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, otpCode: event.target.value.replace(/\D/g, '').slice(0, 6) }))
                      }
                      placeholder="123456"
                      inputMode="numeric"
                      className="field-input tracking-[0.28em]"
                    />
                  </label>
                  <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-muted)] p-4">
                    <p className="text-sm text-[var(--text-muted)]">Delivery channel</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                      {status?.claimantContact || 'Trusted claimant contact'}
                    </p>
                    {status?.devOtp ? (
                      <p className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--accent)]">
                        Demo OTP: {status.devOtp}
                      </p>
                    ) : null}
                    {!status?.devOtp ? (
                      <p className="mt-3 text-sm text-[var(--text-secondary)]">
                        Real email or SMS delivery requires mail/SMS configuration. In local demo mode, the OTP appears here.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-5">
                  <Button variant="secondary" onClick={handleVerifyOtp} disabled={!portalToken || loadingAction === 'verify'} className="w-full sm:w-auto">
                    {loadingAction === 'verify' ? <Spinner /> : null}
                    {loadingAction === 'verify' ? 'Verifying OTP...' : 'Verify OTP'}
                  </Button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--text-primary)]">3</div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">Upload proof and choose demo timer</p>
                    <p className="text-sm text-[var(--text-secondary)]">Accepted file types: PDF, JPG, PNG. Max 3 MB.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-[0.48fr_0.52fr]">
                  <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-muted)] p-5">
                    <div className="flex items-center gap-3">
                      <FileCheck2 className="h-5 w-5 text-[var(--accent)]" />
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">Upload ID proof</p>
                        <p className="text-sm text-[var(--text-secondary)]">Validated before secure storage.</p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png"
                      className="mt-4 block w-full text-sm text-[var(--text-secondary)] file:mr-4 file:rounded-2xl file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--text-primary)]"
                      onChange={(event) => setIdProof(event.target.files?.[0] || null)}
                    />
                    {idProof ? (
                      <p className="mt-3 text-sm text-[var(--accent)]">
                        {idProof.name} selected ({Math.ceil(idProof.size / 1024)} KB)
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Demo timer options</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {timerOptions.map((option) => (
                        <motion.button
                          key={option}
                          type="button"
                          onClick={() => setSelectedTimer(option)}
                          whileHover={{ y: -2, scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className={`card-hover rounded-[1.5rem] border px-4 py-5 text-left transition ${
                            selectedTimer === option
                              ? 'border-[var(--border-strong)] bg-[var(--accent-soft)]'
                              : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
                          }`}
                        >
                          <p className="text-lg font-semibold text-[var(--text-primary)]">{option} min</p>
                          <p className="mt-2 text-sm text-[var(--text-secondary)]">Demo replacement for 30/60/90 days</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <Button onClick={handleSubmitClaim} disabled={loadingAction === 'submit'} className="w-full sm:w-auto">
                    {loadingAction === 'submit' ? <Spinner className="border-slate-900/20 border-t-slate-950" /> : null}
                    {loadingAction === 'submit' ? 'Submitting Claim...' : 'Submit Claim'}
                  </Button>
                </div>
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {error ? (
                <motion.div
                  key="claim-error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-6 rounded-[1.75rem] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
                >
                  {error}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {success ? (
                <motion.div
                  key="claim-success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-6 rounded-[1.75rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500"
                >
                  {success}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
          </Reveal>

          <section className="space-y-6">
            <Reveal delay={0.08}>
            <div className="panel rounded-[2rem] p-5 sm:p-7 lg:rounded-[2.5rem]">
              <p className="eyebrow">Consensus board</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Waiting for other approvals</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                Majority approval is enforced before the short-lived access token can be generated.
              </p>

              <div className="mt-6 space-y-3">
                {(status?.approvals || []).map((approval, index) => (
                  <motion.div
                    key={approval.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.24, delay: index * 0.04 }}
                    className="card-hover rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{approval.name}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{approval.email}</p>
                      </div>
                      <div className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                        approval.approvedAt
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-amber-500/15 text-amber-500'
                      }`}>
                        {approval.approvedAt ? 'Approved' : 'Pending'}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {status?.devApprovalTokens?.length ? (
                <div className="mt-6 rounded-[1.75rem] border border-[var(--border)] bg-[var(--accent-soft)] p-5">
                  <p className="font-semibold text-[var(--text-primary)]">Development demo approvals</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                    Use the generated approval tokens below to simulate secure approvals from other trusted members.
                  </p>
                  <div className="mt-4 space-y-3">
                    {status.devApprovalTokens.map((invite) => (
                      <div key={invite.trustedCircleId} className="card-hover rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4">
                        <p className="font-semibold text-[var(--text-primary)]">{invite.name}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{invite.email}</p>
                        <p className="mt-3 break-all rounded-2xl bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                          {invite.approvalToken}
                        </p>
                        <Button
                          variant="secondary"
                          className="mt-3 w-full"
                          onClick={() => handleApprove(invite.approvalToken)}
                          disabled={loadingAction === invite.approvalToken}
                        >
                          {loadingAction === invite.approvalToken ? <Spinner /> : null}
                          {loadingAction === invite.approvalToken ? 'Recording Approval...' : 'Approve Claim'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-[1.75rem] border border-dashed border-[var(--border)] p-5 text-sm text-[var(--text-secondary)]">
                  Submit the claim to generate approval requests for the trusted circle.
                </div>
              )}
            </div>
            </Reveal>

            {assetsResponse ? (
              <Reveal delay={0.12}>
              <div className="panel rounded-[2rem] p-5 sm:p-7 lg:rounded-[2.5rem]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="eyebrow">Access Granted</p>
                    <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Temporary read-only assets</h2>
                  </div>
                  <div className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-500">
                    {status?.accessTokenExpiresInMinutes || 10} minute token
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {assetsResponse.assets.map((asset) => (
                    <article key={asset.id} className="card-hover rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">{asset.type}</p>
                      <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{asset.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{asset.details}</p>
                      {asset.financialData ? (
                        <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-muted)] p-4 text-sm text-[var(--text-secondary)]">
                          {asset.financialData}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
              </Reveal>
            ) : null}
          </section>
        </div>
      </div>
    </PageTransition>
  )
}

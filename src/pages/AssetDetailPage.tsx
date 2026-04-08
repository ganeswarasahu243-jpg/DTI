import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { fetchAsset, type AssetSummary } from '../assets/api'
import type { AuthChallengeResponse } from '../auth/types'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { getDemoAssetByEmail, isDemoEmail } from '../demo/session'

export default function AssetDetailPage() {
  const { id } = useParams()
  const { token, user, requestActionChallenge, verifyOtp } = useAuth()
  const [asset, setAsset] = useState<AssetSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState<AuthChallengeResponse | null>(null)
  const [mfaCode, setMfaCode] = useState('')

  async function loadAsset(options?: { challengeOnMfa?: boolean }) {
    if (!id || !token) {
      setLoading(false)
      return
    }

    try {
      const response = await fetchAsset(id, token)
      setAsset(response)
      setError('')
      setMfaChallenge(null)
      setMfaCode('')
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load the asset.'

      if (id && user?.email && isDemoEmail(user.email) && message.includes('Insufficient role permissions')) {
        const demoAsset = getDemoAssetByEmail(id, user.email)

        if (demoAsset) {
          setAsset(demoAsset)
          setError('')
          setMfaChallenge(null)
          setMfaCode('')
          return
        }
      }

      if (options?.challengeOnMfa !== false && message.includes('Recent MFA verification required')) {
        try {
          const challenge = await requestActionChallenge({ purpose: 'asset-access' })
          setMfaChallenge(challenge)
          setMfaCode('')
          setError('Enter the OTP below to open this shared asset.')
          setAsset(null)
          return
        } catch (challengeError) {
          setError(challengeError instanceof Error ? challengeError.message : message)
          setAsset(null)
          return
        }
      }

      setError(message)
      setAsset(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    loadAsset().catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [id, token, user?.email])

  const handleVerifyMfa = async () => {
    if (!mfaChallenge || mfaCode.trim().length !== 6) {
      return
    }

    setLoading(true)
    setError('')

    try {
      await verifyOtp({
        pendingToken: mfaChallenge.pendingToken,
        challengeId: mfaChallenge.challengeId,
        code: mfaCode.trim(),
        purpose: mfaChallenge.purpose,
      })
      await loadAsset({ challengeOnMfa: false })
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify MFA.')
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-8 text-slate-300">Loading asset...</div>
  }

  if (!asset) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-8 text-center text-slate-400">
          <p className="text-xl font-semibold text-white">{error || 'Asset not found'}</p>
          <p className="mt-3">
            {mfaChallenge
              ? 'Recent MFA is required before this shared asset can be opened.'
              : 'Double-check the asset selection or add a new asset from the dashboard.'}
          </p>
          {mfaChallenge ? (
            <div className="mx-auto mt-6 max-w-md rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-left text-sm text-cyan-100">
              <p className="font-semibold">Verify OTP to continue</p>
              <input
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                className="mt-3 w-full rounded-3xl border border-cyan-500/30 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none"
              />
              {mfaChallenge.devOtp ? <p className="mt-3 text-cyan-200">Dev OTP: {mfaChallenge.devOtp}</p> : null}
              <div className="mt-3 flex gap-3">
                <Button type="button" onClick={handleVerifyMfa} disabled={loading || mfaCode.length !== 6}>
                  {loading ? 'Verifying...' : 'Verify and open'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => { setMfaChallenge(null); setMfaCode('') }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
          <Link to="/dashboard">
            <Button variant="secondary" className="mt-6">Return to dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-8 shadow-xl shadow-slate-950/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Asset detail</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{asset.title}</h1>
          {asset.ownerName ? <p className="mt-2 text-sm text-cyan-200/80">Shared by {asset.ownerName}</p> : null}
          <p className="mt-2 text-slate-400">{asset.details}</p>
        </div>
        <Link to="/dashboard">
          <Button variant="secondary" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.65fr_0.35fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-8 shadow-xl shadow-slate-950/10">
          <div className="grid gap-6">
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-6">
              <p className="text-sm text-slate-400">Stored financial data</p>
              <p className="mt-2 text-2xl font-semibold text-white">{asset.financialData || 'Not provided'}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Category</p>
                <p className="mt-2 text-lg font-semibold text-white">{asset.type}</p>
              </div>
              <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Last updated</p>
                <p className="mt-2 text-lg font-semibold text-white">{new Date(asset.updatedAt).toLocaleString()}</p>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Full details</p>
              <p className="mt-3 text-sm leading-7 text-slate-400">{asset.details}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-6 shadow-xl shadow-slate-950/10">
          <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">Attachment</p>
            <p className="mt-2 text-lg font-semibold text-white">{asset.hasFile ? 'Available' : 'No file uploaded'}</p>
          </div>
          <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">File type</p>
            <p className="mt-2 text-lg font-semibold text-white">{asset.fileMimeType || 'N/A'}</p>
          </div>
          <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">Created</p>
            <p className="mt-2 text-lg font-semibold text-white">{new Date(asset.createdAt).toLocaleString()}</p>
          </div>
          {asset.ownerEmail ? (
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">Owner account</p>
              <p className="mt-2 text-lg font-semibold text-white">{asset.ownerEmail}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

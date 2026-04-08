import { useEffect, useState } from 'react'
import { fetchSecurityPosture, updateInactivityTimer, type SecurityPosture } from '../security/api'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'

export default function SecuritySettingsPage() {
  const { token, updateUser } = useAuth()
  const [posture, setPosture] = useState<SecurityPosture | null>(null)
  const [timerDays, setTimerDays] = useState<number>(60)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadPosture() {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await fetchSecurityPosture(token)
        if (!cancelled) {
          setPosture(response)
          setTimerDays(response.deadManSwitch.timerDays)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load security posture.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadPosture()

    return () => {
      cancelled = true
    }
  }, [token])

  const handleSave = async () => {
    if (!token) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await updateInactivityTimer(timerDays, token)
      setPosture((current) => current ? {
        ...current,
        deadManSwitch: {
          ...current.deadManSwitch,
          timerDays: response.inactivityTimerDays,
        },
      } : current)
      updateUser((current) => current ? { ...current, inactivityTimerDays: response.inactivityTimerDays } : current)
      setSuccess('Security timer updated successfully.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update the timer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Security settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Control your inheritance protection posture.</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Review live MFA status, risk signals, and your inactivity release timer from one place.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.65fr_0.35fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
          {loading ? (
            <p className="text-slate-400">Loading security posture...</p>
          ) : posture ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
                <p className="font-semibold text-white">MFA coverage</p>
                <p className="mt-2 text-sm text-slate-400">Email MFA: {posture.mfa.email ? 'Enabled' : 'Disabled'}</p>
                <p className="mt-1 text-sm text-slate-400">Authenticator MFA: {posture.mfa.totp ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
                <p className="font-semibold text-white">Risk posture</p>
                <p className="mt-2 text-sm text-slate-400">Risk score: {posture.risk.riskScore}</p>
                <p className="mt-1 text-sm text-slate-400">Flagged reason: {posture.risk.flaggedReason || 'None'}</p>
                <p className="mt-1 text-sm text-slate-400">Locked until: {posture.risk.lockedUntil ? new Date(posture.risk.lockedUntil).toLocaleString() : 'Not locked'}</p>
              </div>
              <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
                <p className="font-semibold text-white">Inactivity timer</p>
                <p className="mt-2 text-sm text-slate-400">Choose one of the backend-supported timer values.</p>
                <select
                  value={timerDays}
                  onChange={(event) => setTimerDays(Number(event.target.value))}
                  className="mt-4 w-full rounded-3xl border border-slate-800/80 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
                >
                  {posture.deadManSwitch.allowedOptionsDays.map((option) => (
                    <option key={option} value={option}>
                      {option} days
                    </option>
                  ))}
                </select>
                <Button onClick={handleSave} disabled={saving} className="mt-4">
                  {saving ? 'Saving...' : 'Save timer'}
                </Button>
              </div>
            </div>
          ) : null}
          {error ? <div className="mt-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
          {success ? <div className="mt-6 rounded-3xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-200">{success}</div> : null}
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Security health</p>
          <div className="mt-6 space-y-4">
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">Trusted members</p>
              <p className="mt-2 text-3xl font-semibold text-white">{posture?.trustedCircle.nomineeCount ?? 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">Transport policy</p>
              <p className="mt-2 text-lg font-semibold text-white">{posture?.zeroTrust.transport || 'Unknown'}</p>
            </div>
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">Active release request</p>
              <p className="mt-2 text-lg font-semibold text-white">{posture?.deadManSwitch.activeRequest ? 'In progress' : 'None'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { addNominee, fetchNominees, updateNomineeThreshold, type NomineeSummary } from '../nominees/api'
import { useAuth } from '../auth/AuthContext'
import type { AuthChallengeResponse } from '../auth/types'
import { Button } from '../components/ui/Button'

export default function NomineeManagementPage() {
  const { token, user, requestActionChallenge, verifyOtp } = useAuth()
  const [form, setForm] = useState({ name: '', email: '' })
  const [data, setData] = useState<NomineeSummary | null>(null)
  const [threshold, setThreshold] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState<AuthChallengeResponse | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaIntent, setMfaIntent] = useState<'add' | 'threshold' | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadNominees() {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await fetchNominees(token)
        if (!cancelled) {
          setData(response)
          setThreshold(response.threshold)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load nominees.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadNominees()

    return () => {
      cancelled = true
    }
  }, [token])

  const canManage = user?.role === 'user' || user?.role === 'admin'
  const isFormValid = useMemo(() => form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email), [form.email, form.name])

  const performAddNominee = async () => {
    if (!token) {
      throw new Error('Authentication required.')
    }

    const response = await addNominee({
      name: form.name.trim(),
      email: form.email.trim(),
    }, token)

    setData(response)
    setThreshold(response.threshold)
    setForm({ name: '', email: '' })
    setSuccess('Trusted nominee added successfully.')
  }

  const performThresholdSave = async () => {
    if (!token) {
      throw new Error('Authentication required.')
    }

    const response = await updateNomineeThreshold({ threshold }, token)
    setData((current) => current ? { ...current, threshold: response.threshold, minimumThreshold: response.minimumThreshold } : current)
    setSuccess('Approval threshold updated successfully.')
  }

  const requestNomineeMfa = async (intent: 'add' | 'threshold') => {
    const challenge = await requestActionChallenge({ purpose: 'nominee-change' })
    setMfaIntent(intent)
    setMfaChallenge(challenge)
    setMfaCode('')
    setError('Complete the MFA step below, then we will finish the trusted-circle update.')
  }

  const handleAdd = async () => {
    if (!token || !isFormValid) {
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      await performAddNominee()
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to add nominee.'
      if (message.includes('Recent MFA verification required')) {
        try {
          await requestNomineeMfa('add')
        } catch (challengeError) {
          setError(challengeError instanceof Error ? challengeError.message : message)
        }
      } else {
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleThresholdSave = async () => {
    if (!token || !data) {
      return
    }

    setSavingThreshold(true)
    setError('')
    setSuccess('')

    try {
      await performThresholdSave()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to update threshold.'
      if (message.includes('Recent MFA verification required')) {
        try {
          await requestNomineeMfa('threshold')
        } catch (challengeError) {
          setError(challengeError instanceof Error ? challengeError.message : message)
        }
      } else {
        setError(message)
      }
    } finally {
      setSavingThreshold(false)
    }
  }

  const handleVerifyMfa = async () => {
    if (!mfaChallenge || !mfaIntent || mfaCode.length !== 6) {
      return
    }

    setSubmitting(mfaIntent === 'add')
    setSavingThreshold(mfaIntent === 'threshold')
    setError('')
    setSuccess('')

    try {
      await verifyOtp({
        pendingToken: mfaChallenge.pendingToken,
        challengeId: mfaChallenge.challengeId,
        code: mfaCode,
        purpose: mfaChallenge.purpose,
      })

      if (mfaIntent === 'add') {
        await performAddNominee()
      } else {
        await performThresholdSave()
      }

      setMfaChallenge(null)
      setMfaCode('')
      setMfaIntent(null)
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify MFA.')
    } finally {
      setSubmitting(false)
      setSavingThreshold(false)
    }
  }

  if (!canManage) {
    return (
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 text-slate-300">
        Trusted circle management is available only to the vault owner or an admin account.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Nominee Management</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Maintain beneficiary flows and access roles.</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Add beneficiaries, review nominee permissions, and keep inheritance assignments current.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.7fr_0.3fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
          {loading ? (
            <p className="text-slate-400">Loading nominees...</p>
          ) : (
            <div className="space-y-4">
              {data?.nominees.length ? data.nominees.map((nominee) => (
                <div key={nominee.id} className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
                  <p className="font-semibold text-white">{nominee.name}</p>
                  <p className="mt-1 text-sm text-slate-400">Trusted nominee</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.28em] text-slate-500">{nominee.email}</p>
                </div>
              )) : (
                <div className="rounded-3xl border border-dashed border-slate-800/70 bg-slate-900/50 p-5 text-sm text-slate-400">
                  No trusted nominees have been added yet.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Add a nominee</p>
            <div className="mt-6 space-y-4">
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Enter nominee full name"
                className="w-full rounded-3xl border border-slate-800/80 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
              />
              <input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="nominee@example.com"
                className="w-full rounded-3xl border border-slate-800/80 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
              />
              <Button onClick={handleAdd} disabled={!isFormValid || submitting} className="w-full">
                {submitting ? 'Adding nominee...' : 'Add nominee'}
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Approval threshold</p>
            <div className="mt-6 space-y-4">
              <input
                type="number"
                min={data?.minimumThreshold || 1}
                max={Math.max(data?.nomineeCount || 1, 1)}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value) || 1)}
                className="w-full rounded-3xl border border-slate-800/80 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
              />
              <Button onClick={handleThresholdSave} disabled={savingThreshold || !data} className="w-full">
                {savingThreshold ? 'Saving...' : 'Save threshold'}
              </Button>
              <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-4 text-sm text-slate-400">
                <p className="text-slate-200">Best practice</p>
                <p className="mt-2">Keep at least two beneficiaries and set the threshold no lower than the current majority requirement.</p>
                {data ? <p className="mt-2">Minimum: {data.minimumThreshold}. Current nominees: {data.nomineeCount}.</p> : null}
              </div>
            </div>
          </div>

          {error ? <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
          {success ? <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-200">{success}</div> : null}
          {mfaChallenge ? (
            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              <p className="font-semibold">Recent MFA required for trusted-circle changes.</p>
              <input
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                className="mt-3 w-full rounded-3xl border border-cyan-500/30 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none"
              />
              {mfaChallenge.devOtp ? <p className="mt-3 text-cyan-200">Dev OTP: {mfaChallenge.devOtp}</p> : null}
              <div className="mt-3 flex gap-3">
                <Button type="button" onClick={handleVerifyMfa} disabled={mfaCode.length !== 6 || submitting || savingThreshold}>
                  {submitting || savingThreshold ? 'Verifying...' : 'Verify and continue'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setMfaChallenge(null)
                    setMfaCode('')
                    setMfaIntent(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { createAsset } from '../assets/api'
import { useAuth } from '../auth/AuthContext'
import type { AuthChallengeResponse } from '../auth/types'
import { Button } from '../components/ui/Button'

const assetTypes = ['Investment', 'Digital Asset', 'Real Estate', 'Document', 'Trust Document']

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

export default function AddAssetPage() {
  const navigate = useNavigate()
  const { token, user, requestActionChallenge, verifyOtp } = useAuth()
  const [form, setForm] = useState({ title: '', type: 'Investment', value: '', description: '' })
  const [attachment, setAttachment] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState<AuthChallengeResponse | null>(null)
  const [mfaCode, setMfaCode] = useState('')

  if (user?.role === 'nominee') {
    return <Navigate to="/dashboard" replace />
  }

  const isValid = form.title.trim().length >= 3 && form.value.trim().length > 0 && form.description.trim().length >= 10

  const buildAssetPayload = async () => {
    const filePayload = attachment
      ? {
          name: attachment.name,
          mimeType: attachment.type as 'application/pdf' | 'image/jpeg' | 'image/png',
          base64: await toBase64(attachment),
        }
      : undefined

    return {
    title: form.title.trim(),
    type: form.type,
    details: form.description.trim(),
    financialData: form.value.trim(),
      file: filePayload,
    }
  }

  const submitAsset = async () => {
    if (!token) {
      throw new Error('Authentication required.')
    }

    const response = await createAsset(await buildAssetPayload(), token)
    setSuccess('Asset successfully added to your LOOM vault.')
    setForm({ title: '', type: 'Investment', value: '', description: '' })
    setAttachment(null)
    window.setTimeout(() => navigate(`/assets/${response.assetId}`), 500)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValid || !token) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await submitAsset()
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to publish the asset.'
      if (message.includes('Recent MFA verification required')) {
        try {
          const challenge = await requestActionChallenge({ purpose: 'asset-access' })
          setMfaChallenge(challenge)
          setMfaCode('')
          setError('Complete the MFA step below, then we will finish publishing the asset.')
        } catch (challengeError) {
          setError(challengeError instanceof Error ? challengeError.message : message)
        }
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyMfa = async () => {
    if (!mfaChallenge || !mfaCode.trim()) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      await verifyOtp({
        pendingToken: mfaChallenge.pendingToken,
        challengeId: mfaChallenge.challengeId,
        code: mfaCode.trim(),
        purpose: mfaChallenge.purpose,
      })
      setMfaChallenge(null)
      setMfaCode('')
      await submitAsset()
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify MFA.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Add Asset</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Register a new inheritance asset.</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Capture the asset details and store them in the secure LOOM vault.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
        <label className="space-y-3 text-sm text-slate-300">
          <span className="block text-slate-400">Asset name</span>
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Enter asset name"
            className="w-full rounded-3xl border border-slate-800/80 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
          />
        </label>

        <label className="space-y-3 text-sm text-slate-300">
          <span className="block text-slate-400">Asset type</span>
          <select
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            className="w-full rounded-3xl border border-slate-800/80 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
          >
            {assetTypes.map((type) => (
              <option key={type} value={type} className="bg-slate-950 text-white">
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-3 text-sm text-slate-300">
          <span className="block text-slate-400">Financial data or estimated value</span>
          <input
            value={form.value}
            onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
            placeholder="$120,000"
            className="w-full rounded-3xl border border-slate-800/80 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
          />
        </label>

        <label className="space-y-3 text-sm text-slate-300">
          <span className="block text-slate-400">Description</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            rows={5}
            placeholder="Describe the asset and inheritance instructions."
            className="w-full rounded-3xl border border-slate-800/80 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
          />
        </label>

        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 p-5">
          <p className="text-sm text-slate-300">Document or photo upload</p>
          <p className="mt-2 text-sm text-slate-400">
            Upload a PDF or take a photo of a document from your camera. JPG and PNG are supported.
          </p>
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png"
            capture="environment"
            className="mt-4 block w-full text-sm text-slate-300 file:mr-4 file:rounded-2xl file:border file:border-slate-700 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={(event) => setAttachment(event.target.files?.[0] || null)}
          />
          {attachment ? (
            <p className="mt-3 text-sm text-cyan-200">
              {attachment.name} selected ({Math.ceil(attachment.size / 1024)} KB)
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Optional. Add a scanned document or mobile photo.</p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-400">{isValid ? 'Ready to publish.' : 'Complete all fields to continue.'}</div>
          <Button type="submit" disabled={!isValid || loading} className="w-full sm:w-auto">
            {loading ? 'Publishing...' : 'Publish asset'}
          </Button>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-200">
            {success}
          </div>
        ) : null}

        {mfaChallenge ? (
          <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            <p className="font-semibold">Recent MFA required before publishing this asset.</p>
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
                {loading ? 'Verifying...' : 'Verify and publish'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => { setMfaChallenge(null); setMfaCode('') }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  )
}

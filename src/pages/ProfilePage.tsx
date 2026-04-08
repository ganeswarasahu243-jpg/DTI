import { useEffect, useState } from 'react'
import { fetchAssets } from '../assets/api'
import { updateCurrentUserProfile } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [preferredOtpChannel, setPreferredOtpChannel] = useState<'email' | 'sms'>('email')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setName(user?.name || '')
    setPhone(user?.phone || '')
    setPreferredOtpChannel(user?.preferredOtpChannel || 'email')
  }, [user])

  async function handleSave() {
    if (!token) {
      setError('Authentication required. Please sign in again.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await updateCurrentUserProfile({
        name,
        phone: phone.trim() || null,
        preferredOtpChannel,
      }, token)
      updateUser(response.user)
      setSuccess('Profile updated successfully.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update your profile.')
    } finally {
      setSaving(false)
    }
  }

  async function handleExport() {
    if (!token || !user) {
      setError('Authentication required. Please sign in again.')
      return
    }

    setExporting(true)
    setError('')
    setSuccess('')

    try {
      const assetsResponse = await fetchAssets(token)
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        profile: {
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone || null,
          preferredOtpChannel: user.preferredOtpChannel || 'email',
          inactivityTimerDays: user.inactivityTimerDays || 60,
          emailVerifiedAt: user.emailVerifiedAt || null,
          mfa: user.mfa || { email: false, totp: false },
        },
        assets: assetsResponse.assets.map((asset) => ({
          id: asset.id,
          title: asset.title,
          type: asset.type,
          ownerName: asset.ownerName || user.name,
          ownerEmail: asset.ownerEmail || user.email,
          hasFile: asset.hasFile,
          fileMimeType: asset.fileMimeType,
          updatedAt: asset.updatedAt,
        })),
      }

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const safeEmail = user.email.replace(/[^a-z0-9.-]/gi, '_')
      anchor.href = url
      anchor.download = `loom-profile-report-${safeEmail}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setSuccess('Profile report exported successfully.')
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export your report.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Profile</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Manage your LOOM identity.</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Update your live account details and download a current account report from the authenticated session.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.6fr_0.4fr]">
        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
          <div className="grid gap-4">
            <label className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-6">
              <p className="text-sm text-slate-400">Name</p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
                placeholder="Enter your full name"
              />
            </label>

            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-6">
              <p className="text-sm text-slate-400">Email</p>
              <p className="mt-2 text-xl font-semibold text-white">{user?.email || 'Unavailable'}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">Email is managed by your authenticated account.</p>
            </div>

            <label className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-6">
              <p className="text-sm text-slate-400">Phone</p>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
                placeholder="+91..."
              />
            </label>

            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-6">
              <p className="text-sm text-slate-400">Role</p>
              <p className="mt-2 text-xl font-semibold capitalize text-white">{user?.role || 'Unavailable'}</p>
            </div>

            <label className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-6">
              <p className="text-sm text-slate-400">Preferred OTP channel</p>
              <select
                value={preferredOtpChannel}
                onChange={(event) => setPreferredOtpChannel(event.target.value as 'email' | 'sms')}
                className="mt-3 w-full rounded-2xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </label>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </Button>
            <Button variant="secondary" className="w-full" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export report'}
            </Button>
          </div>

          {error ? <div className="mt-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
          {success ? <div className="mt-6 rounded-3xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-200">{success}</div> : null}
        </div>

        <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 p-7 shadow-xl shadow-slate-950/10">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Snapshot</p>
          <p className="mt-3 text-slate-400">This page is connected to the live backend session and now supports direct account edits plus export.</p>
          <div className="mt-6 space-y-4">
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">Preferred OTP channel</p>
              <p className="mt-2 text-lg font-semibold text-white">{user?.preferredOtpChannel || preferredOtpChannel || 'email'}</p>
            </div>
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">Inactivity timer</p>
              <p className="mt-2 text-lg font-semibold text-white">{user?.inactivityTimerDays || 60} days</p>
            </div>
            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5">
              <p className="text-sm text-slate-400">MFA enabled</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {user?.mfa?.email || user?.mfa?.totp ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

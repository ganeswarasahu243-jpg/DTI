import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { AuthChallengeResponse, UserRole } from '../auth/types'
import { Button } from '../components/ui/Button'
import { PageTransition } from '../components/ui/PageTransition'
import { Reveal } from '../components/ui/Reveal'
import { Spinner } from '../components/ui/Spinner'
import { ThemeToggle } from '../components/ui/ThemeToggle'

const demoUsers = [
  { label: 'User demo', email: 'owner@loom-demo.local', password: 'DemoPass123!' },
  { label: 'Nominee demo', email: 'priya@loom-demo.local', password: 'DemoPass123!' },
]

const socialProviders = ['Google', 'Apple', 'Microsoft'] as const

export default function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { authMode, login, signup, verifyOtp, loginWithGoogle, user } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [challenge, setChallenge] = useState<AuthChallengeResponse | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'user' as UserRole })

  const redirectTo = (location.state as { from?: string } | null)?.from || '/dashboard'

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, user])

  const emailLooksValid = form.email.trim().length > 3 && /\S+@\S+\.\S+/.test(form.email)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!challenge && !emailLooksValid) {
        throw new Error('Enter a valid email address to continue.')
      }

      if (!challenge && mode === 'signup' && form.name.trim().length < 2) {
        throw new Error('Enter your full name to create the account.')
      }

      if (!challenge && mode === 'signup' && form.password.length < 8) {
        throw new Error('Password must be at least 8 characters for signup.')
      }

      if (challenge) {
        await verifyOtp({
          pendingToken: challenge.pendingToken,
          challengeId: challenge.challengeId,
          code: otpCode,
          purpose: challenge.purpose || 'login',
        })
      } else {
        const nextChallenge =
          mode === 'login'
            ? await login({ email: form.email, password: form.password })
            : await signup({
                email: form.email,
                password: form.password,
                name: form.name,
                role: form.role,
              })

        if ('token' in nextChallenge) {
          return
        }

        setChallenge(nextChallenge)
        setOtpCode('')
        return
      }

      navigate(redirectTo)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to authenticate.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      await loginWithGoogle()
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to start Google authentication.')
      setLoading(false)
    }
  }

  return (
    <PageTransition className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <div className="mt-4 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Reveal>
            <section className="hero-panel section-shell rounded-[2.5rem] p-7 sm:p-10">
              <div className="trust-chip text-xs font-semibold uppercase tracking-[0.32em]">
                <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                Secure access workspace
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-5xl">
                Sign in with calm, clear security.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-[var(--text-secondary)]">
                {authMode === 'supabase'
                  ? 'LOOM now uses Supabase email OTP for sign in and signup, while the platform keeps trusted-role separation and secure claim workflows.'
                  : 'LOOM keeps onboarding simple while still enforcing MFA, trusted-role separation, and secure recovery steps for inheritance workflows.'}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="panel card-hover rounded-[2rem] p-5">
                  <LockKeyhole className="h-5 w-5 text-[var(--accent)]" />
                  <p className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{authMode === 'supabase' ? 'Email OTP auth' : 'Protected by MFA'}</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                    {authMode === 'supabase'
                      ? 'Your email receives the login or signup code directly through Supabase.'
                      : 'Every authenticated session passes through OTP or authenticator-based verification.'}
                  </p>
                </div>
                <div className="panel card-hover rounded-[2rem] p-5">
                  <KeyRound className="h-5 w-5 text-[var(--accent-strong)]" />
                  <p className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Role-aware access</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                    Owners, nominees, and admins are guided through separate permissions and workflows.
                  </p>
                </div>
              </div>

              <div className="mt-8 panel rounded-[2rem] p-5">
                <p className="eyebrow">Demo accounts</p>
                <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                  Development helpers are available for user and nominee sign-in only. Admin credentials stay backend-only.
                </p>
                <div className="mt-4 grid gap-3">
                  {demoUsers.map((demoUser, index) => (
                    <Reveal key={demoUser.email} delay={index * 0.05}>
                      <button
                        type="button"
                        onClick={async () => {
                          setMode('login')
                          setChallenge(null)
                          setError('')
                          setForm((prev) => ({
                            ...prev,
                            email: demoUser.email,
                            password: demoUser.password,
                          }))
                          
                          setLoading(true)
                          try {
                            const response = await login({ email: demoUser.email, password: demoUser.password })
                            if (!('token' in response)) {
                              setChallenge(response)
                              setOtpCode('')
                            }
                          } catch (submitError) {
                            setError(submitError instanceof Error ? submitError.message : 'Unable to authenticate.')
                          } finally {
                            setLoading(false)
                          }
                        }}
                        className="card-hover rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-left transition"
                      >
                        <p className="font-semibold text-[var(--text-primary)]">{demoUser.label}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{demoUser.email}</p>
                        <p className="mt-1 text-sm text-[var(--accent)]">{demoUser.password}</p>
                      </button>
                    </Reveal>
                  ))}
                </div>
              </div>
            </section>
          </Reveal>

          <Reveal delay={0.08}>
            <section className="panel rounded-[2.5rem] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">{challenge ? 'Step 2' : 'Step 1'}</p>
                  <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">
                    {challenge
                      ? challenge.purpose === 'email-verification'
                        ? 'Verify your email'
                        : 'Verify your secure code'
                      : mode === 'login'
                        ? 'Welcome back'
                        : 'Create your LOOM workspace'}
                  </h2>
                </div>
                <div className="icon-chip">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

                <div className="mt-6 flex gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
                <button
                  type="button"
                  className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-300 ease-in-out ${
                    mode === 'login' ? 'bg-[var(--accent-soft)] text-[var(--text-primary)] shadow-[0_12px_28px_-18px_rgba(56,189,248,0.9)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => {
                    setMode('login')
                    setChallenge(null)
                    setError('')
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-300 ease-in-out ${
                    mode === 'signup' ? 'bg-[var(--accent-soft)] text-[var(--text-primary)] shadow-[0_12px_28px_-18px_rgba(56,189,248,0.9)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => {
                    setMode('signup')
                    setChallenge(null)
                    setError('')
                  }}
                >
                  Sign up
                </button>
              </div>

              {!challenge ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {socialProviders.map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      disabled={provider !== 'Google' || authMode !== 'supabase' || loading}
                      onClick={provider === 'Google' && authMode === 'supabase' ? handleGoogleLogin : undefined}
                      className={`rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm transition-all duration-300 ease-in-out ${
                        provider === 'Google' && authMode === 'supabase'
                          ? 'text-[var(--text-primary)] hover:-translate-y-1 hover:border-[var(--border-strong)]'
                          : 'text-[var(--text-secondary)] opacity-70'
                      }`}
                    >
                      {provider}
                      <span className="ml-2 text-[var(--text-muted)]">
                        {provider === 'Google' && authMode === 'supabase' ? 'OAuth' : 'Soon'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                {!challenge && mode === 'signup' ? (
                  <>
                    <label className="block text-sm text-[var(--text-primary)]">
                      <span className="mb-2 block text-[var(--text-secondary)]">Full name</span>
                      <input
                        type="text"
                        placeholder="Ariana Ray"
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        className="field-input"
                        required
                      />
                    </label>

                    <label className="block text-sm text-[var(--text-primary)]">
                      <span className="mb-2 block text-[var(--text-secondary)]">Role</span>
                      <select
                        value={form.role}
                        onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
                        className="field-input"
                      >
                        <option value="user">User</option>
                        <option value="nominee">Nominee</option>
                      </select>
                    </label>

                    <AnimatePresence>
                      {form.role === 'nominee' ? (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-4 text-sm text-[var(--text-primary)]"
                        >
                          Nominee signup stays connected to the owner workflow. Use the nominee demo account for testing or ask the owner to invite you from their trusted circle.
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </>
                ) : null}

                {challenge ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5"
                  >
                    <label className="block text-sm text-[var(--text-primary)]">
                      <span className="mb-2 block text-[var(--text-secondary)]">
                        {challenge.purpose === 'email-verification'
                          ? 'Email verification code'
                          : challenge.channel === 'totp'
                            ? 'Authenticator code'
                            : 'Email OTP'}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="field-input tracking-[0.3em]"
                        required
                      />
                    </label>

                    <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                      {challenge.purpose === 'email-verification'
                        ? <>We sent a verification code to your email address before activating your account.</>
                        : <>MFA is required for every login. Channel: <span className="font-semibold text-[var(--text-primary)]">{challenge.channel}</span>.</>}
                      {challenge.devOtp ? (
                        <span className="mt-2 block text-[var(--accent)]">Dev OTP: {challenge.devOtp}</span>
                      ) : null}
                    </div>
                  </motion.div>
                ) : (
                  <>
                    <label className="block text-sm text-[var(--text-primary)]">
                      <span className="mb-2 block text-[var(--text-secondary)]">Email</span>
                      <input
                        type="email"
                        placeholder="you@loom.local"
                        value={form.email}
                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                        className="field-input"
                        required
                      />
                      {form.email && !emailLooksValid ? (
                        <span className="mt-2 block text-sm text-amber-500">Check the email format before continuing.</span>
                      ) : null}
                    </label>

                    {authMode === 'supabase' ? (
                      <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                        We will send a 6-digit code to your email address through Supabase. No password is required for this flow.
                      </div>
                    ) : (
                      <label className="block text-sm text-[var(--text-primary)]">
                        <span className="mb-2 block text-[var(--text-secondary)]">Password</span>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            value={form.password}
                            onChange={(event) => setForm({ ...form, password: event.target.value })}
                            className="field-input pr-12"
                            required
                          />
                          <button
                            type="button"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowPassword((current) => !current)}
                            className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-secondary)] transition hover:bg-black/5 hover:text-[var(--text-primary)]"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {mode === 'signup' ? (
                          <span className="mt-2 block text-sm text-[var(--text-muted)]">Use at least 8 characters for new accounts.</span>
                        ) : null}
                      </label>
                    )}
                  </>
                )}

                <AnimatePresence mode="popLayout">
                  {error ? (
                    <motion.div
                      key="auth-error"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-[1.75rem] border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
                    >
                      {error}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" className="flex-1">
                    {loading ? <Spinner className="border-slate-900/20 border-t-slate-950" /> : null}
                    {challenge
                      ? challenge.purpose === 'email-verification'
                        ? 'Verify email'
                        : 'Verify OTP'
                      : mode === 'login'
                        ? 'Login securely'
                        : 'Create account'}
                  </Button>
                  {challenge ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="sm:w-auto"
                      onClick={() => {
                        setChallenge(null)
                        setOtpCode('')
                      }}
                    >
                      Back
                    </Button>
                  ) : null}
                </div>
              </form>

              <div className="mt-6 rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--text-secondary)]">
                {mode === 'login'
                  ? 'Need help signing in? Visit the help page for onboarding guides and recovery steps.'
                  : authMode === 'supabase'
                    ? 'Signup sends a Supabase email code first, then your app profile syncs on the next authenticated request.'
                    : 'Already registered? Switch to login to continue. Public signup does not create admin accounts.'}
              </div>
            </section>
          </Reveal>
        </div>
      </div>
    </PageTransition>
  )
}

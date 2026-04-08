import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createActionMfaChallenge, fetchCurrentUser, login as loginRequest, signup as signupRequest, verifyActionMfa, verifyEmail as verifyEmailRequest, verifyLoginMfa } from './api'
import type { AuthChallengePurpose, AuthChallengeResponse, AuthMode, AuthResponse, AuthUser, UserRole } from './types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { authenticateDemoUser, createDemoChallenge, getDemoUserFromToken, isDemoEmail, isDemoToken, verifyDemoOtp } from '../demo/session'

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  loading: boolean
  authMode: AuthMode
  refreshUser: () => Promise<void>
  updateUser: (updater: AuthUser | ((current: AuthUser | null) => AuthUser | null)) => void
  login: (payload: { email: string; password: string }) => Promise<AuthChallengeResponse | AuthResponse>
  signup: (payload: {
    email: string
    password: string
    role: UserRole
    name: string
    phone?: string
    preferredOtpChannel?: 'email' | 'sms'
    inactivityTimerDays?: number
  }) => Promise<AuthChallengeResponse>
  verifyOtp: (payload: { pendingToken: string; challengeId: string; code: string; purpose: AuthChallengePurpose }) => Promise<void>
  loginWithGoogle: () => Promise<void>
  requestActionChallenge: (payload: { purpose: Exclude<AuthChallengePurpose, 'login' | 'email-verification'> }) => Promise<AuthChallengeResponse>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const TOKEN_KEY = 'loom.auth.token'
const USER_KEY = 'loom.auth.user'

function readStoredUser() {
  const raw = localStorage.getItem(USER_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
}

function persistSession(response: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, response.token)
  localStorage.setItem(USER_KEY, JSON.stringify(response.user))
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())
  const [loading, setLoading] = useState(true)
  const authMode: AuthMode = isSupabaseConfigured ? 'supabase' : 'local'

  async function hydrateSupabaseSession(session: Session | null) {
    const accessToken = session?.access_token || null
    setToken(accessToken)

    if (!accessToken) {
      clearSession()
      setUser(null)
      return
    }

    if (isDemoToken(accessToken)) {
      const demoUser = getDemoUserFromToken(accessToken)
      setUser(demoUser)
      if (demoUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(demoUser))
      }
      return
    }

    const response = await fetchCurrentUser(accessToken)
    setUser(response.user)
    localStorage.setItem(USER_KEY, JSON.stringify(response.user))
  }

  async function refreshUser() {
    if (!token) {
      clearSession()
      setUser(null)
      return
    }

    if (isDemoToken(token)) {
      const demoUser = getDemoUserFromToken(token)
      setUser(demoUser)
      if (demoUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(demoUser))
      }
      return
    }

    const response = await fetchCurrentUser(token)
    setUser(response.user)
    localStorage.setItem(USER_KEY, JSON.stringify(response.user))
  }

  function updateUser(updater: AuthUser | ((current: AuthUser | null) => AuthUser | null)) {
    setUser((current) => {
      const nextUser = typeof updater === 'function' ? updater(current) : updater

      if (nextUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
      } else {
        localStorage.removeItem(USER_KEY)
      }

      return nextUser
    })
  }

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession()
          if (!cancelled) {
            await hydrateSupabaseSession(data.session)
          }
        } catch {
          if (!cancelled) {
            clearSession()
            setToken(null)
            setUser(null)
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
        return
      }

      if (!token) {
        setLoading(false)
        return
      }

      try {
        if (isDemoToken(token)) {
          const demoUser = getDemoUserFromToken(token)

          if (!cancelled) {
            updateUser(demoUser)
          }
          return
        }

        const response = await fetchCurrentUser(token)

        if (!cancelled) {
          updateUser(response.user)
        }
      } catch {
        if (!cancelled) {
          clearSession()
          setToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    bootstrap()

    if (isSupabaseConfigured && supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        hydrateSupabaseSession(session)
          .catch(() => {
            clearSession()
            setToken(null)
            setUser(null)
          })
          .finally(() => setLoading(false))
      })

      return () => {
        cancelled = true
        data.subscription.unsubscribe()
      }
    }

    return () => {
      cancelled = true
    }
  }, [token])

  async function login(payload: { email: string; password: string }) {
    const normalizedEmail = payload.email.trim().toLowerCase()

    if (isDemoEmail(normalizedEmail)) {
      try {
        const response = await loginRequest({
          email: normalizedEmail,
          password: payload.password,
        })

        if ('token' in response) {
          persistSession(response)
          setToken(response.token)
          setUser(response.user)
        }

        return response
      } catch {
        const response = authenticateDemoUser({
          email: normalizedEmail,
          password: payload.password,
        })
        persistSession(response)
        setToken(response.token)
        setUser(response.user)
        return response
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        requiresMfa: true,
        purpose: 'login',
        challengeId: normalizedEmail,
        pendingToken: normalizedEmail,
        channel: 'email',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }
    }

    const response = await loginRequest(payload)
    if ('token' in response) {
      persistSession(response)
      setToken(response.token)
      setUser(response.user)
    }
    return response
  }

  async function signup(payload: {
    email: string
    password: string
    role: UserRole
    name: string
    phone?: string
    preferredOtpChannel?: 'email' | 'sms'
    inactivityTimerDays?: number
  }) {
    if (isSupabaseConfigured && supabase) {
      const email = payload.email.trim().toLowerCase()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            name: payload.name,
            role: payload.role,
            phone: payload.phone || null,
            preferredOtpChannel: payload.preferredOtpChannel || 'email',
            inactivityTimerDays: payload.inactivityTimerDays || null,
          },
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        requiresEmailVerification: true,
        purpose: 'email-verification',
        challengeId: email,
        pendingToken: email,
        channel: 'email',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }
    }

    return signupRequest(payload)
  }

  async function verifyOtp(payload: { pendingToken: string; challengeId: string; code: string; purpose: AuthChallengePurpose }) {
    const purpose = payload.purpose || 'login'

    if (isDemoToken(token) && purpose !== 'login' && purpose !== 'email-verification') {
      verifyDemoOtp(payload.code)
      return
    }

    if (isSupabaseConfigured && supabase && (purpose === 'login' || purpose === 'email-verification')) {
      const { data, error } = await supabase.auth.verifyOtp({
        email: payload.pendingToken,
        token: payload.code,
        type: purpose === 'email-verification' ? 'signup' : 'email',
      })

      if (error) {
        throw new Error(error.message)
      }

      await hydrateSupabaseSession(data.session || null)
      return
    }

    if (purpose !== 'login' && purpose !== 'email-verification' && !token) {
      throw new Error('Authentication required.')
    }

    const response = purpose === 'email-verification'
      ? await verifyEmailRequest(payload)
      : purpose === 'login'
        ? await verifyLoginMfa(payload)
        : await verifyActionMfa({ challengeId: payload.challengeId, code: payload.code }, token)
    persistSession(response)
    setToken(response.token)
    setUser(response.user)
  }

  async function loginWithGoogle() {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Google login is available only when Supabase is configured.')
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  async function requestActionChallenge(payload: { purpose: Exclude<AuthChallengePurpose, 'login' | 'email-verification'> }) {
    if (!token) {
      throw new Error('Authentication required.')
    }

    if (isDemoToken(token)) {
      return createDemoChallenge(payload.purpose)
    }

    return createActionMfaChallenge(payload, token)
  }

  function logout() {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch(() => undefined)
    }
    clearSession()
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, authMode, refreshUser, updateUser, login, signup, verifyOtp, loginWithGoogle, requestActionChallenge, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }

  return context
}

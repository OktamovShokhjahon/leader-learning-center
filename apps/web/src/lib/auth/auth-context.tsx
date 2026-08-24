'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Role } from '@leader/shared/permissions'

/**
 * TZ §8 — the access token lives **in memory only**.
 *
 * It is never written to localStorage, sessionStorage or a readable cookie, so
 * an XSS on a panel cannot lift a long-lived credential. What survives a reload
 * is the httpOnly refresh cookie, which the browser cannot read either: on
 * mount we spend it once through the BFF to mint a fresh access token.
 *
 * That is the whole reason this is a React context and not a persisted store.
 */

export type SessionUser = {
  id: string
  fullName: string
  phone: string
  photo?: string
  locale: 'uz' | 'ru' | 'en'
  roles: { role: Role; branchId?: string | null; branchName?: string }[]
  activeBranchId: string | 'ALL' | null
  twoFactorEnabled: boolean
  mustChangePassword: boolean
  /** Set for a learner, so the cabinet can load without listing students. */
  studentId?: string
}

type AuthState = {
  user: SessionUser | null
  accessToken: string | null
  /** `loading` until the first refresh attempt settles, so guards do not flash. */
  status: 'loading' | 'authenticated' | 'anonymous'
  signIn: (payload: { user: SessionUser; accessToken: string }) => void
  signOut: () => Promise<void>
  /** Returns a usable token, refreshing first if the current one is gone. */
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * §8 — the API ends a session out from under the browser on purpose: a role
 * change, a password reset and a deactivation all revoke every session the
 * account holds, and the next request comes back `401 SESSION_REVOKED`.
 *
 * Without somewhere to report that, each panel screen just rendered the error
 * and sat there — "This session is no longer valid" on a page that never
 * recovered, with no way forward but a manual reload. This is the seam the data
 * layer reports through; `AuthProvider` registers the handler below.
 *
 * A module-level slot rather than context because `request()` in `use-api.ts` is
 * a plain function called from outside React as well as inside it.
 */
let reportLost: (() => void) | null = null

export function reportSessionLost() {
  reportLost?.()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('loading')

  // Concurrent callers share one refresh, so a page with several panels does
  // not rotate the refresh token three times and trip reuse detection (§8).
  const inFlight = useRef<Promise<string | null> | null>(null)

  const refresh = useCallback(async (): Promise<string | null> => {
    if (inFlight.current) return inFlight.current

    inFlight.current = (async () => {
      try {
        const response = await fetch('/api/auth/refresh', { method: 'POST' })
        if (!response.ok) return null
        const body = await response.json()
        const token: string | undefined = body?.data?.accessToken
        const nextUser: SessionUser | undefined = body?.data?.user
        if (!token) return null
        setAccessToken(token)
        if (nextUser) setUser(nextUser)
        return token
      } catch {
        return null
      } finally {
        inFlight.current = null
      }
    })()

    return inFlight.current
  }, [])

  useEffect(() => {
    let cancelled = false
    void refresh().then((token) => {
      if (cancelled) return
      setStatus(token ? 'authenticated' : 'anonymous')
    })
    return () => {
      cancelled = true
    }
  }, [refresh])

  const signIn = useCallback((payload: { user: SessionUser; accessToken: string }) => {
    setUser(payload.user)
    setAccessToken(payload.accessToken)
    setStatus('authenticated')
  }, [])

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setAccessToken(null)
      setStatus('anonymous')
    }
  }, [])

  const getToken = useCallback(async () => accessToken ?? (await refresh()), [accessToken, refresh])

  /**
   * Drop the dead session and let the guards take over.
   *
   * Deliberately not a redirect from here: `RequirePermission` and `PanelShell`
   * already send an anonymous visitor to `/login`, and doing it twice is how you
   * get a redirect fighting a render. Clearing the state is enough.
   *
   * The refresh cookie is cleared too — the session it points at is gone, so
   * leaving it would just make the next mount spend a request rediscovering that.
   */
  useEffect(() => {
    reportLost = () => {
      setUser(null)
      setAccessToken(null)
      setStatus('anonymous')
      void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    }
    return () => {
      reportLost = null
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, accessToken, status, signIn, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

/** Calls the Express API directly with the in-memory bearer token (§24.1). */
export async function apiFetch(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  return fetch(`${base}/api/v1${path}`, {
    ...init,
    headers: {
      ...init.headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
  })
}

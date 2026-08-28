'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, apiFetch, reportSessionLost } from '@/lib/auth/auth-context'

/**
 * The panels' data layer.
 *
 * TZ §24.1 puts business logic in the Express API and leaves Next.js to render,
 * so every panel screen reads through here: one place that attaches the
 * in-memory bearer token, unwraps the `{ data }` envelope, and surfaces the
 * API's error *code* so the UI can translate it (§21.2 — the API never sends a
 * sentence it cannot translate).
 */

export type ApiError = { code: string; message: string; details?: Record<string, unknown> }

export async function request<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const response = await apiFetch(path, token, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      /**
       * §8 — a `401` here does not mean "this screen failed", it means the
       * session is over: revoked because the account's role changed, its
       * password was reset, or it was deactivated. Rendering that as an error
       * box leaves every panel stuck on a dead page. Report it once and let the
       * auth context clear the session so the guards send them to sign in.
       */
      if (response.status === 401) reportSessionLost()
      return { data: null, error: body?.error ?? { code: 'UNKNOWN', message: 'Request failed' } }
    }
    return { data: (body?.data ?? null) as T, error: null }
  } catch {
    return {
      data: null,
      error: { code: 'UPSTREAM_UNAVAILABLE', message: 'The API is not reachable' },
    }
  }
}

/** A GET that re-runs when `path` changes, with loading and error state. */
export function useQuery<T>(path: string | null) {
  const { getToken, status } = useAuth()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  // A query that will never run must not start out `loading` — a null path is
  // how callers express "not applicable" (CrmDashboard gates its fetches that
  // way), and leaving the flag set renders a spinner that never resolves.
  const [loading, setLoading] = useState(Boolean(path) && status === 'authenticated')
  // Guards against a slow earlier response overwriting a newer one.
  const generation = useRef(0)

  const run = useCallback(async () => {
    if (!path || status !== 'authenticated') {
      setLoading(false)
      return
    }
    const current = ++generation.current
    setLoading(true)
    const token = await getToken()
    const result = await request<T>(path, token)
    if (current !== generation.current) return
    setData(result.data)
    setError(result.error)
    setLoading(false)
  }, [path, getToken, status])

  useEffect(() => {
    void run()
  }, [run])

  return { data, error, loading, refetch: run }
}

/** A mutation with its own pending and error state; returns the parsed body. */
export function useMutation<TBody, TResult>(
  path: string | ((body: TBody) => string),
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
) {
  const { getToken } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const mutate = useCallback(
    async (body?: TBody): Promise<TResult | null> => {
      setPending(true)
      setError(null)
      const token = await getToken()
      const url = typeof path === 'function' ? path(body as TBody) : path
      const result = await request<TResult>(url, token, {
        method,
        ...(body !== undefined && method !== 'DELETE'
          ? { body: JSON.stringify(body) }
          : {}),
      })
      setPending(false)
      if (result.error) {
        setError(result.error)
        return null
      }
      return result.data
    },
    [path, method, getToken],
  )

  return { mutate, pending, error }
}

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/** Turn a stored `/uploads/...` path into a full URL for `<video>` / `<iframe>`. */
export function mediaUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Open a blank tab *synchronously*, before any `await` in the click handler
 * that calls this. A browser only honours `window.open` while it is still
 * inside the click's user-activation window, which ends the moment the
 * handler yields on a promise (e.g. `await getToken()`) — call this as the
 * very first statement, then hand the returned tab to `openAuthenticatedFile`.
 */
export function openBlankTab(): Window | null {
  return window.open('', '_blank')
}

/**
 * Redirect an already-opened tab (see `openBlankTab`) to an authenticated API
 * response (PDF, CSV, ...).
 *
 * Every download route needs the bearer token (§8's tokens are never
 * cookies), so a plain `<a href>`/`window.open(url)` would 401 — the request
 * has to carry the header itself, then hand the browser a blob: URL to open.
 */
export async function openAuthenticatedFile(
  path: string,
  token: string | null,
  tab?: Window | null,
): Promise<boolean> {
  try {
    const response = await apiFetch(path, token)
    if (!response.ok) {
      tab?.close()
      return false
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    if (tab) tab.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return true
  } catch {
    tab?.close()
    return false
  }
}

/**
 * Save an authenticated API response as a file, under the name the route gave
 * it in `content-disposition`.
 *
 * A workbook is a download, not something to read in a tab, and routing it
 * through `openBlankTab` cost both: the popup blocker can refuse the tab
 * outright, and a blob: URL that survives it downloads as a UUID rather than
 * `students-2026-08-28.xlsx`. An `<a download>` needs no popup and keeps the
 * name.
 */
export async function downloadAuthenticatedFile(
  path: string,
  token: string | null,
  fallbackName: string,
): Promise<boolean> {
  try {
    const response = await apiFetch(path, token)
    if (!response.ok) return false
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filenameFromResponse(response) ?? fallbackName
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return true
  } catch {
    return false
  }
}

/** Read `filename="..."` (or RFC 5987 `filename*`) off a download response. */
function filenameFromResponse(response: Response): string | null {
  const header = response.headers.get('content-disposition')
  if (!header) return null
  const encoded = /filename[*]=(?:UTF-8'')?([^;]+)/i.exec(header)
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''))
    } catch {
      // Fall through to the plain `filename=` below.
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() ?? null
}

/** A2 — open a payment's PDF receipt in a tab already opened via `openBlankTab`. */
export function openReceipt(paymentId: string, token: string | null, tab?: Window | null): Promise<boolean> {
  return openAuthenticatedFile(`/payments/${paymentId}/receipt.pdf`, token, tab)
}

/** Upload a file to the API (SuperAdmin only). Returns the public URL path. */
export async function uploadFile(
  file: File,
  token: string | null,
): Promise<{ url: string; kind: string } | null> {
  const form = new FormData()
  form.append('file', file)
  try {
    const response = await fetch(`${API_BASE}/api/v1/uploads`, {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return null
    return body?.data ?? null
  } catch {
    return null
  }
}

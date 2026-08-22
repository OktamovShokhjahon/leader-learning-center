import type { NextResponse } from 'next/server'

/**
 * The API scopes the refresh cookie to `Path=/api/v1/auth`, which is right for a
 * client that talks to Express directly — the cookie is then never sent on any
 * other request.
 *
 * The browser, though, talks to *this* origin, where the same endpoints live
 * under `/api/auth`. Relayed unchanged, the cookie is stored against a path the
 * browser will never match, so it is silently never sent back and every refresh
 * returns 401.
 *
 * Rewriting the path here — at the proxy boundary, which is the one place that
 * knows both path spaces — keeps the API's own scoping tight and the panels
 * signed in. TZ §24.1 puts auth cookie handling in the BFF for exactly this.
 */
const API_AUTH_PATH = '/api/v1/auth'
const BFF_AUTH_PATH = '/api/auth'

export function relayAuthCookies(upstream: Response, response: NextResponse): void {
  for (const cookie of upstream.headers.getSetCookie?.() ?? []) {
    response.headers.append('set-cookie', rewritePath(cookie))
  }
}

function rewritePath(cookie: string): string {
  // Path is a single attribute; only rewrite the API's own auth path so an
  // unrelated cookie set by upstream passes through untouched.
  return cookie.replace(
    new RegExp(`(;\\s*Path=)${API_AUTH_PATH}(?=;|$)`, 'i'),
    `$1${BFF_AUTH_PATH}`,
  )
}

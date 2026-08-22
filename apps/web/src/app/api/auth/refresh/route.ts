import { NextResponse } from 'next/server'
import { relayAuthCookies } from '@/lib/auth/relay-cookies'

/**
 * TZ §8 / §24.1 — spends the httpOnly refresh cookie for a fresh access token.
 *
 * This has to go through the BFF: the refresh cookie is `SameSite=Strict` and
 * scoped to this origin, so browser code cannot read it and a cross-origin call
 * to the API would not carry it.
 *
 * The API's `/auth/refresh` returns only a token, so this also fetches
 * `/auth/me` with it. One round trip from the browser rather than two, and the
 * panel gets a usable session in a single call after a reload.
 */
export async function POST(request: Request) {
  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return NextResponse.json(
      { error: { code: 'API_NOT_CONFIGURED', message: 'API_URL is not set' } },
      { status: 503 },
    )
  }

  const cookie = request.headers.get('cookie')
  if (!cookie) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'No session' } },
      { status: 401 },
    )
  }

  try {
    const refreshed = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      cache: 'no-store',
    })

    const refreshBody = await refreshed.json().catch(() => ({}))

    if (!refreshed.ok) {
      const response = NextResponse.json(refreshBody, { status: refreshed.status })
      // A revoked or replayed token must not leave a dead cookie behind (§8).
      relayAuthCookies(refreshed, response)
      return response
    }

    const accessToken: string | undefined = refreshBody?.data?.accessToken

    let user: unknown = null
    if (accessToken) {
      const me = await fetch(`${apiUrl}/api/v1/auth/me`, {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      if (me.ok) user = (await me.json().catch(() => ({})))?.data ?? null
    }

    const response = NextResponse.json({ data: { accessToken, user } })
    // Relay the rotated refresh cookie onto our own origin.
    relayAuthCookies(refreshed, response)
    return response
  } catch {
    return NextResponse.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'The API is not reachable' } },
      { status: 502 },
    )
  }
}

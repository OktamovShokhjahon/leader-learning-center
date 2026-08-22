import { NextResponse } from 'next/server'
import { relayAuthCookies } from '@/lib/auth/relay-cookies'
import { loginSchema } from '@leader/shared/schemas'

/**
 * TZ §24.1 / §8 — the BFF exists precisely for this: auth cookie handling.
 *
 * The Express API sets the refresh token as an httpOnly cookie. That cookie is
 * scoped to the API's own host, so the browser would drop it on a cross-origin
 * response. Proxying login through the site's own origin means the cookie is
 * set first-party and the browser keeps it.
 *
 * The access token is deliberately NOT persisted here: §8 requires it to live in
 * memory in the client. It is returned in the body for the panel to hold.
 */
export async function POST(request: Request) {
  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return NextResponse.json(
      {
        error: {
          code: 'API_NOT_CONFIGURED',
          message: 'API_URL is not set. Start the api workspace and set API_URL in .env.local.',
        },
      },
      { status: 503 },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Body must be JSON' } },
      { status: 400 },
    )
  }

  const parsed = loginSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid credentials payload',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    )
  }

  try {
    const upstream = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Preserved so the API's progressive lockout keys on the real client,
        // not on this server (§8).
        ...forwardedHeaders(request),
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    })

    const body = await upstream.json().catch(() => ({}))
    const response = NextResponse.json(body, { status: upstream.status })

    relayAuthCookies(upstream, response)

    return response
  } catch {
    return NextResponse.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'The API is not reachable' } },
      { status: 502 },
    )
  }
}

function forwardedHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {}
  const forwardedFor = request.headers.get('x-forwarded-for')
  const userAgent = request.headers.get('user-agent')
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor
  if (userAgent) headers['user-agent'] = userAgent
  return headers
}

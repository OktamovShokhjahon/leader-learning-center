import { NextResponse } from 'next/server'
import { relayAuthCookies } from '@/lib/auth/relay-cookies'

/**
 * TZ §8 — logout must succeed even with an expired or missing token: the user's
 * intent is to be signed out, and an error would leave the cookie in place on
 * exactly the path where clearing it matters most.
 */
export async function POST(request: Request) {
  const apiUrl = process.env.API_URL
  const response = NextResponse.json({ data: { ok: true } })

  if (!apiUrl) return response

  try {
    const upstream = await fetch(`${apiUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Pass the refresh cookie through so the session is revoked server-side.
        ...(request.headers.get('cookie') ? { cookie: request.headers.get('cookie')! } : {}),
      },
      cache: 'no-store',
    })
    relayAuthCookies(upstream, response)
  } catch {
    // The session may outlive this call; the cookie clear below still applies.
  }

  return response
}

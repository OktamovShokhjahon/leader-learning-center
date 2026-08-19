import { NextResponse } from 'next/server'
import { quickLeadSchema } from '@leader/shared/schemas'

/**
 * TZ §24.1 — Next.js is a BFF proxy only. Business logic and persistence live in
 * the Express API; this handler validates with the shared schema (fail fast,
 * save a round trip) and forwards. It never touches MongoDB.
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

  const parsed = quickLeadSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid application',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    )
  }

  const forwardedFor = request.headers.get('x-forwarded-for') ?? ''

  try {
    const response = await fetch(`${apiUrl}/api/v1/public/leads`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    })

    const body = await response.json().catch(() => ({}))
    return NextResponse.json(body, { status: response.status })
  } catch {
    return NextResponse.json(
      { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'The API is not reachable' } },
      { status: 502 },
    )
  }
}

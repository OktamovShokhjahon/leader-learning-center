import { NextResponse } from 'next/server'
import { contactSchema } from '@leader/shared/schemas'

/** TZ §24.1 — BFF proxy only; the Express API owns persistence and notification. */
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

  const parsed = contactSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid message',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    )
  }

  try {
    const response = await fetch(`${apiUrl}/api/v1/public/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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

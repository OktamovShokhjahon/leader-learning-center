/**
 * TZ §23 — one error envelope for the whole API:
 * { "error": { "code": "INVOICE_ALREADY_PAID", "message": "...", "details": {} } }
 */
export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> }
}

export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  DUPLICATE_PHONE: 'DUPLICATE_PHONE',
  OTP_INVALID: 'OTP_INVALID',
  OTP_THROTTLED: 'OTP_THROTTLED',

  // §8 — authentication. `INVALID_CREDENTIALS` is intentionally the single
  // answer for "no such phone" and "wrong password" alike, so the endpoint
  // cannot be used to enumerate who has an account.
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  /** A refresh token was replayed — the whole family is revoked (§8). */
  TOKEN_REUSED: 'TOKEN_REUSED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  TOTP_REQUIRED: 'TOTP_REQUIRED',
  TOTP_INVALID: 'TOTP_INVALID',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  PASSWORD_TOO_COMMON: 'PASSWORD_TOO_COMMON',
  PIN_INVALID: 'PIN_INVALID',
  CONFLICT: 'CONFLICT',
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
  BRANCH_SCOPE_REQUIRED: 'BRANCH_SCOPE_REQUIRED',
  INTERNAL: 'INTERNAL',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    }
  }

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new ApiError(400, ERROR_CODES.VALIDATION_FAILED, message, details)
  }
  static unauthenticated(message = 'Authentication required') {
    return new ApiError(401, ERROR_CODES.UNAUTHENTICATED, message)
  }
  static forbidden(message = 'Not allowed') {
    return new ApiError(403, ERROR_CODES.FORBIDDEN, message)
  }
  static notFound(message = 'Not found') {
    return new ApiError(404, ERROR_CODES.NOT_FOUND, message)
  }
  static rateLimited(message = 'Too many requests') {
    return new ApiError(429, ERROR_CODES.RATE_LIMITED, message)
  }
  static conflict(message: string, details?: Record<string, unknown>) {
    return new ApiError(409, ERROR_CODES.CONFLICT, message, details)
  }
}

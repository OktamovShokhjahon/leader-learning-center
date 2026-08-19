import jwt from 'jsonwebtoken'
import type { Response } from 'express'
import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import { hashToken, randomToken } from '../../config/crypto.js'
import { Session, type SessionDocument } from './session.model.js'

/**
 * TZ §8 — "JWT access token (15 min, in memory) + refresh token (30 days,
 * httpOnly Secure SameSite=Strict cookie, rotated on each use, reuse detection
 * revokes the whole family)."
 *
 * The access token deliberately carries almost nothing: subject and session id.
 * Role and active branch are read from the session document on every request, so
 * a branch switch or a revoked role takes effect immediately rather than at the
 * end of the token's 15 minutes — and so a stolen token cannot assert a branch
 * of its own choosing (§5.2).
 */
export const REFRESH_COOKIE = 'leader_rt'

export type AccessTokenClaims = {
  sub: string
  sid: string
}

/** How many rotations back a replayed token is still recognised as reuse. */
const REUSE_MEMORY = 10

export function signAccessToken(userId: string, sessionId: string): string {
  return jwt.sign({ sub: userId, sid: sessionId }, env.jwtSecret, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    issuer: 'leader-lc',
  })
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { issuer: 'leader-lc' })
    if (typeof payload === 'string' || !payload.sub || typeof payload.sid !== 'string') {
      throw new ApiError(401, ERROR_CODES.TOKEN_INVALID, 'Malformed access token')
    }
    return { sub: String(payload.sub), sid: payload.sid }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof jwt.TokenExpiredError) {
      // A distinct code so the client knows to refresh silently rather than
      // bouncing the user to the login screen.
      throw new ApiError(401, ERROR_CODES.TOKEN_EXPIRED, 'Access token expired')
    }
    throw new ApiError(401, ERROR_CODES.TOKEN_INVALID, 'Invalid access token')
  }
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
}

/** Starts a new family: one session document per device (§8, PIC 10). */
export async function createSession(input: {
  userId: string
  activeBranchId: string | 'ALL' | null
  deviceName?: string
  userAgent?: string
  ip?: string
}): Promise<{ session: SessionDocument; refreshToken: string; accessToken: string }> {
  const refreshToken = randomToken()

  const session = await Session.create({
    userId: input.userId,
    tokenHash: hashToken(refreshToken),
    activeBranchId: input.activeBranchId,
    deviceName: input.deviceName,
    userAgent: input.userAgent,
    ip: input.ip,
    expiresAt: refreshExpiry(),
  })

  return {
    session,
    refreshToken,
    accessToken: signAccessToken(input.userId, session.id),
  }
}

/**
 * Rotation with reuse detection (§8).
 *
 * Three outcomes:
 * 1. the digest is the session's current one — rotate and issue a new pair;
 * 2. the digest is in `usedTokenHashes` — the token was replayed after the real
 *    client had already rotated it, which means it was captured. The entire
 *    family is revoked and the holder of the *new* token is signed out too: an
 *    inconvenient re-login beats leaving an attacker inside the account;
 * 3. no match at all — an expired, revoked or forged token.
 */
export async function rotateRefreshToken(
  presentedToken: string,
  meta: { ip?: string; userAgent?: string },
): Promise<{ session: SessionDocument; refreshToken: string; accessToken: string }> {
  const digest = hashToken(presentedToken)

  const session = await Session.findOne({ tokenHash: digest })

  if (!session) {
    const reused = await Session.findOne({ usedTokenHashes: digest })
    if (reused) {
      logger.error(
        { sessionId: reused.id, userId: reused.userId?.toString(), ip: meta.ip },
        'refresh token reuse detected — revoking session family',
      )
      reused.revokedAt = new Date()
      reused.revokedReason = 'reuse_detected'
      await reused.save()
      throw new ApiError(
        401,
        ERROR_CODES.TOKEN_REUSED,
        'This session was signed out because its token was reused. Please sign in again.',
      )
    }
    throw new ApiError(401, ERROR_CODES.TOKEN_INVALID, 'Invalid refresh token')
  }

  if (session.revokedAt) {
    throw new ApiError(401, ERROR_CODES.SESSION_REVOKED, 'This session was signed out')
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(401, ERROR_CODES.TOKEN_EXPIRED, 'Session expired, please sign in again')
  }

  const refreshToken = randomToken()
  session.usedTokenHashes = [...session.usedTokenHashes, digest].slice(-REUSE_MEMORY)
  session.tokenHash = hashToken(refreshToken)
  // The 30 days are a sliding window: an actively used device stays signed in.
  session.expiresAt = refreshExpiry()
  session.lastUsedAt = new Date()
  if (meta.ip) session.ip = meta.ip
  if (meta.userAgent) session.userAgent = meta.userAgent
  await session.save()

  return {
    session,
    refreshToken,
    accessToken: signAccessToken(session.userId.toString(), session.id),
  }
}

export async function revokeSession(
  sessionId: string,
  reason: NonNullable<SessionDocument['revokedReason']>,
): Promise<void> {
  await Session.updateOne(
    { _id: sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  )
}

/**
 * §8 — a password change, a role change or a disabled account invalidates every
 * device. `exceptSessionId` keeps the device that performed the change signed in,
 * which is what a user changing their own password expects.
 */
export async function revokeAllSessions(
  userId: string,
  reason: NonNullable<SessionDocument['revokedReason']>,
  exceptSessionId?: string,
): Promise<number> {
  const result = await Session.updateMany(
    {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}),
    },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  )
  return result.modifiedCount
}

/** §8 — httpOnly, Secure, SameSite=Strict. */
export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    // Strict rather than Lax: nothing on the public site needs the session to
    // survive a cross-site navigation, and the panels are same-site.
    sameSite: 'strict',
    // A Secure cookie is silently dropped by the browser on plain http, which
    // would make local development mysteriously fail to stay signed in.
    secure: env.isProduction,
    domain: env.COOKIE_DOMAIN,
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  })
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.isProduction,
    domain: env.COOKIE_DOMAIN,
    path: '/api/v1/auth',
  })
}

import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import {
  loginSchema,
  changePasswordSchema,
  branchSwitchSchema,
  totpVerifySchema,
  totpDisableSchema,
} from '@leader/shared/schemas'
import { validateBody } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, currentUser } from '../../middleware/auth.js'
import { hashToken } from '../../config/crypto.js'
import { User, isSuperadmin } from '../users/user.model.js'
import { Session } from './session.model.js'
import { verifyPassword, burnPasswordTime } from './password.service.js'
import { assertNotLocked, recordFailure } from './lockout.service.js'
import {
  login,
  listSessions,
  terminateSession,
  changePassword,
  switchBranch,
  describeUser,
  beginTwoFactorSetup,
  confirmTwoFactor,
  disableTwoFactor,
} from './auth.service.js'
import {
  REFRESH_COOKIE,
  rotateRefreshToken,
  revokeSession,
  setRefreshCookie,
  clearRefreshCookie,
} from './token.service.js'
import { generateSecret, totpUri } from './totp.service.js'

/**
 * TZ §23 — the `AUTH` block.
 *
 * The access token is returned in the body for the client to hold **in memory**
 * (§8); only the refresh token is a cookie, and it is httpOnly so no script can
 * read it. That split is what makes an XSS on the panels survivable.
 */
export const authRouter = Router()

/**
 * §8 — `express-rate-limit` in front of the progressive lockout. This one is
 * per-IP and blunt; the lockout in `lockout.service.ts` is per phone+IP and is
 * what actually implements the 5 → 1 min / 10 → 15 min rule.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // A correct password must not be counted against the attacker's budget, so a
  // user who mistypes once and then succeeds is not punished.
  skipSuccessfulRequests: true,
  message: { error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many attempts' } },
})

function readRefreshToken(req: { cookies?: Record<string, string>; body?: unknown }): string {
  const fromCookie = req.cookies?.[REFRESH_COOKIE]
  if (fromCookie) return fromCookie
  // The mobile/offline client (§10) has no cookie jar, so it may send the token
  // in the body instead. Browsers never take this path.
  const body = req.body as { refreshToken?: unknown } | undefined
  if (typeof body?.refreshToken === 'string') return body.refreshToken
  throw new ApiError(401, ERROR_CODES.TOKEN_INVALID, 'No refresh token supplied')
}

authRouter.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncRoute(async (req, res) => {
    const result = await login(req.body, req)
    setRefreshCookie(res, result.refreshToken)
    res.json({
      data: {
        accessToken: result.accessToken,
        user: await describeUser(result.user, result.session),
      },
    })
  }),
)

authRouter.post(
  '/refresh',
  asyncRoute(async (req, res) => {
    const presented = readRefreshToken(req)
    const rotated = await rotateRefreshToken(presented, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    })
    setRefreshCookie(res, rotated.refreshToken)
    res.json({ data: { accessToken: rotated.accessToken } })
  }),
)

authRouter.post(
  '/logout',
  asyncRoute(async (req, res) => {
    // Logout must succeed even with an expired or missing token — the user's
    // intent is to be signed out, and returning an error would leave the cookie
    // in place on the one path where clearing it matters most.
    try {
      const presented = readRefreshToken(req)
      const session = await Session.findOne({ tokenHash: hashToken(presented) })
      if (session) await revokeSession(session.id, 'logout')
    } catch {
      // Nothing to revoke.
    }
    clearRefreshCookie(res)
    res.json({ data: { ok: true } })
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json({ data: await describeUser(currentUser(req), req.session!) })
  }),
)

authRouter.get(
  '/sessions',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json({ data: await listSessions(currentUser(req).id, req.session!.id) })
  }),
)

authRouter.delete(
  '/sessions/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const sessionId = String(req.params.id)
    await terminateSession(currentUser(req).id, sessionId, req)
    // Terminating the session you are holding is a valid way to sign out.
    if (sessionId === req.session!.id) clearRefreshCookie(res)
    res.json({ data: { ok: true } })
  }),
)

authRouter.post(
  '/password',
  requireAuth,
  validateBody(changePasswordSchema),
  asyncRoute(async (req, res) => {
    const result = await changePassword(currentUser(req).id, req.session!.id, req.body, req)
    res.json({ data: result })
  }),
)

/** §5.2 — the branch switcher. Guarded again inside the service. */
authRouter.post(
  '/branch',
  requireAuth,
  validateBody(branchSwitchSchema),
  asyncRoute(async (req, res) => {
    const branchId = await switchBranch(currentUser(req), req.session!, req.body.branchId, req)
    res.json({ data: { activeBranchId: branchId } })
  }),
)

/**
 * §8 — 2FA enrolment.
 *
 * The secret is returned exactly once, here, and never again: `GET /auth/me`
 * reports only whether 2FA is on. If the user loses it before confirming, they
 * start over, which is cheaper than an endpoint that hands out a live secret.
 */
authRouter.post(
  '/2fa/enable',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = currentUser(req)
    if (user.twoFactor?.enabled) {
      throw ApiError.conflict('Two-factor authentication is already enabled')
    }
    const secret = generateSecret()
    await beginTwoFactorSetup(user, secret)
    res.json({ data: { secret, uri: totpUri(secret, user.phone) } })
  }),
)

authRouter.post(
  '/2fa/verify',
  requireAuth,
  validateBody(totpVerifySchema),
  asyncRoute(async (req, res) => {
    await confirmTwoFactor(currentUser(req).id, req.body.code, req)
    res.json({ data: { enabled: true } })
  }),
)

authRouter.post(
  '/2fa/disable',
  requireAuth,
  validateBody(totpDisableSchema),
  asyncRoute(async (req, res) => {
    await disableTwoFactor(currentUser(req).id, req.body, req)
    res.json({ data: { enabled: false } })
  }),
)

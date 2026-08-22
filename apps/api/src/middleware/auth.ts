import type { RequestHandler } from 'express'
import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import { can, canFully, type Action, type Role } from '@leader/shared/permissions'
import { User, type UserDocument, isSuperadmin, roleInBranch } from '../modules/users/user.model.js'
import { Session, isSessionUsable, type SessionDocument } from '../modules/auth/session.model.js'
import { verifyAccessToken } from '../modules/auth/token.service.js'
import { getScope, runWithScope } from './branch-scope.js'
import { recordAudit } from '../modules/audit/audit.service.js'

/**
 * TZ §4.3 / §8 — authentication and authorisation middleware.
 *
 * The API is the source of truth: every protected route runs through
 * `requireAuth`, and every controller that touches data runs a `can()` check.
 * Hiding a button in the UI is a convenience, never a security control.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDocument
      session?: SessionDocument
      /** The role in force for the session's active branch. */
      role?: Role
    }
  }
}

/**
 * Verifies the bearer token, loads the session and the user, and *re-enters the
 * branch scope* with the authenticated values.
 *
 * The active branch comes from the session document, never from the token or a
 * header (§5.2): a client that edits its local storage changes nothing.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthenticated('Authentication required')
    }

    const claims = verifyAccessToken(header.slice('Bearer '.length).trim())

    const session = await Session.findById(claims.sid)
    if (!isSessionUsable(session)) {
      throw new ApiError(401, ERROR_CODES.SESSION_REVOKED, 'This session is no longer valid')
    }
    if (session.userId.toString() !== claims.sub) {
      // The token names a different user than the session it points at.
      throw new ApiError(401, ERROR_CODES.TOKEN_INVALID, 'Invalid access token')
    }

    const user = await User.findOne({ _id: claims.sub, deletedAt: null })
    if (!user) throw new ApiError(401, ERROR_CODES.TOKEN_INVALID, 'Invalid access token')
    if (!user.isActive) {
      throw new ApiError(403, ERROR_CODES.ACCOUNT_DISABLED, 'This account has been deactivated')
    }

    const activeBranchId =
      session.activeBranchId === 'ALL' ? ('ALL' as const) : session.activeBranchId?.toString()

    const role = roleInBranch(user, activeBranchId ?? null)
    if (!role) {
      // The session points at a branch this user no longer has a role in —
      // typically because their role was just revoked.
      throw ApiError.forbidden('You no longer have a role in this branch')
    }

    req.user = user
    req.session = session
    req.role = role

    // Replace the anonymous scope opened by branchScopeMiddleware with the
    // authenticated one, so every model query below is filtered by branch (§5.1).
    runWithScope(
      {
        ...getScope(),
        userId: user.id,
        role,
        branchId: activeBranchId ?? undefined,
      },
      () => next(),
    )
  })().catch(next)
}

/**
 * §4.3 — the hard role guard used at *router mount* level for money endpoints,
 * "so a mistake in a single controller cannot leak it".
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !req.role) return next(ApiError.unauthenticated())

    if (!roles.includes(req.role)) {
      /**
       * §21.3 makes "any `403` on a finance endpoint" a mandatory audit entry,
       * and §30.2 accepts the build only when a denied Admin *appears in the
       * log*. A refused attempt to read the money is exactly the event worth
       * keeping: it is the signal that someone went looking.
       *
       * Deliberately not awaited — the denial must not wait on a write, and a
       * failed audit insert must not turn a clean 403 into a 500. `recordAudit`
       * swallows its own errors.
       */
      void recordAudit({
        action: 'access.denied',
        entity: 'route',
        path: req.originalUrl,
        actorId: req.user.id,
        actorName: req.user.fullName,
        outcome: 'failure',
        reason: `requires ${roles.join(', ')}, holds ${req.role}`,
        req,
      })

      return next(ApiError.forbidden(`This area requires: ${roles.join(', ')}`))
    }

    next()
  }
}

/**
 * §4.2 — the permission map check.
 *
 * A `limited` grant passes here and is then narrowed by the service layer
 * against its §4.2 note; `requireFullGrant` is for the routes where a limited
 * grant means "not through this door at all".
 */
export function requirePermission(action: Action): RequestHandler {
  return (req, _res, next) => {
    if (!req.role) return next(ApiError.unauthenticated())
    if (!can(req.role, action)) {
      return next(ApiError.forbidden(`Your role cannot perform "${action}"`))
    }
    next()
  }
}

export function requireFullGrant(action: Action): RequestHandler {
  return (req, _res, next) => {
    if (!req.role) return next(ApiError.unauthenticated())
    if (!canFully(req.role, action)) {
      return next(ApiError.forbidden(`Your role cannot perform "${action}" without restriction`))
    }
    next()
  }
}

/**
 * §5.1 — most operational endpoints are meaningless without a single branch in
 * context. A SuperAdmin sitting in the consolidated `'ALL'` scope must pick one
 * before writing anything, or the write would land in no branch at all.
 */
export const requireSingleBranch: RequestHandler = (req, _res, next) => {
  const branchId = getScope()?.branchId
  if (!branchId || branchId === 'ALL') {
    return next(
      new ApiError(
        400,
        ERROR_CODES.BRANCH_SCOPE_REQUIRED,
        'Select a single branch before performing this action',
      ),
    )
  }
  next()
}

/** Convenience for controllers: the authenticated user, or a 401. */
export function currentUser(req: Express.Request): UserDocument {
  if (!req.user) throw ApiError.unauthenticated()
  return req.user
}

export { isSuperadmin }

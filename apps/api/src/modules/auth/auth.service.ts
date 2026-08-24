import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import type { SessionUser } from '@leader/shared/schemas'
import type { Role } from '@leader/shared/permissions'
import { encryptField, decryptField } from '../../config/crypto.js'
import { logger } from '../../config/logger.js'
import { User, type UserDocument, isSuperadmin, roleInBranch } from '../users/user.model.js'
import { Branch } from '../branches/branch.model.js'
import { Student } from '../students/student.model.js'
import { recordAudit, type RequestMeta } from '../audit/audit.service.js'
import { Session, type SessionDocument } from './session.model.js'
import { verifyPassword, hashPassword, burnPasswordTime } from './password.service.js'
import { assertNotLocked, recordFailure, clearFailures } from './lockout.service.js'
import { verifyTotp } from './totp.service.js'
import { createSession, revokeAllSessions } from './token.service.js'

/**
 * TZ §8 — Module 3.
 *
 * Two rules shape everything here:
 * - **Never say which half was wrong.** An unknown phone and a wrong password
 *   produce the identical `INVALID_CREDENTIALS` response, after the identical
 *   amount of work, so the endpoint cannot enumerate the centre's phone numbers.
 * - **Every authentication event is audited** with IP and user-agent (§8).
 */

const metaOf = (req: RequestMeta) => ({
  ip: req.ip,
  userAgent: [req.headers['user-agent']].flat()[0],
})

/**
 * Where a session starts looking.
 *
 * A SuperAdmin lands on the consolidated view — that is the boss's dashboard
 * (§5.2) and he can narrow it from the switcher. Everyone else is pinned to the
 * single branch their role belongs to; they have no switcher at all.
 */
function defaultBranchFor(user: UserDocument): string | 'ALL' | null {
  if (isSuperadmin(user)) return 'ALL'
  return user.roles.find((assignment) => assignment.branchId)?.branchId?.toString() ?? null
}

/** §8 — login by phone + password, with the optional TOTP second factor. */
export async function login(
  input: { phone: string; password: string; deviceName?: string; totpCode?: string },
  req: RequestMeta,
) {
  await assertNotLocked(input.phone, req.ip)

  const user = await User.findOne({ phone: input.phone, deletedAt: null }).select(
    '+passwordHash +twoFactor.secret',
  )

  if (!user) {
    // Spend the same time as a real verification would, then fail identically.
    await burnPasswordTime()
    await recordFailure(input.phone, req.ip)
    await recordAudit({
      action: 'auth.login',
      outcome: 'failure',
      reason: 'unknown_phone',
      req,
      after: { phone: input.phone },
    })
    throw new ApiError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Phone or password is incorrect')
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password)
  if (!passwordOk) {
    await recordFailure(input.phone, req.ip)
    await recordAudit({
      action: 'auth.login',
      actorId: user._id,
      actorName: user.fullName,
      outcome: 'failure',
      reason: 'wrong_password',
      req,
    })
    throw new ApiError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Phone or password is incorrect')
  }

  // Checked only after the password, so a disabled account is not distinguishable
  // from a wrong password to someone who does not already know the password.
  if (!user.isActive) {
    await recordAudit({
      action: 'auth.login',
      actorId: user._id,
      actorName: user.fullName,
      outcome: 'failure',
      reason: 'account_disabled',
      req,
    })
    throw new ApiError(403, ERROR_CODES.ACCOUNT_DISABLED, 'This account has been deactivated')
  }

  // Sign-in is phone + password. TZ §8 makes TOTP *mandatory* for SuperAdmin,
  // and that requirement was deliberately lifted at the client's request to keep
  // the login simple — see docs/adr/0002-optional-two-factor.md. 2FA still works
  // for any account that opts in via /auth/2fa/enable; it is simply no longer
  // forced on the boss account. Re-enabling it is a one-line change here.
  if (user.twoFactor?.enabled) {
    if (!input.totpCode) {
      throw new ApiError(
        401,
        ERROR_CODES.TOTP_REQUIRED,
        'Enter the code from your authenticator app',
      )
    }
    const secret = user.twoFactor.secret ? decryptField(user.twoFactor.secret) : null
    if (!secret || !verifyTotp(secret, input.totpCode)) {
      await recordFailure(input.phone, req.ip)
      await recordAudit({
        action: 'auth.login',
        actorId: user._id,
        actorName: user.fullName,
        outcome: 'failure',
        reason: 'wrong_totp',
        req,
      })
      throw new ApiError(401, ERROR_CODES.TOTP_INVALID, 'That code is not valid')
    }
  }

  await clearFailures(input.phone, req.ip)

  const { session, refreshToken, accessToken } = await createSession({
    userId: user.id,
    activeBranchId: defaultBranchFor(user),
    deviceName: input.deviceName,
    ...metaOf(req),
  })

  user.lastLoginAt = new Date()
  user.lastLoginIp = req.ip
  await user.save()

  await recordAudit({
    action: 'auth.login',
    actorId: user._id,
    actorName: user.fullName,
    entity: 'Session',
    entityId: session._id,
    branchId: session.activeBranchId === 'ALL' ? undefined : session.activeBranchId,
    req,
  })

  logger.info({ userId: user.id, sessionId: session.id }, 'login')

  return { user, session, refreshToken, accessToken }
}

/**
 * §8 — the sessions list, "Faol qurilmalar".
 *
 * `isCurrent` lets the UI label the device the user is holding, so nobody
 * terminates their own session by accident.
 */
export async function listSessions(userId: string, currentSessionId: string) {
  const sessions = await Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .lean()

  return sessions.map((session) => ({
    id: session._id.toString(),
    deviceName: session.deviceName ?? null,
    userAgent: session.userAgent ?? null,
    ip: session.ip ?? null,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    isCurrent: session._id.toString() === currentSessionId,
  }))
}

/** §8 — "Terminating a session invalidates its refresh family immediately." */
export async function terminateSession(userId: string, sessionId: string, req: RequestMeta) {
  const session = await Session.findOne({ _id: sessionId, userId })
  if (!session) throw ApiError.notFound('Session not found')

  if (!session.revokedAt) {
    session.revokedAt = new Date()
    session.revokedReason = 'revoked_by_user'
    await session.save()
  }

  await recordAudit({
    action: 'auth.session.terminate',
    actorId: userId,
    entity: 'Session',
    entityId: session._id,
    req,
  })
}

/** §5.2 — the branch switcher, stored server-side so it cannot be spoofed. */
export async function switchBranch(
  user: UserDocument,
  session: SessionDocument,
  branchId: string | 'ALL',
  req: RequestMeta,
) {
  if (!isSuperadmin(user)) {
    // §4.2 — only SuperAdmin may switch branch or see the consolidated scope.
    throw ApiError.forbidden('Only a SuperAdmin can switch branches')
  }

  if (branchId !== 'ALL') {
    const branch = await Branch.findOne({ _id: branchId, deletedAt: null }).lean()
    if (!branch) throw ApiError.notFound('Branch not found')
  }

  const previous = session.activeBranchId
  session.activeBranchId = branchId
  await session.save()

  await recordAudit({
    action: 'branch.switch',
    actorId: user._id,
    actorName: user.fullName,
    entity: 'Session',
    entityId: session._id,
    before: { activeBranchId: previous },
    after: { activeBranchId: branchId },
    req,
  })

  return branchId
}

/** §23 — the `GET /auth/me` payload, shared with the web app as `SessionUser`. */
export async function describeUser(
  user: UserDocument,
  session: SessionDocument,
): Promise<SessionUser> {
  const branchIds = user.roles
    .map((assignment) => assignment.branchId)
    .filter((id): id is NonNullable<typeof id> => Boolean(id))

  const branches = branchIds.length
    ? await Branch.find({ _id: { $in: branchIds } })
        .select('name slug')
        .lean()
    : []

  const nameOf = (id: string) => {
    const branch = branches.find((entry) => entry._id.toString() === id)
    return branch?.name?.uz ?? branch?.slug
  }

  const activeBranchId =
    session.activeBranchId === 'ALL'
      ? ('ALL' as const)
      : (session.activeBranchId?.toString() ?? null)

  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    photo: user.photo ?? undefined,
    locale: user.locale ?? 'uz',
    roles: user.roles.map((assignment) => ({
      role: assignment.role as Role,
      branchId: assignment.branchId?.toString(),
      branchName: assignment.branchId ? nameOf(assignment.branchId.toString()) : undefined,
    })),
    activeRole: (roleInBranch(user, activeBranchId) ?? user.roles[0]?.role ?? 'student') as Role,
    activeBranchId,
    twoFactorEnabled: Boolean(user.twoFactor?.enabled),
    mustChangePassword: Boolean(user.mustChangePassword),
    hasPin: Boolean(user.pinCodeHash),
    // §10.2 — only looked up for a learner, so a staff sign-in pays nothing.
    studentId: user.roles.some((assignment) => assignment.role === 'student')
      ? ((await Student.findOne({ userId: user._id }).select('_id').lean())?._id.toString() ??
        undefined)
      : undefined,
  }
}

/**
 * §8 — 2FA enrolment, step one: hand out a secret and its `otpauth://` URI.
 *
 * The secret is stored encrypted but *not* marked enabled until a code proves
 * the user actually scanned it. Enabling on issue would lock out anyone whose
 * scan failed — including the SuperAdmin, for whom 2FA is mandatory.
 */
export async function beginTwoFactorSetup(user: UserDocument, secret: string) {
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        'twoFactor.secret': encryptField(secret),
        'twoFactor.enabled': false,
        'twoFactor.confirmedAt': null,
      },
    },
  )
}

export async function confirmTwoFactor(userId: string, code: string, req: RequestMeta) {
  const user = await User.findById(userId).select('+twoFactor.secret')
  if (!user?.twoFactor?.secret) {
    throw ApiError.badRequest('Start two-factor setup before confirming it')
  }

  if (!verifyTotp(decryptField(user.twoFactor.secret), code)) {
    throw new ApiError(400, ERROR_CODES.TOTP_INVALID, 'That code is not valid')
  }

  user.twoFactor.enabled = true
  user.twoFactor.confirmedAt = new Date()
  await user.save()

  await recordAudit({
    action: 'auth.2fa.enable',
    actorId: user._id,
    actorName: user.fullName,
    entity: 'User',
    entityId: user._id,
    req,
  })
}

export async function disableTwoFactor(
  userId: string,
  input: { password: string; code: string },
  req: RequestMeta,
) {
  const user = await User.findById(userId).select('+passwordHash +twoFactor.secret')
  if (!user) throw ApiError.notFound('User not found')

  if (isSuperadmin(user)) {
    // §8 makes it mandatory for this role, so there is nothing to turn off.
    throw ApiError.forbidden('Two-factor authentication is mandatory for a SuperAdmin')
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) {
    throw new ApiError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Password is incorrect')
  }
  if (!user.twoFactor?.secret || !verifyTotp(decryptField(user.twoFactor.secret), input.code)) {
    throw new ApiError(400, ERROR_CODES.TOTP_INVALID, 'That code is not valid')
  }

  user.twoFactor.enabled = false
  user.twoFactor.secret = undefined
  user.twoFactor.confirmedAt = undefined
  await user.save()

  await recordAudit({
    action: 'auth.2fa.disable',
    actorId: user._id,
    actorName: user.fullName,
    entity: 'User',
    entityId: user._id,
    req,
  })
}

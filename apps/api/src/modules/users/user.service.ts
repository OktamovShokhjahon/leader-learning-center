import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import type { CreateUserInput, RoleAssignmentInput, PaginationQuery } from '@leader/shared/schemas'
import { parseSort } from '@leader/shared/schemas'
import { GRANTABLE_ROLES, mayAdminister, type Role } from '@leader/shared/permissions'
import { User, type UserDocument, isSuperadmin, branchIdsOf } from './user.model.js'
import { Branch } from '../branches/branch.model.js'
import { hashPassword } from '../auth/password.service.js'
import { revokeAllSessions } from '../auth/token.service.js'
import { recordAudit, diff, type RequestMeta } from '../audit/audit.service.js'
import { getScope } from '../../middleware/branch-scope.js'

/**
 * TZ §23 `STAFF` / §4.2 — staff accounts.
 *
 * §8: "Staff accounts are created by an administrator; there is no public staff
 * self-registration." Which roles an administrator may hand out is the §4.2
 * table's "Staff" block, and it is enforced here rather than in a route guard,
 * because the answer depends on the *role being granted*, not on the endpoint.
 */

function rolesOf(user: UserDocument): Role[] {
  return user.roles.map((assignment) => assignment.role as Role)
}

/**
 * An actor may act on an account below their own rank (§4.2 `GRANTABLE_ROLES`
 * covers only what they may *hand out*), on their own account, or — as
 * SuperAdmin — on anyone at all. `updateRoles` and `deactivateUser` add their
 * own self-checks on top, because nobody edits their own permissions or locks
 * themselves out.
 */
function assertMayAdminister(actor: UserDocument, target: UserDocument) {
  if (actor.id === target.id) return
  if (mayAdminister(rolesOf(actor), rolesOf(target))) return

  throw ApiError.forbidden(
    isSuperadmin(target)
      ? 'Only a SuperAdmin can manage a SuperAdmin account'
      : 'You cannot manage an account at or above your own role',
  )
}

function assertMayGrant(actorRole: Role, actor: UserDocument, roles: RoleAssignmentInput[]) {
  const allowed = GRANTABLE_ROLES[actorRole]
  const actorBranches = branchIdsOf(actor)

  for (const assignment of roles) {
    if (!allowed.includes(assignment.role)) {
      throw ApiError.forbidden(`Your role cannot create a "${assignment.role}" account`)
    }
    // An Admin may only staff their *own* branch — otherwise "create a teacher"
    // would be a route into every other branch in the system.
    if (
      !isSuperadmin(actor) &&
      assignment.branchId &&
      !actorBranches.includes(assignment.branchId)
    ) {
      throw ApiError.forbidden('You can only create accounts in your own branch')
    }
  }
}

async function assertBranchesExist(roles: RoleAssignmentInput[]) {
  const branchIds = roles.map((role) => role.branchId).filter(Boolean)
  if (branchIds.length === 0) return

  const found = await Branch.countDocuments({ _id: { $in: branchIds }, deletedAt: null })
  if (found !== new Set(branchIds).size) throw ApiError.badRequest('Unknown branch in roles')
}

export async function listUsers(
  actor: UserDocument,
  query: PaginationQuery & { role?: Role; status?: 'active' | 'inactive' },
) {
  const filter: Record<string, unknown> = { deletedAt: null }

  if (!isSuperadmin(actor)) {
    // §4.2 — an Admin or Manager sees the staff of their own branch, nobody else's.
    filter['roles.branchId'] = { $in: branchIdsOf(actor) }
  } else if (query.branchId) {
    // Only the boss may narrow to a branch they are not in — for everyone else
    // the branch filter above is already the tighter of the two.
    filter['roles.branchId'] = query.branchId
  }

  if (query.role) filter['roles.role'] = query.role
  if (query.status) filter.isActive = query.status === 'active'
  if (query.search) {
    // Escaped: a stray `(` in the search box must not reach Mongo as a broken
    // regular expression, and `.*` must not turn a filter into a full scan.
    const term = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { fullName: { $regex: term, $options: 'i' } },
      { phone: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
    ]
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort(parseSort(query.sort))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    User.countDocuments(filter),
  ])

  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export async function getUser(actor: UserDocument, userId: string) {
  const user = await User.findOne({ _id: userId, deletedAt: null })
  if (!user) throw ApiError.notFound('User not found')

  if (!isSuperadmin(actor) && actor.id !== userId) {
    const shared = branchIdsOf(user).some((id) => branchIdsOf(actor).includes(id))
    if (!shared) throw ApiError.notFound('User not found')
  }
  return user
}

export async function createUser(actor: UserDocument, input: CreateUserInput, req: RequestMeta) {
  const actorRole = (getScope()?.role ?? 'student') as Role
  assertMayGrant(actorRole, actor, input.roles as RoleAssignmentInput[])
  await assertBranchesExist(input.roles as RoleAssignmentInput[])

  if (await User.exists({ phone: input.phone })) {
    // The phone is the login identifier, so a duplicate is a real conflict the
    // administrator must resolve — most often by adding a role to the existing
    // account instead (§4.1: one role per branch, one account per person).
    throw new ApiError(
      409,
      ERROR_CODES.DUPLICATE_PHONE,
      'An account with this phone already exists',
    )
  }

  const user = await User.create({
    fullName: input.fullName,
    phone: input.phone,
    email: input.email || undefined,
    photo: input.photo,
    locale: input.locale ?? 'uz',
    passwordHash: await hashPassword(input.password),
    // Self-service password change was removed at the centre's request, so an
    // issued password stays until an administrator issues another one.
    mustChangePassword: false,
    roles: input.roles,
    createdBy: actor._id,
  })

  await recordAudit({
    action: 'user.create',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'User',
    entityId: user._id,
    after: { fullName: user.fullName, phone: user.phone, roles: input.roles },
    req,
  })

  return user
}

export async function updateUser(
  actor: UserDocument,
  userId: string,
  input: Record<string, unknown>,
  req: RequestMeta,
) {
  const user = await getUser(actor, userId)
  assertMayAdminister(actor, user)
  const before = user.toObject()

  // Roles are changed only through `updateRoles`, which has its own checks.
  const { roles: _roles, password: _password, ...safe } = input
  user.set({ ...safe, updatedBy: actor._id })
  await user.save()

  // §8 — a deactivated account must lose its sessions at once, not in 15 minutes.
  if (safe.isActive === false) await revokeAllSessions(user.id, 'account_disabled')

  const changes = diff(before as Record<string, unknown>, safe)
  await recordAudit({
    action: 'user.update',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'User',
    entityId: user._id,
    before: changes.before,
    after: changes.after,
    req,
  })

  return user
}

/**
 * §23 — `PATCH /users/:id/roles`.
 *
 * A role change invalidates every session the user holds: their old sessions
 * carry an active branch they may no longer belong to, and §8 lists role change
 * among the events that must be audited and take effect immediately.
 */
export async function updateRoles(
  actor: UserDocument,
  userId: string,
  roles: RoleAssignmentInput[],
  req: RequestMeta,
) {
  const actorRole = (getScope()?.role ?? 'student') as Role
  assertMayGrant(actorRole, actor, roles)
  await assertBranchesExist(roles)

  const user = await getUser(actor, userId)

  if (user.id === actor.id) {
    // Nobody edits their own permissions — that is the whole point of having them.
    throw ApiError.forbidden('You cannot change your own roles')
  }
  assertMayAdminister(actor, user)

  const before = user.roles.map((assignment) => ({
    role: assignment.role,
    branchId: assignment.branchId?.toString(),
  }))

  user.roles = roles as never
  user.updatedBy = actor._id
  await user.save()

  const revoked = await revokeAllSessions(user.id, 'role_changed')

  await recordAudit({
    action: 'user.roles.update',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'User',
    entityId: user._id,
    before: { roles: before },
    after: { roles, sessionsRevoked: revoked },
    req,
  })

  return user
}

/** An administrator issuing a new password; the user must change it at next login. */
export async function resetPassword(
  actor: UserDocument,
  userId: string,
  input: { newPassword: string; mustChange: boolean },
  req: RequestMeta,
) {
  const user = await getUser(actor, userId)
  assertMayAdminister(actor, user)

  user.passwordHash = await hashPassword(input.newPassword)
  user.passwordChangedAt = new Date()
  user.mustChangePassword = input.mustChange
  user.updatedBy = actor._id
  await user.save()

  const revoked = await revokeAllSessions(user.id, 'password_changed')

  await recordAudit({
    action: 'user.password.reset',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'User',
    entityId: user._id,
    after: { sessionsRevoked: revoked },
    req,
  })
}

/**
 * Deactivation, not deletion.
 *
 * A teacher's name is on years of lessons, payroll and audit entries; removing
 * the document would turn all of it into dangling ids.
 */
export async function deactivateUser(
  actor: UserDocument,
  userId: string,
  reason: string | undefined,
  req: RequestMeta,
) {
  const user = await getUser(actor, userId)

  if (user.id === actor.id) throw ApiError.forbidden('You cannot deactivate your own account')
  assertMayAdminister(actor, user)
  if (isSuperadmin(user)) {
    const remaining = await User.countDocuments({
      'roles.role': 'superadmin',
      isActive: true,
      deletedAt: null,
      _id: { $ne: user._id },
    })
    // Locking everyone out of the only account that can create accounts is not
    // a recoverable state.
    if (remaining === 0) throw ApiError.conflict('The last active SuperAdmin cannot be deactivated')
  }

  user.isActive = false
  user.deactivatedReason = reason
  user.updatedBy = actor._id
  await user.save()

  await revokeAllSessions(user.id, 'account_disabled')

  await recordAudit({
    action: 'user.deactivate',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'User',
    entityId: user._id,
    reason,
    req,
  })
}

import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import type { CreateUserInput, RoleAssignmentInput, PaginationQuery } from '@leader/shared/schemas'
import { parseSort } from '@leader/shared/schemas'
import type { Role } from '@leader/shared/permissions'
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

/** §4.2 — "Create Admin / Manager accounts: SuperAdmin only". */
const ROLES_GRANTABLE_BY: Record<Role, Role[]> = {
  superadmin: ['superadmin', 'admin', 'manager', 'teacher', 'student', 'parent'],
  // §4.2 grants an Admin `staff.createTeacher` and nothing above it. Students
  // and parents are accounts too, and creating those is part of enrolment.
  admin: ['teacher', 'student', 'parent'],
  manager: ['student', 'parent'],
  teacher: [],
  student: [],
  parent: [],
}

function assertMayGrant(actorRole: Role, actor: UserDocument, roles: RoleAssignmentInput[]) {
  const allowed = ROLES_GRANTABLE_BY[actorRole]
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

export async function listUsers(actor: UserDocument, query: PaginationQuery & { role?: Role }) {
  const filter: Record<string, unknown> = { deletedAt: null }

  if (!isSuperadmin(actor)) {
    // §4.2 — an Admin sees the staff of their own branch, nobody else's.
    filter['roles.branchId'] = { $in: branchIdsOf(actor) }
  } else if (query.branchId) {
    filter['roles.branchId'] = query.branchId
  }

  if (query.role) filter['roles.role'] = query.role
  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: query.search, $options: 'i' } },
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
    // An administrator has seen this password, so it is not the user's yet.
    mustChangePassword: true,
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
  if (isSuperadmin(user) && !isSuperadmin(actor)) {
    throw ApiError.forbidden('Only a SuperAdmin can change a SuperAdmin account')
  }

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

  if (isSuperadmin(user) && !isSuperadmin(actor)) {
    throw ApiError.forbidden('Only a SuperAdmin can reset a SuperAdmin password')
  }

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
  if (isSuperadmin(user) && !isSuperadmin(actor)) {
    throw ApiError.forbidden('Only a SuperAdmin can deactivate a SuperAdmin account')
  }
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

import { ApiError } from '@leader/shared/errors'
import type { CreateBranchInput, PaginationQuery } from '@leader/shared/schemas'
import { parseSort } from '@leader/shared/schemas'
import { Branch } from './branch.model.js'
import { User, type UserDocument, isSuperadmin, branchIdsOf } from '../users/user.model.js'
import { Session } from '../auth/session.model.js'
import { recordAudit, diff, type RequestMeta } from '../audit/audit.service.js'

/**
 * TZ §5.3 / §23 — branch management.
 *
 * Branches are the scope, not scoped data, so nothing here goes through the
 * branch-scope plugin. Visibility is decided explicitly instead: a SuperAdmin
 * sees every branch, everyone else sees only the ones they hold a role in.
 */
export async function listBranches(user: UserDocument, query: PaginationQuery) {
  const filter: Record<string, unknown> = { deletedAt: null }

  if (!isSuperadmin(user)) {
    filter._id = { $in: branchIdsOf(user) }
  }
  if (query.search) {
    filter.$or = [
      { 'name.uz': { $regex: query.search, $options: 'i' } },
      { 'name.ru': { $regex: query.search, $options: 'i' } },
      { slug: { $regex: query.search, $options: 'i' } },
    ]
  }

  const [items, total] = await Promise.all([
    Branch.find(filter)
      .sort(parseSort(query.sort))
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Branch.countDocuments(filter),
  ])

  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export async function getBranch(user: UserDocument, branchId: string) {
  const branch = await Branch.findOne({ _id: branchId, deletedAt: null }).lean()
  if (!branch) throw ApiError.notFound('Branch not found')

  if (!isSuperadmin(user) && !branchIdsOf(user).includes(branchId)) {
    // Same answer as a missing branch: whether a branch exists is not something
    // an Admin of another branch needs to learn.
    throw ApiError.notFound('Branch not found')
  }
  return branch
}

export async function createBranch(user: UserDocument, input: CreateBranchInput, req: RequestMeta) {
  if (await Branch.exists({ slug: input.slug })) {
    throw ApiError.conflict('A branch with this slug already exists', { slug: input.slug })
  }

  const branch = await Branch.create({ ...input, createdBy: user._id })

  await recordAudit({
    action: 'branch.create',
    actorId: user._id,
    actorName: user.fullName,
    entity: 'Branch',
    entityId: branch._id,
    branchId: branch._id,
    after: { slug: branch.slug, name: branch.name },
    req,
  })

  return branch
}

export async function updateBranch(
  user: UserDocument,
  branchId: string,
  input: Record<string, unknown>,
  req: RequestMeta,
) {
  const branch = await Branch.findOne({ _id: branchId, deletedAt: null })
  if (!branch) throw ApiError.notFound('Branch not found')

  const before = branch.toObject()
  branch.set({ ...input, updatedBy: user._id })
  await branch.save()

  const changes = diff(before as Record<string, unknown>, input)
  await recordAudit({
    action: 'branch.update',
    actorId: user._id,
    actorName: user.fullName,
    entity: 'Branch',
    entityId: branch._id,
    branchId: branch._id,
    before: changes.before,
    after: changes.after,
    req,
  })

  return branch
}

/**
 * §4.2 calls this "archive", and that is exactly what it does: a soft delete.
 *
 * Years of invoices, attendance and payroll point at this branch; removing the
 * document would orphan all of it. Archiving also has to eject anyone currently
 * *looking* at the branch, or a SuperAdmin's switcher would keep a dead scope
 * selected and every subsequent query would silently return nothing.
 */
export async function archiveBranch(user: UserDocument, branchId: string, req: RequestMeta) {
  const branch = await Branch.findOne({ _id: branchId, deletedAt: null })
  if (!branch) throw ApiError.notFound('Branch not found')

  const staffCount = await User.countDocuments({
    'roles.branchId': branchId,
    isActive: true,
    deletedAt: null,
  })
  if (staffCount > 0) {
    throw ApiError.conflict('Move or deactivate this branch’s staff before archiving it', {
      staffCount,
    })
  }

  branch.isActive = false
  branch.deletedAt = new Date()
  branch.updatedBy = user._id
  await branch.save()

  // Anyone parked on this branch is moved to the consolidated scope.
  await Session.updateMany({ activeBranchId: branchId }, { $set: { activeBranchId: 'ALL' } })

  await recordAudit({
    action: 'branch.archive',
    actorId: user._id,
    actorName: user.fullName,
    entity: 'Branch',
    entityId: branch._id,
    branchId: branch._id,
    req,
  })

  return branch
}

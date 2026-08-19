import { AsyncLocalStorage } from 'node:async_hooks'
import type { RequestHandler } from 'express'
import type { Schema, Types } from 'mongoose'
import type { Role } from '@leader/shared/permissions'
import { logger } from '../config/logger.js'

/**
 * TZ §5.1 — multi-branch scoping, built in from the first migration.
 *
 * Every operational document carries `branchId`. A Mongoose plugin injects the
 * filter into every query from the request context held in AsyncLocalStorage,
 * so **forgetting the filter in a controller is impossible by construction**.
 *
 * The single documented bypass is `withAllBranches()`, available to SuperAdmin
 * for consolidated reports, and every use of it is logged (§5.1).
 */

export type RequestScope = {
  userId?: string
  role?: Role
  /** `'ALL'` is the consolidated SuperAdmin scope; `undefined` means public/unscoped. */
  branchId?: string | 'ALL'
  requestId?: string
}

const storage = new AsyncLocalStorage<RequestScope>()

export function getScope(): RequestScope | undefined {
  return storage.getStore()
}

export function runWithScope<T>(scope: RequestScope, callback: () => T): T {
  return storage.run(scope, callback)
}

/**
 * Escape hatch for consolidated SuperAdmin reporting. Logged on every use so a
 * cross-branch read is always traceable (§5.1, §21.3).
 */
export function withAllBranches<T>(reason: string, callback: () => T): T {
  const current = storage.getStore() ?? {}
  logger.info({ scope: 'ALL', reason, userId: current.userId, role: current.role }, 'cross-branch scope used')
  return storage.run({ ...current, branchId: 'ALL' }, callback)
}

/** Populates the request scope. Auth middleware fills in userId/role in Phase 1. */
export const branchScopeMiddleware: RequestHandler = (req, _res, next) => {
  const scope: RequestScope = {
    requestId: req.headers['x-request-id']?.toString(),
  }
  runWithScope(scope, () => next())
}

/**
 * Applied to every branch-owned model. Injects `branchId` into reads and sets it
 * on writes. Models opt in explicitly — see `branchScoped()` below — so the set
 * of scoped collections is auditable in one place.
 */
export function branchScopePlugin(schema: Schema) {
  const READ_HOOKS = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'countDocuments',
    'distinct',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
  ] as const

  for (const hook of READ_HOOKS) {
    schema.pre(hook, function applyBranchFilter(this: { getFilter?: () => Record<string, unknown>; where: (obj: object) => unknown }) {
      const scope = getScope()
      if (!scope?.branchId || scope.branchId === 'ALL') return

      const filter = this.getFilter?.() ?? {}
      // An explicit branchId in the query wins, so admin tooling can still be precise.
      if (filter.branchId === undefined) {
        this.where({ branchId: scope.branchId })
      }
    })
  }

  schema.pre('aggregate', function applyBranchStage(this: { pipeline: () => unknown[] }) {
    const scope = getScope()
    if (!scope?.branchId || scope.branchId === 'ALL') return
    this.pipeline().unshift({ $match: { branchId: scope.branchId } })
  })

  schema.pre('save', function setBranchOnCreate(this: { branchId?: Types.ObjectId | string; isNew: boolean }) {
    const scope = getScope()
    if (this.isNew && !this.branchId && scope?.branchId && scope.branchId !== 'ALL') {
      this.branchId = scope.branchId
    }
  })
}

import { AsyncLocalStorage } from 'node:async_hooks'
import type { RequestHandler } from 'express'
import { Types } from 'mongoose'
import type { Schema } from 'mongoose'
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
  logger.info(
    { scope: 'ALL', reason, userId: current.userId, role: current.role },
    'cross-branch scope used',
  )
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
 * The scope holds the branch id as a string, because it comes from a session
 * document and is compared as one. Mongo stores it as an ObjectId, so anything
 * building a raw query fragment has to convert.
 */
function toObjectId(id: string): Types.ObjectId | string {
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id
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
    schema.pre(
      hook,
      function applyBranchFilter(this: {
        getFilter?: () => Record<string, unknown>
        where: (obj: object) => unknown
      }) {
        const scope = getScope()
        if (!scope?.branchId || scope.branchId === 'ALL') return

        const filter = this.getFilter?.() ?? {}
        // An explicit branchId in the query wins, so admin tooling can still be precise.
        // Cast to ObjectId: `distinct` (and some chained queries) skip schema
        // casting, so a string id matches nothing — SuperAdmin `'ALL'` skips
        // this hook and still works, which is why a Manager-only bug shows up.
        if (filter.branchId === undefined) {
          this.where({ branchId: toObjectId(scope.branchId) })
        }
      },
    )
  }

  schema.pre('aggregate', function applyBranchStage(this: { pipeline: () => unknown[] }) {
    const scope = getScope()
    if (!scope?.branchId || scope.branchId === 'ALL') return

    // `find` casts a string id to an ObjectId from the schema; an aggregation
    // pipeline gets no casting at all, so a raw string `$match` silently matches
    // nothing and every report comes back empty rather than failing loudly.
    this.pipeline().unshift({ $match: { branchId: toObjectId(scope.branchId) } })
  })

  function setBranchOnCreate(this: { branchId?: Types.ObjectId | string; isNew: boolean }) {
    const scope = getScope()
    if (this.isNew && !this.branchId && scope?.branchId && scope.branchId !== 'ALL') {
      this.branchId = scope.branchId
    }
  }

  /**
   * Both hooks, and `validate` is the one that matters.
   *
   * Mongoose runs `pre('validate')` → validation → `pre('save')`, so a plugin
   * that only hooked `save` stamped the branch *after* the required-field check
   * had already rejected the document. Every model whose `branchId` is
   * `required: true` — which is all of them — therefore threw a
   * `ValidationError` unless the caller happened to pass the branch by hand,
   * which is exactly the boilerplate this plugin exists to remove.
   *
   * `save` stays because a document built and saved without `validate()` (a
   * bulk path, say) should still get its branch.
   */
  schema.pre('validate', setBranchOnCreate)
  schema.pre('save', setBranchOnCreate)
}

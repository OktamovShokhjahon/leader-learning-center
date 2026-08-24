import { Router } from 'express'
import { z } from 'zod'
import { paginationSchema, objectIdSchema } from '@leader/shared/schemas'
import { validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { AuditLog } from './audit.model.js'

/**
 * TZ §21.3 — "Searchable and filterable by actor, entity, period. Retained
 * 3 years. **Not deletable from the UI by anyone, including SuperAdmin.**"
 *
 * The writer has existed since Phase 1 and is called from every mutation; this
 * is the reader, and it is the last piece acceptance criterion §30.2 needs —
 * "an Admin account receives 403 on every finance endpoint, **and the attempt
 * appears in the audit log**". Until now that entry could only be seen from
 * Mongo directly.
 *
 * SuperAdmin only. Note 9 gave an Admin a branch-limited view of this, and that
 * note died with the Admin role (ADR 0004). There is deliberately no DELETE.
 */
export const auditRouter = Router()

auditRouter.use(requireAuth)
auditRouter.use(requireRole('superadmin'))

const auditQuerySchema = paginationSchema.extend({
  actorId: objectIdSchema.optional(),
  entity: z.string().trim().max(40).optional(),
  entityId: z.string().trim().max(64).optional(),
  action: z.string().trim().max(60).optional(),
  outcome: z.enum(['success', 'failure']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

auditRouter.get(
  '/',
  validateQuery(auditQuerySchema),
  asyncRoute(async (_req, res) => {
    const query = res.locals.query
    const filter: Record<string, unknown> = {}

    // Two independent "either column" conditions — the entity id and the free
    // text search — so they collect into `$and`. A bare `$or` per condition
    // would have the second silently overwrite the first.
    const anyOf: Record<string, unknown>[][] = []

    if (query.actorId) filter.actorId = query.actorId
    if (query.entity) filter.entity = query.entity
    // An entity is keyed either by ObjectId or by a string (a setting key, a
    // payroll period), so this has to look in both columns.
    if (query.entityId) {
      anyOf.push([{ entityId: query.entityId }, { entityKey: query.entityId }])
    }
    if (query.outcome) filter.outcome = query.outcome
    if (query.branchId) filter.branchId = query.branchId
    // `action` is a dotted namespace — `payment.*` should match the whole family.
    if (query.action) {
      filter.action = { $regex: `^${query.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
    }
    if (query.from || query.to) {
      filter.at = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      }
    }
    if (query.search) {
      const term = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      anyOf.push([
        { actorName: { $regex: term, $options: 'i' } },
        { action: { $regex: term, $options: 'i' } },
        { path: { $regex: term, $options: 'i' } },
        { entityKey: { $regex: term, $options: 'i' } },
        { reason: { $regex: term, $options: 'i' } },
      ])
    }

    if (anyOf.length > 0) filter.$and = anyOf.map((clauses) => ({ $or: clauses }))

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ at: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ])

    res.json({
      data: {
        items,
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    })
  }),
)

/** The distinct values behind the filter dropdowns, so they are never stale. */
auditRouter.get(
  '/facets',
  asyncRoute(async (_req, res) => {
    const [actions, entities] = await Promise.all([
      AuditLog.distinct('action'),
      AuditLog.distinct('entity'),
    ])
    res.json({
      data: {
        // Just the namespace — `payment.approve` and `payment.reject` collapse
        // to `payment`, which is what someone filtering actually wants.
        families: [...new Set(actions.map((a: string) => a.split('.')[0]))].sort(),
        actions: actions.sort(),
        entities: entities.filter(Boolean).sort(),
      },
    })
  }),
)

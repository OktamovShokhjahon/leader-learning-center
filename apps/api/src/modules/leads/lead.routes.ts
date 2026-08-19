import { Router } from 'express'
import { z } from 'zod'
import { paginationSchema, LEAD_STATUSES } from '@leader/shared/schemas'
import { validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'
import { parseSort } from '@leader/shared/schemas'
import { Lead } from './lead.model.js'

/**
 * TZ §23 `LEADS` / §7.2 — the applications a Manager works through.
 *
 * Nothing here mentions `branchId`, and that is the point: `leads` carries the
 * branch-scope plugin, so the filter is injected from the request context (§5.1).
 * A Manager in Urganch cannot page their way into Xiva's applications even
 * though this controller never thought about it.
 *
 * The kanban's write side — drag between stages, assign, schedule a trial
 * lesson, convert to a student — is the rest of §7.2 and is not built yet.
 */
export const leadRouter = Router()

leadRouter.use(requireAuth)

const leadQuerySchema = paginationSchema.extend({
  status: z.enum(LEAD_STATUSES).optional(),
})

leadRouter.get(
  '/',
  // §4.2 — leads are the front desk's job, so this rides on the same grant as
  // the student records they turn into.
  requirePermission('student.manage'),
  validateQuery(leadQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as z.infer<typeof leadQuerySchema>
    const filter: Record<string, unknown> = { deletedAt: null }

    if (query.status) filter.status = query.status
    if (query.search) {
      filter.$or = [
        { fullName: { $regex: query.search, $options: 'i' } },
        { phone: { $regex: query.search, $options: 'i' } },
      ]
    }

    const [items, total] = await Promise.all([
      Lead.find(filter)
        .sort(parseSort(query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Lead.countDocuments(filter),
    ])

    res.json({
      data: {
        items,
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    })
  }),
)

/** §7.2 — the counts behind the kanban columns. */
leadRouter.get(
  '/funnel',
  requirePermission('student.manage'),
  asyncRoute(async (_req, res) => {
    const counts = await Lead.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])

    const byStatus = Object.fromEntries(LEAD_STATUSES.map((status) => [status, 0]))
    for (const entry of counts) byStatus[entry._id as string] = entry.count

    res.json({ data: byStatus })
  }),
)

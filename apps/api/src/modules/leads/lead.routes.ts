import { Router } from 'express'
import { z } from 'zod'
import {
  paginationSchema,
  LEAD_STATUSES,
  updateLeadSchema,
  trialLessonSchema,
  convertLeadSchema,
  parseSort,
} from '@leader/shared/schemas'
import { ApiError } from '@leader/shared/errors'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import {
  requireAuth,
  requirePermission,
  requireSingleBranch,
  currentUser,
} from '../../middleware/auth.js'
import { Lead } from './lead.model.js'
import { updateLead, scheduleTrial, convertLead, leadReport } from './lead.pipeline.js'

/**
 * TZ §23 `LEADS` / §7.2 — the applications a Manager works through.
 *
 * Nothing here mentions `branchId`, and that is the point: `leads` carries the
 * branch-scope plugin, so the filter is injected from the request context (§5.1).
 * A Manager in Urganch cannot page their way into Xiva's applications even
 * though this controller never thought about it.
 *
 * The kanban's write side — drag between stages, assign, schedule a trial
 * lesson, convert to a student — lives in `lead.pipeline.ts`, because
 * conversion writes a Student, an Enrollment and sometimes a User, and that is
 * not controller work.
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
  requirePermission('lead.manage'),
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
  requirePermission('lead.manage'),
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

/** §20 Sales — the funnel report: by source, by manager, time to first contact. */
leadRouter.get(
  '/report',
  requirePermission('lead.manage'),
  validateQuery(z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() })),
  asyncRoute(async (_req, res) => {
    res.json({ data: await leadReport(res.locals.query.from, res.locals.query.to) })
  }),
)

leadRouter.get(
  '/:id',
  requirePermission('lead.manage'),
  asyncRoute(async (req, res) => {
    const lead = await Lead.findOne({ _id: req.params.id, deletedAt: null }).lean()
    if (!lead) throw ApiError.notFound('Lead not found')
    res.json({ data: lead })
  }),
)

/** §7.2 — status, owner, next action and comments. One field at a time. */
leadRouter.patch(
  '/:id',
  requirePermission('lead.manage'),
  validateBody(updateLeadSchema),
  asyncRoute(async (req, res) => {
    res.json({ data: await updateLead(currentUser(req), String(req.params.id), req.body, req) })
  }),
)

leadRouter.post(
  '/:id/trial',
  requirePermission('lead.manage'),
  validateBody(trialLessonSchema),
  asyncRoute(async (req, res) => {
    res.json({ data: await scheduleTrial(currentUser(req), String(req.params.id), req.body, req) })
  }),
)

/** §23 — the lead becomes a student. Replays return the original (see the service). */
leadRouter.post(
  '/:id/convert',
  requirePermission('lead.manage'),
  requireSingleBranch,
  validateBody(convertLeadSchema),
  asyncRoute(async (req, res) => {
    const result = await convertLead(currentUser(req), String(req.params.id), req.body, req)
    res.status(result.replayed ? 200 : 201).json({ data: result })
  }),
)

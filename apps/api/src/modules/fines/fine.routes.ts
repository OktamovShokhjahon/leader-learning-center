import { Router } from 'express'
import {
  createFineSchema,
  fineQuerySchema,
  fineDecisionSchema,
  appealDecisionSchema,
  createFineRuleSchema,
  updateFineRuleSchema,
  paginationSchema,
  parseSort,
} from '@leader/shared/schemas'
import { ApiError } from '@leader/shared/errors'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import {
  requireAuth,
  requirePermission,
  requireRole,
  writeGuards,
  currentUser,
} from '../../middleware/auth.js'
import { recordAudit, diff } from '../audit/audit.service.js'
import { Fine, FineRule } from './fine.model.js'
import { Student } from '../students/student.model.js'
import { User } from '../users/user.model.js'

/**
 * TZ §12 — `jarima`. The client: *"жарималарни хам инобатга ол"*.
 *
 * Both students and employees, because a learning centre uses both. A student
 * fine becomes a line on their next invoice; an employee fine becomes a payslip
 * deduction. Neither is applied here — issuing records the debt, and the
 * invoicing and payroll runs pick it up — which is what keeps a fine from being
 * charged twice when either of those is re-run.
 *
 * §12.4 — cancelling never deletes. A fine that was wrong stays visible as a
 * cancelled fine, because "this was issued and then withdrawn" is a different
 * fact from "this never happened", and an appeal is about the first one.
 */
export const fineRouter = Router()

fineRouter.use(requireAuth)

fineRouter.get(
  '/',
  asyncRoute(async (req, res, next) => {
    // Everyone may read their *own* fines (§4.2 `fine.viewOwn`); reading anyone
    // else's needs the issuing grant.
    const own = req.query.mine === 'true'
    if (own) return next()
    return requirePermission('fine.issue')(req, res, next)
  }),
  validateQuery(fineQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query
    const actor = currentUser(req)
    const filter: Record<string, unknown> = { deletedAt: null }

    if (req.query.mine === 'true') {
      // A staff member is a `User`; a learner's fines hang off their `Student`.
      const student = await Student.findOne({ userId: actor._id, deletedAt: null }).select('_id')
      filter.$or = [
        { targetType: 'employee', targetId: actor._id },
        ...(student ? [{ targetType: 'student', targetId: student._id }] : []),
      ]
    } else {
      if (query.targetType) filter.targetType = query.targetType
      if (query.targetId) filter.targetId = query.targetId
    }

    if (query.status) filter.status = query.status
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      }
    }

    const [items, total, sum] = await Promise.all([
      Fine.find(filter)
        .sort(parseSort(query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Fine.countDocuments(filter),
      Fine.aggregate([
        { $match: { ...filter, status: { $in: ['issued', 'paid'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ])

    // A name per row, so the list is readable without a second request.
    const studentIds = items.filter((f) => f.targetType === 'student').map((f) => f.targetId)
    const userIds = items.filter((f) => f.targetType === 'employee').map((f) => f.targetId)
    const [students, users] = await Promise.all([
      Student.find({ _id: { $in: studentIds } }).select('fullName').lean(),
      User.find({ _id: { $in: userIds } }).select('fullName').lean(),
    ])
    const nameOf = (fine: (typeof items)[number]) =>
      (fine.targetType === 'student' ? students : users).find(
        (row) => row._id.toString() === fine.targetId?.toString(),
      )?.fullName ?? null

    res.json({
      data: {
        items: items.map((fine) => ({ ...fine, targetName: nameOf(fine) })),
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.max(1, Math.ceil(total / query.limit)),
        totalAmount: sum[0]?.total ?? 0,
      },
    })
  }),
)

/** §12.2 / §12.3 — issuing by hand. Auto-rules run as a job and call the same path. */
fineRouter.post(
  '/',
  ...writeGuards('fine.issue'),
  validateBody(createFineSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)

    // Refusing an unknown target here is worth the extra read: a fine against a
    // deleted id is invisible to the person it is charged to.
    const exists =
      req.body.targetType === 'student'
        ? await Student.exists({ _id: req.body.targetId, deletedAt: null })
        : await User.exists({ _id: req.body.targetId, deletedAt: null })
    if (!exists) throw ApiError.badRequest('Unknown target for this fine')

    const fine = await Fine.create({
      ...req.body,
      appliedTo: req.body.appliedTo ?? (req.body.targetType === 'student' ? 'invoice' : 'payroll'),
      issuedBy: actor._id,
      createdBy: actor._id,
    })

    // §21.3 — fines are on the mandatory audit list.
    await recordAudit({
      action: 'fine.issue',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Fine',
      entityId: fine._id,
      after: {
        targetType: fine.targetType,
        targetId: fine.targetId?.toString(),
        amount: fine.amount,
      },
      reason: fine.reason,
      req,
    })

    res.status(201).json({ data: fine })
  }),
)

/** §12.4 — cancelled, never deleted, and always with a reason. */
fineRouter.post(
  '/:id/cancel',
  requirePermission('fine.cancel'),
  validateBody(fineDecisionSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const fine = await Fine.findOne({ _id: req.params.id, deletedAt: null })
    if (!fine) throw ApiError.notFound('Fine not found')
    if (fine.status === 'cancelled') throw ApiError.conflict('That fine is already cancelled')
    if (fine.appliedAt) {
      throw ApiError.conflict(
        'That fine has already been charged — refund the invoice or payslip instead',
      )
    }

    fine.status = 'cancelled'
    fine.cancelledReason = req.body.reason
    fine.updatedBy = actor._id
    await fine.save()

    await recordAudit({
      action: 'fine.cancel',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Fine',
      entityId: fine._id,
      reason: req.body.reason,
      after: { status: fine.status },
      req,
    })

    res.json({ data: fine })
  }),
)

/**
 * §12.4 — the person fined may appeal. Deliberately open to any signed-in
 * account, because the whole point is that the person on the receiving end can
 * use it; the service checks that the fine is actually theirs.
 */
fineRouter.post(
  '/:id/appeal',
  validateBody(fineDecisionSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const fine = await Fine.findOne({ _id: req.params.id, deletedAt: null })
    if (!fine) throw ApiError.notFound('Fine not found')

    const student = await Student.findOne({ userId: actor._id, deletedAt: null }).select('_id')
    const isMine =
      (fine.targetType === 'employee' && fine.targetId?.toString() === actor.id) ||
      (fine.targetType === 'student' && fine.targetId?.toString() === student?._id.toString())
    if (!isMine) throw ApiError.forbidden('You can only appeal your own fine')

    if (fine.status !== 'issued') throw ApiError.conflict('That fine can no longer be appealed')

    fine.status = 'appealed'
    fine.appeal = { at: new Date(), by: actor._id, text: req.body.reason }
    await fine.save()

    await recordAudit({
      action: 'fine.appeal',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Fine',
      entityId: fine._id,
      reason: req.body.reason,
      req,
    })

    res.json({ data: fine })
  }),
)

/** The boss decides an appeal: uphold the fine, or waive it. */
fineRouter.post(
  '/:id/appeal/decide',
  requireRole('superadmin'),
  validateBody(appealDecisionSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const fine = await Fine.findOne({ _id: req.params.id, deletedAt: null })
    if (!fine) throw ApiError.notFound('Fine not found')
    if (fine.status !== 'appealed') throw ApiError.conflict('That fine has no open appeal')

    const waive = req.body.outcome === 'waived'
    fine.status = waive ? 'waived' : 'issued'
    fine.appeal = {
      ...(fine.appeal ?? {}),
      decidedAt: new Date(),
      decidedBy: actor._id,
      outcome: waive ? 'waived' : 'upheld',
    }
    await fine.save()

    await recordAudit({
      action: 'fine.appeal.decide',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Fine',
      entityId: fine._id,
      after: { outcome: fine.appeal.outcome },
      reason: req.body.reason,
      req,
    })

    res.json({ data: fine })
  }),
)

/* ── Rules (§12.1 — `/fine-rules`, superadmin per §4.2) ───────────────── */

export const fineRuleRouter = Router()

fineRuleRouter.use(requireAuth)
// The prefix is already declared in SUPERADMIN_ONLY_ROUTE_PREFIXES (§4.3).
fineRuleRouter.use(requireRole('superadmin'))

fineRuleRouter.get(
  '/',
  validateQuery(paginationSchema),
  asyncRoute(async (_req, res) => {
    const items = await FineRule.find({ deletedAt: null }).sort({ createdAt: -1 }).lean()
    res.json({ data: { items, total: items.length } })
  }),
)

fineRuleRouter.post(
  '/',
  validateBody(createFineRuleSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const rule = await FineRule.create({ ...req.body, createdBy: actor._id })

    await recordAudit({
      action: 'fineRule.create',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'FineRule',
      entityId: rule._id,
      after: { trigger: rule.trigger, amount: rule.amount, isActive: rule.isActive },
      req,
    })
    res.status(201).json({ data: rule })
  }),
)

fineRuleRouter.patch(
  '/:id',
  validateBody(updateFineRuleSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const rule = await FineRule.findOne({ _id: req.params.id, deletedAt: null })
    if (!rule) throw ApiError.notFound('Rule not found')

    const before = rule.toObject()
    rule.set({ ...req.body, updatedBy: actor._id })
    await rule.save()

    const changes = diff(before as Record<string, unknown>, req.body)
    await recordAudit({
      action: 'fineRule.update',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'FineRule',
      entityId: rule._id,
      before: changes.before,
      after: changes.after,
      req,
    })
    res.json({ data: rule })
  }),
)

fineRuleRouter.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const rule = await FineRule.findOne({ _id: req.params.id, deletedAt: null })
    if (!rule) throw ApiError.notFound('Rule not found')
    rule.deletedAt = new Date()
    await rule.save()
    res.json({ data: { deleted: true } })
  }),
)

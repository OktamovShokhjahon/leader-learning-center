import { Router } from 'express'
import {
  acceptPaymentSchema,
  refundPaymentSchema,
  invoiceQuerySchema,
  paymentQuerySchema,
  debtorQuerySchema,
  generateInvoicesSchema,
  parseSort,
} from '@leader/shared/schemas'
import { ApiError } from '@leader/shared/errors'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { recordAudit } from '../audit/audit.service.js'
import {
  requireAuth,
  requirePermission,
  requireFullGrant,
  requireRole,
  currentUser,
} from '../../middleware/auth.js'
import { Invoice, Payment } from './invoice.model.js'
import {
  acceptPayment,
  refundPayment,
  generateInvoices,
  listDebtors,
  recalculateOverdue,
} from './payment.service.js'

/**
 * TZ §23 — the `PAYMENTS` block.
 *
 * Note what is *not* here: revenue, profit and margins. Admin and Manager see
 * debt per student and nothing more (§11.3); the aggregate money view is
 * SuperAdmin-only and lives on the finance router.
 */
export const paymentRouter = Router()

paymentRouter.use(requireAuth)

paymentRouter.get(
  '/invoices',
  requirePermission('debtor.view'),
  validateQuery(invoiceQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as {
      page: number
      limit: number
      sort: string
      status?: string
      studentId?: string
      groupId?: string
      period?: string
    }

    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.status) filter.status = query.status
    if (query.studentId) filter.studentId = query.studentId
    if (query.groupId) filter.groupId = query.groupId
    if (query.period) filter.period = query.period

    const [items, total] = await Promise.all([
      Invoice.find(filter)
        .sort(parseSort(query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate('studentId', 'fullName phone')
        .lean(),
      Invoice.countDocuments(filter),
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

/** §11.1 — the monthly run. Manual trigger mirrors the nightly job. */
paymentRouter.post(
  '/invoices/generate',
  requireRole('superadmin'),
  validateBody(generateInvoicesSchema),
  asyncRoute(async (req, res) => {
    const result = await generateInvoices(req.body.period, {
      dryRun: req.body.dryRun,
      actorId: currentUser(req).id,
    })
    res.json({ data: result })
  }),
)

paymentRouter.post(
  '/invoices/recalculate',
  requireRole('superadmin'),
  asyncRoute(async (_req, res) => {
    res.json({ data: await recalculateOverdue() })
  }),
)

/**
 * §11.2 — the most-used endpoint in the CRM. Target: under 15 seconds from
 * search to printed receipt, so it does one thing and returns fast.
 */
paymentRouter.post(
  '/',
  requirePermission('payment.accept'),
  validateBody(acceptPaymentSchema),
  asyncRoute(async (req, res) => {
    const { payment, replayed } = await acceptPayment(req.body, currentUser(req).id)
    res.status(replayed ? 200 : 201).json({ data: { payment, replayed } })
  }),
)

/**
 * §4.2 note 3 — an Admin may reverse only within the current calendar month;
 * anything older needs SuperAdmin. The `limited` grant is what makes that check
 * necessary rather than optional.
 */
paymentRouter.post(
  '/:id/refund',
  requirePermission('payment.refund'),
  validateBody(refundPaymentSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const original = await Payment.findById(req.params.id).lean()
    if (!original) throw ApiError.notFound('Payment not found')

    const roles = actor.roles.map((assignment) => assignment.role)
    if (!roles.includes('superadmin')) {
      const now = new Date()
      const sameMonth =
        original.receivedAt.getUTCFullYear() === now.getUTCFullYear() &&
        original.receivedAt.getUTCMonth() === now.getUTCMonth()
      if (!sameMonth) {
        throw ApiError.forbidden(
          'An Admin can only reverse a payment from the current month. Ask the SuperAdmin.',
        )
      }
    }

    const refund = await refundPayment(String(req.params.id), req.body, actor.id)
    res.status(201).json({ data: refund })
  }),
)

paymentRouter.get(
  '/',
  requirePermission('payment.accept'),
  validateQuery(paymentQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as {
      page: number
      limit: number
      sort: string
      studentId?: string
      method?: string
      from?: Date
      to?: Date
    }

    const filter: Record<string, unknown> = {}
    if (query.studentId) filter.studentId = query.studentId
    if (query.method) filter.method = query.method
    if (query.from || query.to) {
      filter.receivedAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      }
    }

    const [items, total] = await Promise.all([
      Payment.find(filter)
        .sort(parseSort(query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate('studentId', 'fullName phone')
        .lean(),
      Payment.countDocuments(filter),
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

/**
 * §11.3 — "Qarzdorlar", the explicit client requirement.
 *
 * A Teacher holds only a `limited` grant on `debtor.view`: §4.2 note 2 says they
 * see a debt *flag* on their own students and never an amount. That is enforced
 * here by stripping the sums, not by hiding a column in the UI.
 */
paymentRouter.get(
  '/debtors',
  requirePermission('debtor.view'),
  validateQuery(debtorQuerySchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const query = res.locals.query as {
      page: number
      limit: number
      groupId?: string
      teacherId?: string
      minDaysOverdue?: number
      unpaidOnly?: boolean
    }

    const roles = actor.roles.map((assignment) => assignment.role)
    const teacherOnly = roles.every((role) => role === 'teacher')

    const result = await listDebtors({
      ...query,
      // A teacher can only ever ask about their own groups.
      teacherId: teacherOnly ? actor.id : query.teacherId,
    })

    if (teacherOnly) {
      res.json({
        data: {
          ...result,
          totalDebt: undefined,
          items: result.items.map((row: Record<string, unknown>) => ({
            studentId: row.studentId,
            studentName: row.studentName,
            groupName: row.groupName,
            hasDebt: true,
          })),
        },
      })
      return
    }

    res.json({ data: result })
  }),
)

/** §11.3 — the separate "Kurs puli to'lamaganlar" tab. */
paymentRouter.get(
  '/debtors/unpaid',
  requirePermission('debtor.view'),
  requireFullGrant('debtor.view'),
  validateQuery(debtorQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as { page: number; limit: number; groupId?: string }
    res.json({ data: await listDebtors({ ...query, unpaidOnly: true }) })
  }),
)

/**
 * The approval queue.
 *
 * The client's rule is that an Admin approves payments but never sees the
 * centre's finances. These three routes are what "approves" means: a list of
 * what is waiting, and a decision on one payment at a time.
 *
 * Note what is *not* here — no totals, no revenue, no collection rate. Those
 * live on `/finance/*`, which returns 403 to an Admin and audits the attempt
 * (§4.3, §21.3). The separation is enforced by which router a thing lives on,
 * not by hiding a column.
 */
paymentRouter.get(
  '/pending-approval',
  requirePermission('payment.approve'),
  asyncRoute(async (_req, res) => {
    const pending = await Payment.find({ approvalStatus: 'pending', isRefund: false })
      .sort({ receivedAt: -1 })
      .limit(100)
      .populate('studentId', 'fullName')
      .populate('receivedBy', 'fullName')
      .lean()

    res.json({
      data: pending.map((payment) => ({
        _id: payment._id.toString(),
        amount: payment.amount,
        method: payment.method,
        receivedAt: payment.receivedAt,
        receiptNo: payment.receiptNo,
        note: payment.note,
        student: payment.studentId,
        receivedByName:
          (payment.receivedBy as unknown as { fullName?: string } | null)?.fullName ?? undefined,
      })),
    })
  }),
)

paymentRouter.post(
  '/:id/approve',
  requirePermission('payment.approve'),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const payment = await Payment.findById(req.params.id)
    if (!payment) throw ApiError.notFound('Payment not found')

    if (payment.approvalStatus !== 'pending') {
      throw new ApiError(409, 'ALREADY_DECIDED', 'That payment has already been decided')
    }

    // Approving does not touch the amount — a payment is immutable (§11.2).
    // Only the decision is recorded.
    payment.approvalStatus = 'approved'
    payment.approvedBy = actor._id
    payment.approvedAt = new Date()
    await payment.save()

    await recordAudit({
      action: 'payment.approve',
      entity: 'Payment',
      entityId: payment._id,
      actorId: actor._id,
      actorName: actor.fullName,
      after: { amount: payment.amount, method: payment.method },
      req,
    })

    res.json({ data: { ok: true } })
  }),
)

paymentRouter.post(
  '/:id/reject',
  requirePermission('payment.approve'),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const payment = await Payment.findById(req.params.id)
    if (!payment) throw ApiError.notFound('Payment not found')

    if (payment.approvalStatus !== 'pending') {
      throw new ApiError(409, 'ALREADY_DECIDED', 'That payment has already been decided')
    }

    payment.approvalStatus = 'rejected'
    payment.approvedBy = actor._id
    payment.approvedAt = new Date()
    payment.rejectedReason = String(req.body?.reason ?? 'rejected')
    await payment.save()

    await recordAudit({
      action: 'payment.reject',
      entity: 'Payment',
      entityId: payment._id,
      actorId: actor._id,
      actorName: actor.fullName,
      outcome: 'failure',
      reason: payment.rejectedReason,
      req,
    })

    res.json({ data: { ok: true } })
  }),
)

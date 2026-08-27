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
import { can } from '@leader/shared/permissions'
import { formatDdMmYyyy } from '@leader/shared/date'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { recordAudit } from '../audit/audit.service.js'
import {
  requireAuth,
  requirePermission,
  requireFullGrant,
  requireRole,
  writeGuards,
  currentUser,
} from '../../middleware/auth.js'
import { Invoice, Payment } from './invoice.model.js'
import { Student } from '../students/student.model.js'
import {
  acceptPayment,
  refundPayment,
  generateInvoices,
  listDebtors,
  recalculateOverdue,
  reconcileBalances,
} from './payment.service.js'
import { streamReceiptPdf } from './receipt.service.js'

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

/** A5 — drift report between the Payment ledger and Student.balance/Invoice.paidAmount. */
paymentRouter.get(
  '/reconcile',
  requireRole('superadmin'),
  asyncRoute(async (_req, res) => {
    res.json({ data: await reconcileBalances() })
  }),
)

/**
 * §11.2 — the most-used endpoint in the CRM. Target: under 15 seconds from
 * search to printed receipt, so it does one thing and returns fast.
 */
paymentRouter.post(
  '/',
  // §5.1 — money must land in a named branch, never in the consolidated scope.
  ...writeGuards('payment.accept'),
  validateBody(acceptPaymentSchema),
  asyncRoute(async (req, res) => {
    const { payment, replayed } = await acceptPayment(req.body, currentUser(req).id)
    res.status(replayed ? 200 : 201).json({ data: { payment, replayed } })
  }),
)

/**
 * A2 — the printable/downloadable receipt. Staff holding `payment.accept` may
 * pull any receipt; a student/parent may only pull their own (checked against
 * the `Student` record linked to their login, same pattern as `allowSelfOr`).
 */
paymentRouter.get(
  '/:id/receipt.pdf',
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const roles = actor.roles.map((assignment) => assignment.role)

    if (!roles.some((role) => can(role, 'payment.accept'))) {
      const payment = await Payment.findById(req.params.id).select('studentId').lean()
      if (!payment) throw ApiError.notFound('Payment not found')
      const ownStudent = await Student.findOne({ userId: actor._id, deletedAt: null })
        .select('_id')
        .lean()
      if (!ownStudent || ownStudent._id.toString() !== payment.studentId.toString()) {
        throw ApiError.forbidden('You may only download your own receipt')
      }
    }

    await streamReceiptPdf(String(req.params.id), res)
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
      search?: string
      courseId?: string
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
          unpaidCount: undefined,
          criticalCount: undefined,
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
    const query = res.locals.query as {
      page: number
      limit: number
      search?: string
      courseId?: string
      groupId?: string
      teacherId?: string
      minDaysOverdue?: number
    }
    res.json({ data: await listDebtors({ ...query, unpaidOnly: true }) })
  }),
)

/** §11.3 — Export debtors list to CSV. */
paymentRouter.get(
  '/debtors/export',
  requirePermission('debtor.view'),
  requireFullGrant('debtor.view'),
  validateQuery(debtorQuerySchema),
  asyncRoute(async (_req, res) => {
    const query = res.locals.query as {
      search?: string
      courseId?: string
      groupId?: string
      teacherId?: string
      minDaysOverdue?: number
      unpaidOnly?: boolean
    }

    const result = await listDebtors({
      ...query,
      page: 1,
      limit: 10_000,
    })

    const header = [
      'F.I',
      'Telefon',
      'Ota-ona telefoni',
      'Guruh',
      'Davr',
      'Qarz miqdori',
      'Kechikkan kunlar',
      'Jami summa',
      'To\'langan',
      'Muddati',
    ]

    const rows = result.items.map((row: Record<string, unknown>) => [
      row.studentName ?? '',
      row.phone ?? '',
      row.parentPhone ?? '',
      row.groupName ?? '',
      row.period ?? '',
      row.due ?? 0,
      row.daysOverdue ?? 0,
      row.finalAmount ?? 0,
      row.paidAmount ?? 0,
      row.dueDate ? formatDdMmYyyy(row.dueDate as string) : '',
    ])

    const escape = (cell: unknown) => {
      const text = String(cell ?? '')
      return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const csv = [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')

    res.setHeader('content-type', 'text/csv; charset=utf-8')
    res.setHeader('content-disposition', 'attachment; filename="debtors.csv"')
    res.send(`\uFEFF${csv}`)
  }),
)

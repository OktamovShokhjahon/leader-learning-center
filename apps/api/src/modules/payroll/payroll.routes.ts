import { Router } from 'express'
import {
  payrollPeriodSchema,
  payrollQuerySchema,
  salarySchemeSchema,
  updateSalarySchemeSchema,
  parseSort,
} from '@leader/shared/schemas'
import { ApiError } from '@leader/shared/errors'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js'
import { getScope } from '../../middleware/branch-scope.js'
import { recordAudit } from '../audit/audit.service.js'
import { Payroll, SalaryScheme } from '../fines/fine.model.js'
import { User } from '../users/user.model.js'
import { calculatePayroll, approvePayroll, markPaid } from './payroll.service.js'

/**
 * TZ §23 — `PAYROLL (superadmin, except own)`.
 *
 * The `/payroll/me` exception is already declared in
 * `SUPERADMIN_ROUTE_EXCEPTIONS`, so it is mounted *before* the blanket
 * superadmin guard below — §14.2 gives everyone their own payslip, and only
 * their own.
 */
export const payrollRouter = Router()

payrollRouter.use(requireAuth)

/** §14.2 — everyone sees their own payslip. Nobody sees anyone else's here. */
payrollRouter.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const items = await Payroll.find({
      userId: actor._id,
      status: { $in: ['approved', 'paid'] },
      deletedAt: null,
    })
      .sort({ period: -1 })
      .limit(24)
      .lean()

    // The `basis.paymentIds` trail is internal working, not something an
    // employee needs — and it names other people's payments.
    res.json({
      data: items.map((payslip) => ({
        ...payslip,
        basis: { ...payslip.basis, paymentIds: undefined },
      })),
    })
  }),
)

// Everything below is the boss's (§4.2 `salary.viewAny`, §15).
payrollRouter.use(requireRole('superadmin'))

payrollRouter.get(
  '/',
  validateQuery(payrollQuerySchema),
  asyncRoute(async (_req, res) => {
    const query = res.locals.query
    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.period) filter.period = query.period
    if (query.userId) filter.userId = query.userId
    if (query.status) filter.status = query.status

    const [items, total] = await Promise.all([
      Payroll.find(filter)
        .populate('userId', 'fullName phone')
        .sort(parseSort(query.sort === '-createdAt' ? '-period' : query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Payroll.countDocuments(filter),
    ])

    res.json({
      data: {
        items,
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.max(1, Math.ceil(total / query.limit)),
        grossTotal: items.reduce((sum, row) => sum + (row.gross ?? 0), 0),
        netTotal: items.reduce((sum, row) => sum + (row.net ?? 0), 0),
      },
    })
  }),
)

payrollRouter.post(
  '/calculate',
  validateBody(payrollPeriodSchema),
  asyncRoute(async (req, res) => {
    const scope = getScope()?.branchId
    const result = await calculatePayroll(
      currentUser(req),
      req.body.period,
      scope && scope !== 'ALL' ? scope : undefined,
      req,
    )
    res.json({ data: result })
  }),
)

payrollRouter.post(
  '/:id/approve',
  asyncRoute(async (req, res) => {
    res.json({ data: await approvePayroll(currentUser(req), String(req.params.id), req) })
  }),
)

payrollRouter.post(
  '/:id/pay',
  asyncRoute(async (req, res) => {
    res.json({ data: await markPaid(currentUser(req), String(req.params.id), req) })
  }),
)

/* ── Salary schemes (§14.1) ───────────────────────────────────────────── */

payrollRouter.get(
  '/schemes',
  asyncRoute(async (_req, res) => {
    const items = await SalaryScheme.find({ deletedAt: null })
      .populate('userId', 'fullName phone roles')
      .lean()
    res.json({ data: { items, total: items.length } })
  }),
)

payrollRouter.post(
  '/schemes',
  validateBody(salarySchemeSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    if (!(await User.exists({ _id: req.body.userId, deletedAt: null }))) {
      throw ApiError.badRequest('Unknown account')
    }

    const before = await SalaryScheme.findOne({ userId: req.body.userId, deletedAt: null }).lean()
    const scheme = await SalaryScheme.findOneAndUpdate(
      { userId: req.body.userId },
      { $set: { ...req.body, updatedBy: actor._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    await recordAudit({
      action: 'salaryScheme.set',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'SalaryScheme',
      entityId: scheme!._id,
      before: before ? { scheme: before.scheme, baseAmount: before.baseAmount } : undefined,
      after: { scheme: scheme!.scheme, baseAmount: scheme!.baseAmount, share: scheme!.share },
      req,
    })

    res.json({ data: scheme })
  }),
)

payrollRouter.patch(
  '/schemes/:userId',
  validateBody(updateSalarySchemeSchema),
  asyncRoute(async (req, res) => {
    const scheme = await SalaryScheme.findOne({ userId: req.params.userId, deletedAt: null })
    if (!scheme) throw ApiError.notFound('No salary scheme for that account')
    scheme.set({ ...req.body, updatedBy: currentUser(req)._id })
    await scheme.save()
    res.json({ data: scheme })
  }),
)

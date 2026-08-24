import { Router } from 'express'
import { z } from 'zod'
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseQuerySchema,
  expenseDecisionSchema,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  EXPENSE_CATEGORY_SEED,
  paginationSchema,
  parseSort,
} from '@leader/shared/schemas'
import { ApiError } from '@leader/shared/errors'
import { isLimited } from '@leader/shared/permissions'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import {
  requireAuth,
  requirePermission,
  requireRole,
  requireSingleBranch,
  writeGuards,
  currentUser,
} from '../../middleware/auth.js'
import { getScope } from '../../middleware/branch-scope.js'
import { recordAudit, diff } from '../audit/audit.service.js'
import { resolveSetting } from '../settings/settings.service.js'
import { Expense, ExpenseCategory } from './expense.model.js'

/**
 * TZ §13 — `harajat`. The client's words: *"харажат кисми хам булсин супер ва
 * простой админдда"* — powerful, but simple.
 *
 * The simple half is `POST /expenses`: four fields, no ceremony, target under
 * ten seconds end to end. The powerful half is everything below it — budgets,
 * approval routing, recurring templates and the summary the `Молия` sheet wants.
 */
export const expenseRouter = Router()

expenseRouter.use(requireAuth)

/* ── Categories (§13.2) ───────────────────────────────────────────────── */

expenseRouter.get(
  '/categories',
  requirePermission('expense.create'),
  validateQuery(paginationSchema),
  asyncRoute(async (_req, res) => {
    const categories = await ExpenseCategory.find({ deletedAt: null }).sort({ slug: 1 }).lean()
    res.json({ data: { items: categories, total: categories.length } })
  }),
)

/**
 * Seeds the §13.2 list into the current branch. Idempotent — a category that
 * already exists is left alone, so this is safe to press twice.
 */
expenseRouter.post(
  '/categories/seed',
  requireRole('superadmin'),
  requireSingleBranch,
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const branchId = getScope()?.branchId

    let created = 0
    for (const seed of EXPENSE_CATEGORY_SEED) {
      const exists = await ExpenseCategory.exists({ slug: seed.slug, branchId })
      if (exists) continue
      await ExpenseCategory.create({
        slug: seed.slug,
        name: { uz: seed.uz, ru: seed.ru },
        icon: seed.icon,
        color: seed.color,
        petty: 'petty' in seed ? seed.petty : false,
        payrollOnly: 'payroll' in seed ? seed.payroll : false,
        createdBy: actor._id,
      })
      created += 1
    }

    res.json({ data: { created, total: EXPENSE_CATEGORY_SEED.length } })
  }),
)

expenseRouter.post(
  '/categories',
  requireRole('superadmin'),
  requireSingleBranch,
  validateBody(createExpenseCategorySchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    if (await ExpenseCategory.exists({ slug: req.body.slug, deletedAt: null })) {
      throw ApiError.conflict('That category already exists in this branch')
    }
    const category = await ExpenseCategory.create({ ...req.body, createdBy: actor._id })
    res.status(201).json({ data: category })
  }),
)

expenseRouter.patch(
  '/categories/:id',
  requireRole('superadmin'),
  validateBody(updateExpenseCategorySchema),
  asyncRoute(async (req, res) => {
    const category = await ExpenseCategory.findOne({ _id: req.params.id, deletedAt: null })
    if (!category) throw ApiError.notFound('Category not found')
    category.set({ ...req.body, updatedBy: currentUser(req)._id })
    await category.save()
    res.json({ data: category })
  }),
)

/* ── Expenses ─────────────────────────────────────────────────────────── */

expenseRouter.get(
  '/',
  requirePermission('expense.create'),
  validateQuery(expenseQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query
    const filter: Record<string, unknown> = { deletedAt: null }

    if (query.categoryId) filter.categoryId = query.categoryId
    if (query.status) filter.status = query.status
    if (query.minAmount) filter.amount = { $gte: query.minAmount }
    if (query.from || query.to) {
      filter.spentAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      }
    }
    // §4.2 note 5 — a Manager sees what they recorded, not the branch's books.
    if (isLimited(req.role!, 'expense.create')) filter.createdBy = currentUser(req)._id

    const [items, total, sum] = await Promise.all([
      Expense.find(filter)
        .populate('categoryId', 'name icon color slug')
        .sort(parseSort(query.sort === '-createdAt' ? '-spentAt' : query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Expense.countDocuments(filter),
      Expense.aggregate([
        { $match: { ...filter, status: { $ne: 'rejected' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ])

    res.json({
      data: {
        items,
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.max(1, Math.ceil(total / query.limit)),
        totalAmount: sum[0]?.total ?? 0,
      },
    })
  }),
)

/**
 * §13.1 — the ten-second path.
 *
 * The routing decision lives here rather than in the UI: a Manager is `limited`
 * (note 5), so their category must be petty and their amount under the petty
 * ceiling; anyone's expense above the branch approval ceiling enters
 * `pending_approval` instead of being booked (note 6).
 */
expenseRouter.post(
  '/',
  ...writeGuards('expense.create'),
  validateBody(createExpenseSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const branchId = getScope()?.branchId

    const category = await ExpenseCategory.findOne({
      _id: req.body.categoryId,
      deletedAt: null,
    })
    if (!category) throw ApiError.badRequest('Unknown category')
    if (category.payrollOnly) {
      throw ApiError.badRequest('Salary expenses are generated from payroll, not entered by hand')
    }

    const limited = isLimited(req.role!, 'expense.create')
    if (limited) {
      if (!category.petty) {
        throw ApiError.forbidden('Your role can only record petty-cash categories')
      }
      const ceiling = await resolveSetting('money.pettyCashCeiling', branchId)
      if (req.body.amount > ceiling) {
        throw ApiError.forbidden(`Your per-transaction limit is ${ceiling} so'm`)
      }
    }

    const approvalCeiling = await resolveSetting('money.expenseApprovalCeiling', branchId)
    const needsApproval = req.body.amount > approvalCeiling

    const expense = await Expense.create({
      ...req.body,
      status: needsApproval ? 'pending_approval' : 'approved',
      ...(needsApproval ? {} : { approvedBy: actor._id, approvedAt: new Date() }),
      createdBy: actor._id,
    })

    await recordAudit({
      action: 'expense.create',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Expense',
      entityId: expense._id,
      after: {
        amount: expense.amount,
        category: category.slug,
        status: expense.status,
      },
      req,
    })

    res.status(201).json({
      data: { expense, needsApproval, approvalCeiling },
    })
  }),
)

expenseRouter.patch(
  '/:id',
  requirePermission('expense.create'),
  validateBody(updateExpenseSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const expense = await Expense.findOne({ _id: req.params.id, deletedAt: null })
    if (!expense) throw ApiError.notFound('Expense not found')

    // An approved expense is part of the branch's books; correcting one is a
    // SuperAdmin act, not an edit anybody with the create grant can make.
    if (expense.status === 'approved' && isLimited(req.role!, 'expense.create')) {
      throw ApiError.forbidden('An approved expense can only be changed by the boss')
    }
    if (expense.payrollId) {
      throw ApiError.badRequest('This row came from payroll — change the payroll run instead')
    }

    const before = expense.toObject()
    expense.set({ ...req.body, updatedBy: actor._id })
    await expense.save()

    const changes = diff(before as Record<string, unknown>, req.body)
    await recordAudit({
      action: 'expense.update',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Expense',
      entityId: expense._id,
      before: changes.before,
      after: changes.after,
      req,
    })
    res.json({ data: expense })
  }),
)

expenseRouter.delete(
  '/:id',
  requireRole('superadmin'),
  asyncRoute(async (req, res) => {
    const expense = await Expense.findOne({ _id: req.params.id, deletedAt: null })
    if (!expense) throw ApiError.notFound('Expense not found')
    if (expense.payrollId) {
      throw ApiError.badRequest('This row came from payroll — change the payroll run instead')
    }

    expense.deletedAt = new Date()
    await expense.save()

    await recordAudit({
      action: 'expense.delete',
      actorId: currentUser(req)._id,
      actorName: currentUser(req).fullName,
      entity: 'Expense',
      entityId: expense._id,
      before: { amount: expense.amount },
      req,
    })
    res.json({ data: { deleted: true } })
  }),
)

/* ── Approval (§13.3, §4.2 note 6) ────────────────────────────────────── */

expenseRouter.get(
  '/pending',
  requirePermission('expense.approve'),
  asyncRoute(async (_req, res) => {
    const items = await Expense.find({ status: 'pending_approval', deletedAt: null })
      .populate('categoryId', 'name icon color slug')
      .sort({ spentAt: -1 })
      .limit(100)
      .lean()
    res.json({ data: items })
  }),
)

for (const [action, status] of [
  ['approve', 'approved'],
  ['reject', 'rejected'],
] as const) {
  expenseRouter.post(
    `/:id/${action}`,
    requirePermission('expense.approve'),
    validateBody(expenseDecisionSchema),
    asyncRoute(async (req, res) => {
      const actor = currentUser(req)
      const expense = await Expense.findOne({ _id: req.params.id, deletedAt: null })
      if (!expense) throw ApiError.notFound('Expense not found')
      if (expense.status !== 'pending_approval') {
        throw ApiError.conflict('That expense has already been decided')
      }

      expense.status = status
      expense.approvedBy = actor._id
      expense.approvedAt = new Date()
      if (action === 'reject') expense.rejectedReason = req.body.reason
      await expense.save()

      await recordAudit({
        action: `expense.${action}`,
        actorId: actor._id,
        actorName: actor.fullName,
        entity: 'Expense',
        entityId: expense._id,
        outcome: action === 'approve' ? 'success' : 'failure',
        reason: req.body.reason,
        after: { status, amount: expense.amount },
        req,
      })

      res.json({ data: expense })
    }),
  )
}

/* ── Summary (§13.3 / §23 `?groupBy=category|month|branch`) ───────────── */

const summaryQuerySchema = z.object({
  groupBy: z.enum(['category', 'month', 'branch']).default('category'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

expenseRouter.get(
  '/summary',
  requirePermission('expense.viewBranchTotal'),
  validateQuery(summaryQuerySchema),
  asyncRoute(async (_req, res) => {
    const { groupBy, from, to } = res.locals.query
    const match: Record<string, unknown> = { deletedAt: null, status: 'approved' }
    if (from || to) {
      match.spentAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) }
    }

    const groupKey =
      groupBy === 'month'
        ? { $dateToString: { format: '%Y-%m', date: '$spentAt' } }
        : groupBy === 'branch'
          ? '$branchId'
          : '$categoryId'

    const rows = await Expense.aggregate([
      { $match: match },
      { $group: { _id: groupKey, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ])

    // Category ids mean nothing to a reader; resolve them to names in one pass.
    let labelled = rows
    if (groupBy === 'category') {
      const categories = await ExpenseCategory.find({}).select('name slug icon color').lean()
      labelled = rows.map((row) => {
        const category = categories.find((c) => c._id.toString() === row._id?.toString())
        return { ...row, name: category?.name ?? null, slug: category?.slug, icon: category?.icon, color: category?.color }
      })
    }

    res.json({
      data: {
        groupBy,
        rows: labelled,
        total: rows.reduce((sum, row) => sum + row.total, 0),
      },
    })
  }),
)

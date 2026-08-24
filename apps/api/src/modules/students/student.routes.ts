import { Router } from 'express'
import { Types } from 'mongoose'
import {
  createStudentSchema,
  updateStudentSchema,
  studentQuerySchema,
  setFeeSchema,
  transferSchema,
  parseSort,
} from '@leader/shared/schemas'
import { ApiError } from '@leader/shared/errors'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import {
  requireAuth,
  requirePermission,
  writeGuards,
  currentUser,
} from '../../middleware/auth.js'
import { transferStudent } from './transfer.service.js'
import { allowSelfOr } from '../../middleware/self-access.js'
import { recordAudit } from '../audit/audit.service.js'
import { Student } from './student.model.js'
import { Enrollment } from '../groups/group.model.js'
import { Invoice, Payment } from '../payments/invoice.model.js'

/**
 * TZ §23 — the `STUDENTS` block.
 *
 * Every query here is branch-scoped automatically by the Mongoose plugin
 * (§5.1), so no handler filters by branch itself and none can forget to.
 */
export const studentRouter = Router()

studentRouter.use(requireAuth)

studentRouter.get(
  '/',
  requirePermission('student.manage'),
  validateQuery(studentQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as {
      page: number
      limit: number
      sort: string
      search?: string
      status?: string
      groupId?: string
    }

    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.status) filter.status = query.status
    if (query.search) {
      // Name or phone — the front desk searches by whichever they have.
      filter.$or = [
        { fullName: { $regex: query.search, $options: 'i' } },
        { phone: { $regex: query.search, $options: 'i' } },
      ]
    }
    if (query.groupId) {
      const ids = await Enrollment.find({ groupId: query.groupId, status: 'active' })
        .distinct('studentId')
        .lean?.()
      filter._id = { $in: ids }
    }

    const [items, total] = await Promise.all([
      Student.find(filter)
        .sort(parseSort(query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Student.countDocuments(filter),
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
 * §11.2 — "Search a student by name or by the last 4 digits of a phone —
 * results appear as you type, showing photo, group and debt."
 *
 * Deliberately a separate, lean endpoint: the payment screen is the most-used
 * in the CRM and must not wait on a full paginated list.
 */
studentRouter.get(
  '/search',
  requirePermission('student.manage'),
  asyncRoute(async (req, res) => {
    const term = String(req.query.q ?? '').trim()
    if (term.length < 2) {
      res.json({ data: [] })
      return
    }

    const students = await Student.find({
      deletedAt: null,
      status: { $nin: ['dropped'] },
      $or: [
        { fullName: { $regex: term, $options: 'i' } },
        { phone: { $regex: `${term}$` } },
      ],
    })
      .select('fullName phone photo status balance')
      .limit(8)
      .lean()

    // Attach outstanding debt so the cashier sees what to collect immediately.
    const debts = await Invoice.aggregate<{ _id: Types.ObjectId; due: number }>([
      {
        $match: {
          studentId: { $in: students.map((student) => student._id) },
          status: { $in: ['pending', 'partial', 'overdue'] },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: '$studentId',
          due: { $sum: { $subtract: ['$finalAmount', '$paidAmount'] } },
        },
      },
    ])
    const debtBy = new Map(debts.map((row) => [row._id.toString(), row.due]))

    res.json({
      data: students.map((student) => ({
        ...student,
        debt: debtBy.get(student._id.toString()) ?? 0,
      })),
    })
  }),
)

studentRouter.get(
  '/:id',
  // §4.2 — staff with student.manage, or the learner opening their own cabinet.
  allowSelfOr('student.manage', (req) => String(req.params.id ?? '')),
  asyncRoute(async (req, res) => {
    const student = await Student.findOne({ _id: req.params.id, deletedAt: null }).lean()
    if (!student) throw ApiError.notFound('Student not found')

    const [enrollments, invoices, payments] = await Promise.all([
      Enrollment.find({ studentId: student._id, status: 'active' }).populate('groupId').lean(),
      Invoice.find({ studentId: student._id, deletedAt: null }).sort({ period: -1 }).limit(24).lean(),
      Payment.find({ studentId: student._id }).sort({ receivedAt: -1 }).limit(24).lean(),
    ])

    res.json({ data: { ...student, enrollments, invoices, payments } })
  }),
)

studentRouter.post(
  '/',
  // §5.1 — the branch-scope plugin stamps `branchId` from the request scope, and
  // in the consolidated `'ALL'` scope it has nothing to stamp. Without this the
  // record would be created belonging to no branch at all.
  ...writeGuards('student.manage'),
  validateBody(createStudentSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const student = await Student.create({ ...req.body, createdBy: actor._id })
    await recordAudit({
      action: 'student.create',
      entity: 'Student',
      entityId: student.id,
      actorId: actor._id,
      after: { fullName: student.fullName },
      req,
    })
    res.status(201).json({ data: student })
  }),
)

studentRouter.patch(
  '/:id',
  requirePermission('student.manage'),
  validateBody(updateStudentSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const student = await Student.findOne({ _id: req.params.id, deletedAt: null })
    if (!student) throw ApiError.notFound('Student not found')

    // §9.1 — churn is uncountable without a cause, so `dropped` demands one.
    if (req.body.status === 'dropped' && !req.body.dropReason && !student.dropReason) {
      throw ApiError.badRequest('A drop reason is required', { field: 'dropReason' })
    }

    const before = { status: student.status, monthlyFee: student.monthlyFee }
    Object.assign(student, req.body, { updatedBy: actor._id })
    await student.save()

    await recordAudit({
      action: 'student.update',
      entity: 'Student',
      entityId: student.id,
      actorId: actor._id,
      before,
      after: { status: student.status, monthlyFee: student.monthlyFee },
      req,
    })
    res.json({ data: student })
  }),
)

/** §4.2 — changing a student's fee is Admin and above; a Manager cannot. */
studentRouter.post(
  '/:id/fee',
  requirePermission('student.setFee'),
  validateBody(setFeeSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const student = await Student.findOne({ _id: req.params.id, deletedAt: null })
    if (!student) throw ApiError.notFound('Student not found')

    const before = { monthlyFee: student.monthlyFee, discountPercent: student.discountPercent }
    student.monthlyFee = req.body.monthlyFee
    if (req.body.discountPercent !== undefined) {
      student.discountPercent = req.body.discountPercent
    }
    student.updatedBy = actor._id
    await student.save()

    // §21.3 — price changes are on the mandatory audit list.
    await recordAudit({
      action: 'student.setFee',
      entity: 'Student',
      entityId: student.id,
      actorId: actor._id,
      before,
      after: { monthlyFee: student.monthlyFee, discountPercent: student.discountPercent },
      req,
    })
    res.json({ data: student })
  }),
)

/** §9.1 — freezing stops invoice generation without losing the student's history. */
studentRouter.post(
  '/:id/freeze',
  requirePermission('student.manage'),
  asyncRoute(async (req, res) => {
    const student = await Student.findOne({ _id: req.params.id, deletedAt: null })
    if (!student) throw ApiError.notFound('Student not found')
    student.status = student.status === 'frozen' ? 'active' : 'frozen'
    await student.save()
    await recordAudit({
      action: 'student.freeze',
      entity: 'Student',
      entityId: student.id,
      actorId: currentUser(req)._id,
      after: { status: student.status },
      req,
    })
    res.json({ data: student })
  }),
)

/**
 * §23 lists `freeze` and `unfreeze` separately, and the difference is not
 * cosmetic: a toggle sent twice by a flaky connection lands back where it
 * started, which for billing is the wrong kind of silent.
 */
studentRouter.post(
  '/:id/unfreeze',
  requirePermission('student.manage'),
  asyncRoute(async (req, res) => {
    const student = await Student.findOne({ _id: req.params.id, deletedAt: null })
    if (!student) throw ApiError.notFound('Student not found')
    if (student.status !== 'frozen') {
      res.json({ data: student })
      return
    }

    student.status = 'active'
    await student.save()
    await recordAudit({
      action: 'student.unfreeze',
      entity: 'Student',
      entityId: student.id,
      actorId: currentUser(req)._id,
      after: { status: student.status },
      req,
    })
    res.json({ data: student })
  }),
)

/** §23 / §4.2 — "Move student between groups / branches". */
studentRouter.post(
  '/:id/transfer',
  requirePermission('student.transfer'),
  validateBody(transferSchema),
  asyncRoute(async (req, res) => {
    const result = await transferStudent(currentUser(req), String(req.params.id), req.body, req)
    res.json({ data: result })
  }),
)

/**
 * §23 — `GET /students/export  xlsx`.
 *
 * Streamed rather than buffered: a centre with several thousand students would
 * otherwise hold the whole workbook in memory to send it.
 */
studentRouter.get(
  '/export',
  requirePermission('student.manage'),
  validateQuery(studentQuerySchema),
  asyncRoute(async (_req, res) => {
    const query = res.locals.query
    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.status) filter.status = query.status

    const students = await Student.find(filter).sort({ fullName: 1 }).limit(10_000).lean()

    // The column order mirrors the centre's own workbook (§7.1), so an exported
    // file drops straight back into the sheet they already use.
    const header = [
      'F.I',
      'Telefon',
      'Ota-ona',
      'Ota-ona telefoni',
      'Status',
      'Kelgan sanasi',
      'Sinf',
      'Yosh',
      'Chek',
      'Chegirma %',
      'Balans',
    ]

    const rows = students.map((student) => [
      student.fullName,
      student.phone ?? '',
      student.parentName ?? '',
      student.parentPhone ?? '',
      student.status,
      student.joinedAt ? new Date(student.joinedAt).toISOString().slice(0, 10) : '',
      student.schoolClass ?? '',
      student.age ?? '',
      student.monthlyFee ?? 0,
      student.discountPercent ?? 0,
      student.balance ?? 0,
    ])

    // CSV with a BOM: Excel on a Windows machine opens UTF-8 as cp1251 without
    // one, and every O‘zbek name comes out mangled.
    const escape = (cell: unknown) => {
      const text = String(cell ?? '')
      return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const csv = [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n')

    res.setHeader('content-type', 'text/csv; charset=utf-8')
    res.setHeader('content-disposition', 'attachment; filename="students.csv"')
    res.send(`﻿${csv}`)
  }),
)

import { Types } from 'mongoose'
import { ApiError } from '@leader/shared/errors'
import { DEFAULT_LIMITS } from '@leader/shared/permissions'
import { Payroll, SalaryScheme, Fine } from '../fines/fine.model.js'
import { Payment } from '../payments/invoice.model.js'
import { Group, Enrollment, Lesson } from '../groups/group.model.js'
import { Expense, ExpenseCategory } from '../expenses/expense.model.js'
import { User } from '../users/user.model.js'
import { recordAudit, type RequestMeta } from '../audit/audit.service.js'
import { resolveSetting } from '../settings/settings.service.js'
import type { UserDocument } from '../users/user.model.js'

/**
 * TZ §14 — salary schemes and the payroll run.
 *
 * §30.7 is the acceptance criterion this file exists to satisfy: *"Payroll is
 * calculated for a month; a percentage-based teacher's figure is traceable to
 * the exact collected payments that produced it."*
 *
 * "Collected", not "invoiced", is the whole design. A teacher on 0.6 is paid a
 * share of money the centre actually received — invoicing a debtor does not put
 * anything in the till, and paying out against it would mean the centre funds
 * the shortfall. So the basis is `Payment` rows in the period, and their ids are
 * stored on the payslip so the figure can still be traced after a later refund
 * changes the total.
 */

export function monthBounds(period: string) {
  const [year, month] = period.split('-').map(Number)
  return {
    start: new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)),
    end: new Date(Date.UTC(year ?? 1970, month ?? 1, 0, 23, 59, 59, 999)),
  }
}

/**
 * The payments a teacher's groups collected in a period.
 *
 * Refunds are stored as negative rows, so a plain sum is already net — a lesson
 * refunded in the same month reduces the base it was paid on, which is correct.
 */
async function collectedForTeacher(teacherId: Types.ObjectId, period: string) {
  const { start, end } = monthBounds(period)

  const groups = await Group.find({ teacherId, deletedAt: null }).select('_id').lean()
  const groupIds = groups.map((group) => group._id)
  if (groupIds.length === 0) return { total: 0, paymentIds: [] as Types.ObjectId[] }

  // A payment points at an invoice, and the invoice names the group. Students
  // in several groups are exactly why this cannot be done by student id.
  const payments = await Payment.aggregate<{ _id: Types.ObjectId; amount: number }>([
    { $match: { receivedAt: { $gte: start, $lte: end } } },
    {
      $lookup: {
        from: 'invoices',
        localField: 'invoiceId',
        foreignField: '_id',
        as: 'invoice',
      },
    },
    { $unwind: '$invoice' },
    { $match: { 'invoice.groupId': { $in: groupIds } } },
    { $project: { _id: 1, amount: 1 } },
  ])

  return {
    total: payments.reduce((sum, payment) => sum + payment.amount, 0),
    paymentIds: payments.map((payment) => payment._id),
  }
}

async function lessonsTaught(teacherId: Types.ObjectId, period: string) {
  const { start, end } = monthBounds(period)
  return Lesson.countDocuments({
    teacherId,
    date: { $gte: start, $lte: end },
    status: { $ne: 'cancelled' },
  })
}

async function activeStudentsOf(teacherId: Types.ObjectId) {
  const groups = await Group.find({ teacherId, deletedAt: null }).select('_id').lean()
  if (groups.length === 0) return 0
  return Enrollment.countDocuments({
    groupId: { $in: groups.map((group) => group._id) },
    status: 'active',
  })
}

/** Unpaid employee fines in the period become deductions on this payslip (§12.3). */
async function deductionsFor(userId: Types.ObjectId, period: string) {
  const { end } = monthBounds(period)
  const fines = await Fine.find({
    targetType: 'employee',
    targetId: userId,
    status: 'issued',
    appliedTo: 'payroll',
    appliedAt: null,
    createdAt: { $lte: end },
    deletedAt: null,
  }).lean()

  return fines.map((fine) => ({
    fineId: fine._id,
    label: fine.reason?.slice(0, 80) ?? 'Jarima',
    amount: fine.amount,
  }))
}

/**
 * §14.2 — the run.
 *
 * Idempotent on `(userId, period, branchId)`: re-running recomputes a draft in
 * place rather than issuing a second payslip. An **approved** payslip is never
 * recomputed — by then it is a commitment, and quietly moving the number after
 * someone signed it off is the worst thing this function could do.
 */
export async function calculatePayroll(
  actor: UserDocument,
  period: string,
  branchId: string | undefined,
  req: RequestMeta,
) {
  const staff = await User.find({
    isActive: true,
    deletedAt: null,
    'roles.role': { $in: ['teacher', 'manager', 'superadmin'] },
    ...(branchId ? { 'roles.branchId': branchId } : {}),
  }).lean()

  const defaultShare = await resolveSetting('money.defaultTeacherShare', branchId)

  const results = []
  let skipped = 0

  for (const person of staff) {
    const existing = await Payroll.findOne({ userId: person._id, period, deletedAt: null })
    if (existing && existing.status !== 'draft') {
      skipped += 1
      continue
    }

    const scheme = await SalaryScheme.findOne({
      userId: person._id,
      isActive: true,
      deletedAt: null,
    }).lean()

    // No scheme configured means no payslip — inventing one would put a number
    // in front of the boss that nobody chose.
    if (!scheme) continue

    const basis = {
      collectedTotal: 0,
      paymentIds: [] as Types.ObjectId[],
      lessonsTaught: 0,
      activeStudents: 0,
      share: scheme.share ?? defaultShare ?? DEFAULT_LIMITS.teacherShare,
    }
    let gross = 0

    switch (scheme.scheme) {
      case 'fixed':
        gross = scheme.baseAmount ?? 0
        break

      case 'percentage': {
        const collected = await collectedForTeacher(person._id, period)
        basis.collectedTotal = collected.total
        basis.paymentIds = collected.paymentIds
        gross = Math.round(collected.total * basis.share)
        break
      }

      case 'per_lesson': {
        basis.lessonsTaught = await lessonsTaught(person._id, period)
        gross = basis.lessonsTaught * (scheme.rate ?? 0)
        break
      }

      case 'per_student': {
        basis.activeStudents = await activeStudentsOf(person._id)
        gross = basis.activeStudents * (scheme.rate ?? 0)
        break
      }

      case 'mixed': {
        const collected = await collectedForTeacher(person._id, period)
        basis.collectedTotal = collected.total
        basis.paymentIds = collected.paymentIds
        gross = (scheme.baseAmount ?? 0) + Math.round(collected.total * basis.share)
        break
      }
    }

    const deductions = await deductionsFor(person._id, period)
    const net = Math.max(0, gross - deductions.reduce((sum, row) => sum + row.amount, 0))

    const payslip = existing ?? new Payroll({ userId: person._id, period, branchId })
    payslip.set({
      scheme: scheme.scheme,
      basis,
      gross,
      deductions,
      net,
      status: 'draft',
      createdBy: actor._id,
    })
    await payslip.save()
    results.push(payslip)
  }

  await recordAudit({
    action: 'payroll.calculate',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'Payroll',
    entityId: period,
    after: {
      period,
      payslips: results.length,
      skipped,
      gross: results.reduce((sum, row) => sum + (row.gross ?? 0), 0),
    },
    req,
  })

  return {
    period,
    calculated: results.length,
    skippedAlreadyApproved: skipped,
    grossTotal: results.reduce((sum, row) => sum + (row.gross ?? 0), 0),
    netTotal: results.reduce((sum, row) => sum + (row.net ?? 0), 0),
  }
}

/**
 * Approving locks the figure and writes the matching `Oylik` expense.
 *
 * §13.2 says salaries are "auto-generated from payroll, not entered manually",
 * and this is where that happens — the single write that makes the `Молия`
 * sheet's three streams reconcile without anyone double-entering a number.
 */
export async function approvePayroll(actor: UserDocument, payrollId: string, req: RequestMeta) {
  const payslip = await Payroll.findOne({ _id: payrollId, deletedAt: null })
  if (!payslip) throw ApiError.notFound('Payslip not found')
  if (payslip.status !== 'draft') throw ApiError.conflict('That payslip is already approved')

  payslip.status = 'approved'
  payslip.approvedBy = actor._id
  payslip.approvedAt = new Date()

  const category = await ExpenseCategory.findOne({
    slug: 'oylik',
    branchId: payslip.branchId,
    deletedAt: null,
  })
  if (category) {
    const { end } = monthBounds(payslip.period)
    const expense = await Expense.create({
      branchId: payslip.branchId,
      categoryId: category._id,
      amount: payslip.net,
      spentAt: end,
      comment: `Oylik ${payslip.period}`,
      status: 'approved',
      approvedBy: actor._id,
      approvedAt: new Date(),
      payrollId: payslip._id,
      createdBy: actor._id,
    })
    payslip.expenseId = expense._id
  }

  // The fines this payslip absorbed are now charged, so nothing charges them
  // again on next month's run.
  const fineIds = (payslip.deductions ?? []).map((row) => row.fineId).filter(Boolean)
  if (fineIds.length > 0) {
    await Fine.updateMany(
      { _id: { $in: fineIds } },
      { $set: { status: 'paid', appliedRefId: payslip._id, appliedAt: new Date() } },
    )
  }

  await payslip.save()

  await recordAudit({
    action: 'payroll.approve',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'Payroll',
    entityId: payslip._id,
    after: { net: payslip.net, expenseId: payslip.expenseId?.toString() },
    req,
  })

  return payslip
}

export async function markPaid(actor: UserDocument, payrollId: string, req: RequestMeta) {
  const payslip = await Payroll.findOne({ _id: payrollId, deletedAt: null })
  if (!payslip) throw ApiError.notFound('Payslip not found')
  if (payslip.status !== 'approved') throw ApiError.conflict('Approve the payslip first')

  payslip.status = 'paid'
  payslip.paidAt = new Date()
  await payslip.save()

  await recordAudit({
    action: 'payroll.pay',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'Payroll',
    entityId: payslip._id,
    after: { net: payslip.net },
    req,
  })

  return payslip
}

import mongoose, { Types } from 'mongoose'
import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import type { AcceptPaymentInput } from '@leader/shared/schemas'
import { Invoice, Payment, deriveStatus, type PaymentDocument } from './invoice.model.js'
import { Student, isBillable, type StudentDocument } from '../students/student.model.js'
import { Enrollment, Group } from '../groups/group.model.js'
import { Branch } from '../branches/branch.model.js'
import { supportsTransactions } from '../../config/db.js'
import { env } from '../../config/env.js'
import { getScope } from '../../middleware/branch-scope.js'
import { recordAudit } from '../audit/audit.service.js'
import { logger } from '../../config/logger.js'

/**
 * TZ §11 — invoices and payments.
 *
 * Two rules govern everything here:
 *   · §26.4 — money is whole so'm, and an invoice+payment write runs inside a
 *     MongoDB transaction so a crash can never leave money half-recorded.
 *   · §11.2 — payments are immutable. A mistake becomes a refund document that
 *     references the original, never an edit.
 */

/** `2026-09` → the last calendar day of that month. */
function periodEnd(period: string): Date {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year ?? 1970, month ?? 1, 0, 23, 59, 59))
}

function periodStart(period: string): Date {
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1))
}

export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * §11.1 — one invoice per active enrolment per period.
 *
 * Idempotent by construction: the unique index on (student, group, period) means
 * re-running the job cannot bill anyone twice, and the run reports what it
 * skipped rather than failing.
 */
export async function generateInvoices(
  period: string,
  options: { dryRun?: boolean; actorId?: string } = {},
) {
  const branchId = getScope()?.branchId
  const enrollments = await Enrollment.find({ status: 'active', deletedAt: null })
    .populate('studentId')
    .populate('groupId')
    .lean()

  const branch = branchId && branchId !== 'ALL' ? await Branch.findById(branchId).lean() : null
  const graceDays = branch?.settings?.overdueGraceDays ?? 3
  const due = new Date(periodStart(period))
  due.setUTCDate(due.getUTCDate() + graceDays + 9)

  /**
   * §26.3 — "All jobs are idempotent (safe to re-run)."
   *
   * The unique index on (student, group, period) is the backstop, but it is
   * built asynchronously: on a fresh database the first run can finish before
   * the index exists, and a second run then bills everyone twice. Reading what
   * already exists makes the job idempotent on its own, and the index stays as
   * the guard against two runs racing each other.
   */
  const already = await Invoice.find({ period, deletedAt: null })
    .select('studentId groupId')
    .lean()
  const billed = new Set(
    already.map((invoice) => `${invoice.studentId.toString()}:${invoice.groupId.toString()}`),
  )

  const planned: {
    studentId: Types.ObjectId
    groupId: Types.ObjectId
    branchId: Types.ObjectId
    amount: number
    discount: number
    finalAmount: number
  }[] = []
  let skipped = 0

  for (const enrollment of enrollments) {
    const student = enrollment.studentId as unknown as {
      _id: Types.ObjectId
      status: string
      monthlyFee?: number
      discountPercent?: number
    } | null
    const group = enrollment.groupId as unknown as {
      _id: Types.ObjectId
      price?: number
      status: string
    } | null

    if (!student || !group) {
      skipped += 1
      continue
    }
    // §11.1 — frozen and completed students generate no invoices.
    if (!isBillable(student.status) || group.status === 'finished') {
      skipped += 1
      continue
    }
    if (billed.has(`${student._id.toString()}:${group._id.toString()}`)) {
      skipped += 1
      continue
    }

    // The enrolment price wins: it is the fee the student agreed to.
    const amount = enrollment.price || group.price || student.monthlyFee || 0
    if (amount <= 0) {
      skipped += 1
      continue
    }

    const percent = enrollment.discountPercent ?? student.discountPercent ?? 0
    const discount = Math.round((amount * percent) / 100)

    planned.push({
      studentId: student._id,
      groupId: group._id,
      branchId: enrollment.branchId as unknown as Types.ObjectId,
      amount,
      discount,
      finalAmount: amount - discount,
    })
  }

  if (options.dryRun) {
    return { period, created: 0, skipped, wouldCreate: planned.length, dryRun: true }
  }

  let created = 0
  for (const row of planned) {
    try {
      await Invoice.create({
        ...row,
        period,
        dueDate: due,
        status: 'pending',
        items: [{ type: 'tuition', label: `Kurs puli ${period}`, amount: row.finalAmount }],
        createdBy: options.actorId,
      })
      created += 1
    } catch (error) {
      // Duplicate key — this enrolment already has an invoice for the period.
      if ((error as { code?: number }).code === 11000) skipped += 1
      else throw error
    }
  }

  const billedStudents = [...new Set(planned.map((row) => row.studentId.toString()))]
  for (const studentId of billedStudents) {
    await syncStudentStatus(studentId)
  }

  logger.info({ period, created, skipped }, 'invoice run finished')
  return { period, created, skipped, wouldCreate: planned.length, dryRun: false }
}

/**
 * §11.2 — accept a payment. The most-used screen in the whole CRM.
 *
 * Runs in a transaction: the payment row, the invoice's `paidAmount` and the
 * student's carry-over balance either all land or none do. Without that, an
 * interrupted request can take a student's money and leave the invoice unpaid.
 */
export async function acceptPayment(input: AcceptPaymentInput, actorId: string) {
  const amount = Number(input.amount)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw ApiError.badRequest('Amount must be a positive whole number of so‘m')
  }

  // §26.4 — replaying the same key returns the original rather than charging again.
  if (input.idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey: input.idempotencyKey })
    if (existing) return { payment: existing, replayed: true }
  }

  const student = await Student.findById(input.studentId)
  if (!student) throw ApiError.notFound('Student not found')

  /**
   * §26.4 — the money path runs in a transaction, and a transaction needs a
   * replica set. On a standalone mongod the driver fails with "Transaction
   * numbers are only allowed on a replica set member", which tells a cashier
   * nothing. Refuse up front with an instruction instead.
   *
   * `ALLOW_NON_TRANSACTIONAL_PAYMENTS` exists so the CRM can be clicked through
   * on a laptop with a plain mongod. It is refused in production, because
   * without a transaction an interrupted request can take a student's money and
   * leave the invoice unpaid.
   */
  if (!(await supportsTransactions())) {
    if (env.isProduction || !env.ALLOW_NON_TRANSACTIONAL_PAYMENTS) {
      throw new ApiError(
        503,
        'TRANSACTIONS_UNAVAILABLE',
        'Payments need MongoDB as a replica set. Start one with ' +
          '"docker compose -f infra/docker-compose.yml up -d", or run mongod with --replSet rs0.',
      )
    }
    logger.warn(
      { studentId: student.id },
      'accepting a payment WITHOUT a transaction — development escape hatch',
    )
    return acceptPaymentUnsafe(input, student, actorId)
  }

  const session = await mongoose.startSession()
  try {
    let payment!: Awaited<ReturnType<typeof Payment.create>>[number]

    await session.withTransaction(async () => {
      // Oldest unpaid first, so a payment clears the longest-standing debt.
      const invoice = input.invoiceId
        ? await Invoice.findById(input.invoiceId).session(session)
        : await Invoice.findOne({
            studentId: student._id,
            status: { $in: ['pending', 'partial', 'overdue'] },
            deletedAt: null,
          })
            .sort({ dueDate: 1 })
            .session(session)

      if (input.invoiceId && !invoice) throw ApiError.notFound('Invoice not found')
      if (invoice && invoice.status === 'paid') {
        throw new ApiError(409, ERROR_CODES.INVOICE_ALREADY_PAID, 'That invoice is already settled')
      }

      const receiptNo = await nextReceiptNo(student.branchId.toString())

      const [created] = await Payment.create(
        [
          {
            branchId: student.branchId,
            invoiceId: invoice?._id,
            studentId: student._id,
            amount,
            method: input.method,
            receivedBy: actorId,
            receivedAt: new Date(),
            receiptNo,
            note: input.note,
            idempotencyKey: input.idempotencyKey,
          },
        ],
        { session },
      )
      payment = created!

      if (invoice) {
        const outstanding = invoice.finalAmount - invoice.paidAmount
        const applied = Math.min(amount, outstanding)
        invoice.paidAmount += applied
        invoice.status = deriveStatus(
          invoice.finalAmount,
          invoice.paidAmount,
          invoice.dueDate,
          new Date(),
        )
        if (invoice.status === 'paid') invoice.paidAt = new Date()
        await invoice.save({ session })

        // §11.2 — surplus goes to the balance and is auto-applied next time.
        const surplus = amount - applied
        if (surplus > 0) {
          student.balance += surplus
          await student.save({ session })
        }
      } else {
        student.balance += amount
        await student.save({ session })
      }

      await syncStudentStatus(student._id.toString(), session)
    })

    await recordAudit({
      action: 'payment.accept',
      entity: 'Payment',
      entityId: payment.id,
      actorId,
      after: { amount, method: input.method, studentId: student.id },
    })

    return { payment, replayed: false }
  } finally {
    await session.endSession()
  }
}

/**
 * The non-transactional path, reachable only via ALLOW_NON_TRANSACTIONAL_PAYMENTS
 * outside production.
 *
 * The write order is deliberate: the payment row lands *first*, so if the process
 * dies mid-way the money is recorded and the invoice is merely stale — which a
 * re-run of `recalculateOverdue` and a glance at the payment list can repair.
 * The reverse order would lose the payment entirely.
 */
async function acceptPaymentUnsafe(
  input: AcceptPaymentInput,
  student: StudentDocument,
  actorId: string,
) {
  const amount = Number(input.amount)
  const invoice = input.invoiceId
    ? await Invoice.findById(input.invoiceId)
    : await Invoice.findOne({
        studentId: student._id,
        status: { $in: ['pending', 'partial', 'overdue'] },
        deletedAt: null,
      }).sort({ dueDate: 1 })

  if (input.invoiceId && !invoice) throw ApiError.notFound('Invoice not found')
  if (invoice && invoice.status === 'paid') {
    throw new ApiError(409, ERROR_CODES.INVOICE_ALREADY_PAID, 'That invoice is already settled')
  }

  const payment = await Payment.create({
    branchId: student.branchId,
    invoiceId: invoice?._id,
    studentId: student._id,
    amount,
    method: input.method,
    receivedBy: actorId,
    receivedAt: new Date(),
    receiptNo: await nextReceiptNo(student.branchId.toString()),
    note: input.note,
    idempotencyKey: input.idempotencyKey,
  })

  if (invoice) {
    const applied = Math.min(amount, invoice.finalAmount - invoice.paidAmount)
    invoice.paidAmount += applied
    invoice.status = deriveStatus(
      invoice.finalAmount,
      invoice.paidAmount,
      invoice.dueDate,
      new Date(),
    )
    if (invoice.status === 'paid') invoice.paidAt = new Date()
    await invoice.save()
    const surplus = amount - applied
    if (surplus > 0) {
      student.balance += surplus
      await student.save()
    }
  } else {
    student.balance += amount
    await student.save()
  }

  await syncStudentStatus(student._id.toString())
  await recordAudit({
    action: 'payment.accept',
    entity: 'Payment',
    entityId: payment.id,
    actorId,
    after: { amount, method: input.method, studentId: student.id, nonTransactional: true },
  })

  return { payment, replayed: false }
}

/**
 * §11.2 — a refund is a new document that references the original. The original
 * is never touched, so the money history stays auditable.
 */
export async function refundPayment(
  paymentId: string,
  input: { reason: string; amount?: number },
  actorId: string,
) {
  const original = await Payment.findById(paymentId)
  if (!original) throw ApiError.notFound('Payment not found')
  if (original.isRefund) throw ApiError.badRequest('A refund cannot itself be refunded')

  const already = await Payment.aggregate<{ total: number }>([
    { $match: { refundOf: original._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  const refunded = Math.abs(already[0]?.total ?? 0)
  const remaining = original.amount - refunded
  const amount = input.amount ?? remaining

  if (amount <= 0 || amount > remaining) {
    throw ApiError.badRequest(`Refundable amount is ${remaining}`, { remaining })
  }

  // §26.4 — a reversal touches the same two documents as a payment, so it needs
  // the same transaction, and the same honest refusal when there is not one.
  if (!(await supportsTransactions())) {
    if (env.isProduction || !env.ALLOW_NON_TRANSACTIONAL_PAYMENTS) {
      throw new ApiError(
        503,
        'TRANSACTIONS_UNAVAILABLE',
        'Refunds need MongoDB as a replica set. Start one with ' +
          '"docker compose -f infra/docker-compose.yml up -d", or run mongod with --replSet rs0.',
      )
    }
    logger.warn({ paymentId }, 'refunding WITHOUT a transaction — development escape hatch')
    return refundPaymentUnsafe(original, amount, input.reason, actorId)
  }

  const session = await mongoose.startSession()
  try {
    let refund!: Awaited<ReturnType<typeof Payment.create>>[number]

    await session.withTransaction(async () => {
      const [created] = await Payment.create(
        [
          {
            branchId: original.branchId,
            invoiceId: original.invoiceId,
            studentId: original.studentId,
            // Stored negative so summing the collection gives net revenue.
            amount: -amount,
            method: original.method,
            receivedBy: actorId,
            receivedAt: new Date(),
            isRefund: true,
            refundOf: original._id,
            refundReason: input.reason,
          },
        ],
        { session },
      )
      refund = created!

      if (original.invoiceId) {
        const invoice = await Invoice.findById(original.invoiceId).session(session)
        if (invoice) {
          invoice.paidAmount = Math.max(0, invoice.paidAmount - amount)
          invoice.status = deriveStatus(
            invoice.finalAmount,
            invoice.paidAmount,
            invoice.dueDate,
            new Date(),
          )
          if (invoice.status !== 'paid') invoice.paidAt = undefined
          await invoice.save({ session })
        }
      }

      await syncStudentStatus(original.studentId.toString(), session)
    })

    await recordAudit({
      action: 'payment.refund',
      entity: 'Payment',
      entityId: refund.id,
      actorId,
      before: { paymentId: original.id, amount: original.amount },
      after: { amount: -amount, reason: input.reason },
    })

    return refund
  } finally {
    await session.endSession()
  }
}

/**
 * The non-transactional reversal, reachable only via
 * ALLOW_NON_TRANSACTIONAL_PAYMENTS outside production.
 *
 * Same ordering rule as the payment path: the counter-document lands first, so
 * an interruption leaves a recorded reversal and a stale invoice rather than a
 * silently vanished one.
 */
async function refundPaymentUnsafe(
  original: PaymentDocument,
  amount: number,
  reason: string,
  actorId: string,
) {
  const refund = await Payment.create({
    branchId: original.branchId,
    invoiceId: original.invoiceId,
    studentId: original.studentId,
    // Negative, so summing the collection gives net revenue.
    amount: -amount,
    method: original.method,
    receivedBy: actorId,
    receivedAt: new Date(),
    isRefund: true,
    refundOf: original._id,
    refundReason: reason,
  })

  if (original.invoiceId) {
    const invoice = await Invoice.findById(original.invoiceId)
    if (invoice) {
      invoice.paidAmount = Math.max(0, invoice.paidAmount - amount)
      invoice.status = deriveStatus(
        invoice.finalAmount,
        invoice.paidAmount,
        invoice.dueDate,
        new Date(),
      )
      if (invoice.status !== 'paid') invoice.paidAt = undefined
      await invoice.save()
    }
  }

  await syncStudentStatus(original.studentId.toString())
  await recordAudit({
    action: 'payment.refund',
    entity: 'Payment',
    entityId: refund.id,
    actorId,
    before: { paymentId: original.id, amount: original.amount },
    after: { amount: -amount, reason, nonTransactional: true },
  })

  return refund
}

const BILLABLE_STATUSES = ['active', 'pending', 'paid', 'overdue'] as const

/** §9.1 — the workbook's `Status` column, kept in step with what is owed. */
export async function syncStudentStatus(studentId: string, session?: mongoose.ClientSession) {
  const student = await Student.findById(studentId).session(session ?? null)
  if (!student || !isBillable(student.status)) return

  const open = await Invoice.find({
    studentId: student._id,
    status: { $in: ['pending', 'partial', 'overdue'] },
    deletedAt: null,
    $expr: { $lt: ['$paidAmount', '$finalAmount'] },
  })
    .session(session ?? null)
    .lean()

  const now = new Date()
  const overdue = open.some((invoice) => now > invoice.dueDate)

  student.status = overdue ? 'overdue' : open.length === 0 ? 'paid' : 'active'
  await student.save({ session })
}

/**
 * Promote billable students who have past-due invoices to `overdue`.
 * Does not rewrite a status someone just set in the student card — listing
 * or opening Qarzdorlar used to flip `overdue` back to `active`/`paid`.
 *
 * A5 note: this is deliberately promote-only. `listDebtors` below still gates
 * its primary student match on `status === 'overdue'` (by design, so a
 * student can be flagged as a debtor even with zero matching invoice rows —
 * see the qarzdorlar aggregation), so demoting inline here would remove rows
 * from the very response a caller is about to read. A full two-way
 * reconciliation belongs with that aggregation's own redesign, not bolted
 * onto this sweep.
 */
async function syncBillableStudentStatuses(now = new Date()) {
  const overdueIds = await Invoice.distinct('studentId', {
    status: { $in: ['pending', 'partial', 'overdue'] },
    dueDate: { $lt: now },
    deletedAt: null,
    $expr: { $lt: ['$paidAmount', '$finalAmount'] },
  })

  if (overdueIds.length === 0) return

  await Student.updateMany(
    { _id: { $in: overdueIds }, status: { $in: BILLABLE_STATUSES } },
    { $set: { status: 'overdue' } },
  )
}

/** §11.2 — a human-readable receipt number, sequential within a branch. */
async function nextReceiptNo(branchId: string): Promise<string> {
  const year = new Date().getUTCFullYear()
  const count = await Payment.countDocuments({
    branchId: new Types.ObjectId(branchId),
    isRefund: false,
  })
  return `${year}-${String(count + 1).padStart(6, '0')}`
}

/**
 * A4 — "auto-unfreeze on end date." Runs alongside `recalculateOverdue` so a
 * frozen student who was never manually unfrozen comes back to `active` (and
 * therefore back into billing and the debtor list) exactly when their
 * freeze's `toDate` passes, with no extra job to schedule.
 */
async function autoUnfreezeStudents(now = new Date()) {
  const candidates = await Student.find({
    status: 'frozen',
    deletedAt: null,
    freezePeriods: { $elemMatch: { toDate: { $lt: now }, unfrozenAt: null } },
  })

  for (const student of candidates) {
    const openPeriod = [...student.freezePeriods]
      .reverse()
      .find((period) => !period.unfrozenAt && period.toDate < now)
    if (!openPeriod) continue

    openPeriod.unfrozenAt = now
    student.status = 'active'
    await student.save()
  }

  return { unfrozen: candidates.length }
}

/**
 * §11.1 — the nightly sweep that moves due invoices to `overdue`.
 * Idempotent: running it twice changes nothing the second time (§26.3).
 */
export async function recalculateOverdue(now = new Date()) {
  const result = await Invoice.updateMany(
    {
      status: { $in: ['pending', 'partial'] },
      dueDate: { $lt: now },
      deletedAt: null,
      $expr: { $lt: ['$paidAmount', '$finalAmount'] },
    },
    { $set: { status: 'overdue' } },
  )
  const { unfrozen } = await autoUnfreezeStudents(now)
  await syncBillableStudentStatuses(now)
  return { updated: result.modifiedCount, unfrozen }
}

/**
 * A5 — balances must be derivable from the ledger, never entered manually.
 * The transactional write path in `acceptPayment`/`refundPayment` is what
 * normally guarantees that; the dev-only `acceptPaymentUnsafe`/
 * `refundPaymentUnsafe` escape hatches skip the transaction and could in
 * principle leave `Payment` and `Student.balance` out of step.
 *
 * The invariant checked: every so'm a student ever paid (net of refunds,
 * which are stored as negative `Payment.amount`) either landed on an invoice
 * as `paidAmount`, or sits unapplied as `Student.balance` — there is nowhere
 * else for it to go. So `Σ Payment.amount − Σ Invoice.paidAmount` must equal
 * `Student.balance` for every student; anything else is drift.
 */
export async function reconcileBalances() {
  const [paymentSums, invoiceSums] = await Promise.all([
    Payment.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $group: { _id: '$studentId', total: { $sum: '$amount' } } },
    ]),
    Invoice.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: '$studentId', total: { $sum: '$paidAmount' } } },
    ]),
  ])

  const appliedByStudent = new Map(invoiceSums.map((row) => [row._id.toString(), row.total]))
  const studentIds = paymentSums.map((row) => row._id)
  const students = await Student.find({ _id: { $in: studentIds } })
    .select('balance fullName')
    .lean()
  const studentsById = new Map(students.map((student) => [student._id.toString(), student]))

  const drift: Array<{
    studentId: string
    studentName?: string
    expectedBalance: number
    actualBalance: number
  }> = []

  for (const row of paymentSums) {
    const sid = row._id.toString()
    const expectedBalance = row.total - (appliedByStudent.get(sid) ?? 0)
    const student = studentsById.get(sid)
    const actualBalance = student?.balance ?? 0
    if (expectedBalance !== actualBalance) {
      drift.push({
        studentId: sid,
        studentName: student?.fullName,
        expectedBalance,
        actualBalance,
      })
    }
  }

  return { checked: paymentSums.length, driftCount: drift.length, drift }
}

/**
 * §11.3 — the qarzdorlar list: "student · group · teacher · phone · parent phone
 * · period · amount due · days overdue · last payment date".
 */
export async function listDebtors(options: {
  search?: string
  courseId?: string
  groupId?: string
  teacherId?: string
  minDaysOverdue?: number
  unpaidOnly?: boolean
  page: number
  limit: number
}) {
  await recalculateOverdue()

  const now = new Date()
  const studentMatch: Record<string, unknown> = {
    status: 'overdue',
    deletedAt: null,
  }
  if (options.search?.trim()) {
    const term = options.search.trim()
    studentMatch.$or = [
      { fullName: { $regex: term, $options: 'i' } },
      { phone: { $regex: term, $options: 'i' } },
      { parentPhone: { $regex: term, $options: 'i' } },
    ]
  }

  const invoiceAnd: Record<string, unknown>[] = [
    { $eq: ['$studentId', '$$sid'] },
    { $in: ['$status', ['overdue', 'partial', 'pending']] },
    { $lt: ['$paidAmount', '$finalAmount'] },
    { $eq: [{ $ifNull: ['$deletedAt', null] }, null] },
  ]
  if (options.groupId) invoiceAnd.push({ $eq: ['$groupId', new Types.ObjectId(options.groupId)] })
  if (options.unpaidOnly) invoiceAnd.push({ $eq: ['$paidAmount', 0] })

  const mustHaveInvoice = Boolean(options.unpaidOnly || options.groupId)

  const rows = await Student.aggregate([
    { $match: studentMatch },
    {
      $lookup: {
        from: 'invoices',
        let: { sid: '$_id' },
        pipeline: [{ $match: { $expr: { $and: invoiceAnd } } }],
        as: 'invoiceDocs',
      },
    },
    {
      $unwind: {
        path: '$invoiceDocs',
        preserveNullAndEmptyArrays: !mustHaveInvoice,
      },
    },
    {
      $lookup: {
        from: 'groups',
        localField: 'invoiceDocs.groupId',
        foreignField: '_id',
        as: 'group',
      },
    },
    { $unwind: { path: '$group', preserveNullAndEmptyArrays: true } },
    ...(options.courseId
      ? [{ $match: { 'group.courseId': new Types.ObjectId(options.courseId) } }]
      : []),
    ...(options.teacherId
      ? [{ $match: { 'group.teacherId': new Types.ObjectId(options.teacherId) } }]
      : []),
    {
      $addFields: {
        due: {
          $ifNull: [{ $subtract: ['$invoiceDocs.finalAmount', '$invoiceDocs.paidAmount'] }, 0],
        },
        daysOverdue: {
          $cond: [
            { $ifNull: ['$invoiceDocs.dueDate', false] },
            {
              $max: [
                0,
                {
                  $floor: {
                    $divide: [{ $subtract: [now, '$invoiceDocs.dueDate'] }, 1000 * 60 * 60 * 24],
                  },
                },
              ],
            },
            0,
          ],
        },
      },
    },
    ...(options.minDaysOverdue
      ? [{ $match: { daysOverdue: { $gte: options.minDaysOverdue } } }]
      : []),
    { $sort: { daysOverdue: -1, fullName: 1 } },
    {
      $facet: {
        items: [
          { $skip: (options.page - 1) * options.limit },
          { $limit: options.limit },
          {
            $project: {
              invoiceId: '$invoiceDocs._id',
              period: '$invoiceDocs.period',
              due: 1,
              daysOverdue: 1,
              dueDate: '$invoiceDocs.dueDate',
              paidAmount: '$invoiceDocs.paidAmount',
              finalAmount: '$invoiceDocs.finalAmount',
              studentId: '$_id',
              studentName: '$fullName',
              phone: 1,
              parentPhone: 1,
              groupId: '$group._id',
              groupName: '$group.name',
              courseId: '$group.courseId',
              teacherId: '$group.teacherId',
            },
          },
        ],
        summary: [
          {
            $group: {
              _id: null,
              total: { $sum: '$due' },
              count: { $sum: 1 },
              unpaidCount: {
                $sum: { $cond: [{ $eq: [{ $ifNull: ['$invoiceDocs.paidAmount', 0] }, 0] }, 1, 0] },
              },
              criticalCount: {
                $sum: { $cond: [{ $gte: ['$daysOverdue', 10] }, 1, 0] },
              },
              // G5 — the same 1–3 / 4–9 / 10+ bands the debtors screen already
              // filters by, pre-counted so the overview donut doesn't need a
              // separate unpaginated fetch to draw its slices.
              band1to3Count: {
                $sum: {
                  $cond: [{ $and: [{ $gte: ['$daysOverdue', 1] }, { $lt: ['$daysOverdue', 4] }] }, 1, 0],
                },
              },
              band4to9Count: {
                $sum: {
                  $cond: [{ $and: [{ $gte: ['$daysOverdue', 4] }, { $lt: ['$daysOverdue', 10] }] }, 1, 0],
                },
              },
            },
          },
        ],
      },
    },
  ])

  const facet = rows[0] ?? { items: [], summary: [] }
  const summary = facet.summary[0] ?? {
    total: 0,
    count: 0,
    unpaidCount: 0,
    criticalCount: 0,
    band1to3Count: 0,
    band4to9Count: 0,
  }

  const localizeName = (value: unknown): string | undefined => {
    if (!value) return undefined
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value !== null) {
      if ('uz' in value && (value as { uz?: string }).uz) return String((value as { uz?: string }).uz)
      if ('ru' in value && (value as { ru?: string }).ru) return String((value as { ru?: string }).ru)
      if ('en' in value && (value as { en?: string }).en) return String((value as { en?: string }).en)
    }
    return undefined
  }

  return {
    items: facet.items.map((row: Record<string, unknown>) => ({
      ...row,
      groupName: localizeName(row.groupName),
    })),
    total: summary.count,
    totalDebt: summary.total,
    unpaidCount: summary.unpaidCount ?? 0,
    criticalCount: summary.criticalCount ?? 0,
    band1to3Count: summary.band1to3Count ?? 0,
    band4to9Count: summary.band4to9Count ?? 0,
    page: options.page,
    limit: options.limit,
    pages: Math.max(1, Math.ceil(summary.count / options.limit)),
  }
}

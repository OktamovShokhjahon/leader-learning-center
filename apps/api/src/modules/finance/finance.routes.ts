import { Router } from 'express'
import { Types } from 'mongoose'
import { financeQuerySchema } from '@leader/shared/schemas'
import { validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { getScope, withAllBranches } from '../../middleware/branch-scope.js'
import { Invoice, Payment } from '../payments/invoice.model.js'
import { Student } from '../students/student.model.js'
import { Group } from '../groups/group.model.js'
import { Branch } from '../branches/branch.model.js'
import { currentPeriod } from '../payments/payment.service.js'

/**
 * TZ §15 — the finance dashboard. **SuperAdmin only.**
 *
 * §4.3: "Any endpoint returning money data is additionally guarded by a hard
 * `requireRole('superadmin')` middleware placed at the router level, so a
 * mistake in a single controller cannot leak it."
 *
 * That guard is the two lines below, and it is why no handler in this file
 * repeats the check: there is no path into this router without passing them.
 */
export const financeRouter = Router()

financeRouter.use(requireAuth)
financeRouter.use(requireRole('superadmin'))

function monthBounds(period: string) {
  const [year, month] = period.split('-').map(Number)
  return {
    start: new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1)),
    end: new Date(Date.UTC(year ?? 1970, month ?? 1, 0, 23, 59, 59, 999)),
  }
}

/** Shifts a `YYYY-MM` period by whole months. */
function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + months, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Net of refunds — refunds are stored negative, so a plain sum is already net. */
async function collectedIn(period: string, branchId?: Types.ObjectId) {
  const { start, end } = monthBounds(period)
  const rows = await Payment.aggregate<{ total: number; count: number }>([
    {
      $match: {
        receivedAt: { $gte: start, $lte: end },
        ...(branchId ? { branchId } : {}),
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ])
  return { total: rows[0]?.total ?? 0, count: rows[0]?.count ?? 0 }
}

async function invoicedIn(period: string, branchId?: Types.ObjectId) {
  const rows = await Invoice.aggregate<{ total: number; count: number }>([
    { $match: { period, deletedAt: null, ...(branchId ? { branchId } : {}) } },
    { $group: { _id: null, total: { $sum: '$finalAmount' }, count: { $sum: 1 } } },
  ])
  return { total: rows[0]?.total ?? 0, count: rows[0]?.count ?? 0 }
}

/**
 * §15.1 — the dashboard widgets: revenue this month vs last, collection rate,
 * receivables with ageing buckets, and the average cheque.
 */
financeRouter.get(
  '/overview',
  validateQuery(financeQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as { period?: string }
    const period = query.period ?? currentPeriod()
    const previous = shiftPeriod(period, -1)

    const scope = getScope()?.branchId
    const branchId = scope && scope !== 'ALL' ? new Types.ObjectId(scope) : undefined

    const [collected, collectedPrev, invoiced, receivables, activeStudents] = await Promise.all([
      collectedIn(period, branchId),
      collectedIn(previous, branchId),
      invoicedIn(period, branchId),
      // §15.1 — ageing buckets: 1–7, 8–30, 30+ days.
      Invoice.aggregate<{ _id: number | string; total: number; count: number }>([
        {
          $match: {
            status: { $in: ['pending', 'partial', 'overdue'] },
            deletedAt: null,
            ...(branchId ? { branchId } : {}),
            $expr: { $lt: ['$paidAmount', '$finalAmount'] },
          },
        },
        {
          $addFields: {
            due: { $subtract: ['$finalAmount', '$paidAmount'] },
            days: {
              $floor: {
                $divide: [{ $subtract: [new Date(), '$dueDate'] }, 1000 * 60 * 60 * 24],
              },
            },
          },
        },
        {
          $bucket: {
            groupBy: '$days',
            boundaries: [-100000, 1, 8, 31],
            default: '30+',
            output: { total: { $sum: '$due' }, count: { $sum: 1 } },
          },
        },
      ]),
      Student.countDocuments({
        status: { $in: ['active', 'paid', 'overdue', 'pending'] },
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      }),
    ])

    const outstanding = receivables.reduce((sum, bucket) => sum + bucket.total, 0)

    res.json({
      data: {
        period,
        revenue: {
          collected: collected.total,
          previous: collectedPrev.total,
          changePercent:
            collectedPrev.total > 0
              ? Math.round(((collected.total - collectedPrev.total) / collectedPrev.total) * 100)
              : null,
        },
        invoiced: invoiced.total,
        /** §15.1 — "the single most important operational number". */
        collectionRate:
          invoiced.total > 0 ? Math.round((collected.total / invoiced.total) * 100) : null,
        receivables: {
          outstanding,
          buckets: receivables.map((bucket) => ({
            range:
              bucket._id === '30+' ? '30+' : bucket._id === -100000 ? 'notYetDue' : String(bucket._id),
            total: bucket.total,
            count: bucket.count,
          })),
        },
        /** §15.1 — `Средняя` in the Статистика sheet. */
        averageCheque: collected.count > 0 ? Math.round(collected.total / collected.count) : 0,
        activeStudents,
      },
    })
  }),
)

/** §15.1 — revenue by course, straight off the group each invoice belongs to. */
financeRouter.get(
  '/revenue',
  validateQuery(financeQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as { period?: string }
    const period = query.period ?? currentPeriod()
    const scope = getScope()?.branchId
    const branchId = scope && scope !== 'ALL' ? new Types.ObjectId(scope) : undefined

    const byCourse = await Invoice.aggregate([
      { $match: { period, deletedAt: null, ...(branchId ? { branchId } : {}) } },
      { $lookup: { from: 'groups', localField: 'groupId', foreignField: '_id', as: 'group' } },
      { $unwind: { path: '$group', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'courses',
          localField: 'group.courseId',
          foreignField: '_id',
          as: 'course',
        },
      },
      { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$course.slug',
          courseName: { $first: '$course.name.uz' },
          invoiced: { $sum: '$finalAmount' },
          collected: { $sum: '$paidAmount' },
          students: { $sum: 1 },
        },
      },
      { $sort: { collected: -1 } },
    ])

    // Trailing six months, for the trend line.
    const trend: { period: string; collected: number }[] = []
    for (let index = 5; index >= 0; index -= 1) {
      const key = shiftPeriod(period, -index)
      trend.push({ period: key, collected: (await collectedIn(key, branchId)).total })
    }

    res.json({ data: { period, byCourse, trend } })
  }),
)

/**
 * §15.1 — "Branch comparison: a table ranking branches by revenue, profit,
 * students, debt, collection rate."
 *
 * The only place that legitimately reads across branches, so it goes through
 * `withAllBranches`, which logs the cross-branch read (§5.1).
 */
financeRouter.get(
  '/branches-comparison',
  validateQuery(financeQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as { period?: string }
    const period = query.period ?? currentPeriod()

    const rows = await withAllBranches('finance.branches-comparison', async () => {
      const branches = await Branch.find({ isActive: true, deletedAt: null })
        .select('name slug')
        .lean()

      return Promise.all(
        branches.map(async (branch) => {
          const [collected, invoiced, students, groups] = await Promise.all([
            collectedIn(period, branch._id),
            invoicedIn(period, branch._id),
            Student.countDocuments({
              branchId: branch._id,
              status: { $in: ['active', 'paid', 'overdue'] },
              deletedAt: null,
            }),
            Group.countDocuments({ branchId: branch._id, status: 'active', deletedAt: null }),
          ])

          return {
            branchId: branch._id,
            name: branch.name?.uz ?? branch.slug,
            slug: branch.slug,
            collected: collected.total,
            invoiced: invoiced.total,
            debt: Math.max(0, invoiced.total - collected.total),
            collectionRate:
              invoiced.total > 0 ? Math.round((collected.total / invoiced.total) * 100) : null,
            students,
            groups,
          }
        }),
      )
    })

    res.json({ data: { period, branches: rows.sort((a, b) => b.collected - a.collected) } })
  }),
)

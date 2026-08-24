import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { makeBranch, makeActor, auth, selectBranch } from '../../test/actors.js'
import { Course, Group } from '../groups/group.model.js'
import { Invoice, Payment } from '../payments/invoice.model.js'
import { Student } from '../students/student.model.js'
import { Fine, Payroll } from '../fines/fine.model.js'
import { ExpenseCategory, Expense } from '../expenses/expense.model.js'

/**
 * TZ §14, and specifically acceptance criterion §30.7:
 *
 *   "Payroll is calculated for a month; a percentage-based teacher's figure is
 *    traceable to the exact collected payments that produced it."
 *
 * That is what most of this file checks. The rest is the boundary that makes the
 * figure trustworthy: it is built from money actually *collected*, not invoiced.
 */
let app: Express

beforeAll(async () => {
  await connectTestDatabase()
  app = createApp()
}, 120_000)

afterAll(async () => {
  await disconnectTestDatabase()
})

beforeEach(async () => {
  await clearTestDatabase()
})

const PERIOD = '2026-08'

/** A teacher with one group, one student, and `paid` collected this period. */
async function scenario(paid: number[], invoiced = 1_000_000) {
  const branch = await makeBranch()
  const boss = await makeActor(app, 'superadmin')
  const teacher = await makeActor(app, 'teacher', branch._id)
  await selectBranch(app, boss.token, branch.id)

  const course = await Course.create({ slug: 'ge', name: { uz: 'GE' }, defaultPrice: 700_000 })
  const group = await Group.create({
    branchId: branch._id,
    courseId: course._id,
    name: 'GE-A2',
    teacherId: teacher.id,
    schedule: { pattern: 'juft', days: [2, 4, 6], startTime: '09:00', endTime: '10:30' },
    startDate: new Date('2026-08-01'),
    capacity: 12,
    price: 700_000,
    teacherShare: 0.6,
    status: 'active',
  })

  const student = await Student.create({
    branchId: branch._id,
    fullName: 'Dilnoza Rahimova',
    status: 'active',
    monthlyFee: invoiced,
  })

  const invoice = await Invoice.create({
    branchId: branch._id,
    studentId: student._id,
    groupId: group._id,
    period: PERIOD,
    amount: invoiced,
    finalAmount: invoiced,
    dueDate: new Date('2026-08-10'),
    status: 'pending',
  })

  for (const amount of paid) {
    await Payment.create({
      branchId: branch._id,
      invoiceId: invoice._id,
      studentId: student._id,
      amount,
      method: 'naqd',
      receivedAt: new Date('2026-08-15'),
      receivedBy: boss.id,
    })
  }

  return { branch, boss, teacher, group, student }
}

describe('POST /payroll/calculate — §30.7 traceability', () => {
  it('pays a percentage teacher a share of what was collected, and names the payments', async () => {
    const { boss, teacher } = await scenario([400_000, 200_000])

    await request(app)
      .post('/api/v1/payroll/schemes')
      .set(auth(boss.token))
      .send({ userId: teacher.id, scheme: 'percentage', share: 0.6 })
      .expect(200)

    await request(app)
      .post('/api/v1/payroll/calculate')
      .set(auth(boss.token))
      .send({ period: PERIOD })
      .expect(200)

    const payslip = await Payroll.findOne({ userId: teacher.id, period: PERIOD }).lean()
    expect(payslip).toBeTruthy()
    // 600 000 collected × 0.6
    expect(payslip!.basis?.collectedTotal).toBe(600_000)
    expect(payslip!.gross).toBe(360_000)
    // The trace: the exact payments the figure came from.
    expect(payslip!.basis?.paymentIds).toHaveLength(2)
  })

  it('is based on money collected, not money invoiced', async () => {
    // A million invoiced, a hundred thousand actually paid.
    const { boss, teacher } = await scenario([100_000], 1_000_000)

    await request(app)
      .post('/api/v1/payroll/schemes')
      .set(auth(boss.token))
      .send({ userId: teacher.id, scheme: 'percentage', share: 0.6 })
      .expect(200)
    await request(app)
      .post('/api/v1/payroll/calculate')
      .set(auth(boss.token))
      .send({ period: PERIOD })
      .expect(200)

    const payslip = await Payroll.findOne({ userId: teacher.id }).lean()
    expect(payslip!.gross).toBe(60_000)
  })

  it('nets a refund off the same month, because refunds are stored negative', async () => {
    const { boss, teacher } = await scenario([500_000, -100_000])

    await request(app)
      .post('/api/v1/payroll/schemes')
      .set(auth(boss.token))
      .send({ userId: teacher.id, scheme: 'percentage', share: 0.6 })
      .expect(200)
    await request(app)
      .post('/api/v1/payroll/calculate')
      .set(auth(boss.token))
      .send({ period: PERIOD })
      .expect(200)

    const payslip = await Payroll.findOne({ userId: teacher.id }).lean()
    expect(payslip!.basis?.collectedTotal).toBe(400_000)
    expect(payslip!.gross).toBe(240_000)
  })

  it('mints no payslip for someone with no salary scheme', async () => {
    const { boss } = await scenario([500_000])

    await request(app)
      .post('/api/v1/payroll/calculate')
      .set(auth(boss.token))
      .send({ period: PERIOD })
      .expect(200)

    expect(await Payroll.countDocuments({})).toBe(0)
  })

  it('recomputes a draft in place rather than issuing a second payslip', async () => {
    const { boss, teacher } = await scenario([500_000])
    await request(app)
      .post('/api/v1/payroll/schemes')
      .set(auth(boss.token))
      .send({ userId: teacher.id, scheme: 'fixed', baseAmount: 3_000_000 })
      .expect(200)

    for (let run = 0; run < 3; run += 1) {
      await request(app)
        .post('/api/v1/payroll/calculate')
        .set(auth(boss.token))
        .send({ period: PERIOD })
        .expect(200)
    }

    expect(await Payroll.countDocuments({ period: PERIOD })).toBe(1)
  })
})

describe('fines become payslip deductions (§12.3)', () => {
  it('deducts an unpaid employee fine and marks it charged on approval', async () => {
    const { boss, teacher, branch } = await scenario([1_000_000])

    await request(app)
      .post('/api/v1/payroll/schemes')
      .set(auth(boss.token))
      .send({ userId: teacher.id, scheme: 'fixed', baseAmount: 3_000_000 })
      .expect(200)

    const fine = await Fine.create({
      branchId: branch._id,
      targetType: 'employee',
      targetId: teacher.id,
      amount: 200_000,
      reason: 'Darsga kech qoldi, uch marta',
      appliedTo: 'payroll',
      status: 'issued',
    })

    await request(app)
      .post('/api/v1/payroll/calculate')
      .set(auth(boss.token))
      .send({ period: PERIOD })
      .expect(200)

    const draft = await Payroll.findOne({ userId: teacher.id }).lean()
    expect(draft!.deductions).toHaveLength(1)
    expect(draft!.net).toBe(2_800_000)

    // §13.2 — approving writes the matching `Oylik` expense so the books agree.
    await ExpenseCategory.create({
      branchId: branch._id,
      slug: 'oylik',
      name: { uz: 'Oylik' },
      payrollOnly: true,
    })

    await request(app)
      .post(`/api/v1/payroll/${draft!._id}/approve`)
      .set(auth(boss.token))
      .expect(200)

    expect((await Fine.findById(fine._id))!.status).toBe('paid')
    const expense = await Expense.findOne({ payrollId: draft!._id }).lean()
    expect(expense?.amount).toBe(2_800_000)
  })
})

describe('who may see payroll (§23, §14.2)', () => {
  it('refuses a Manager the payroll list but gives them their own payslip', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)

    await request(app).get('/api/v1/payroll').set(auth(manager.token)).expect(403)
    await request(app).get('/api/v1/payroll/me').set(auth(manager.token)).expect(200)
  })

  it('never shows an employee the payment ids behind their own figure', async () => {
    const { boss, teacher } = await scenario([500_000])
    await request(app)
      .post('/api/v1/payroll/schemes')
      .set(auth(boss.token))
      .send({ userId: teacher.id, scheme: 'percentage', share: 0.6 })
      .expect(200)
    await request(app)
      .post('/api/v1/payroll/calculate')
      .set(auth(boss.token))
      .send({ period: PERIOD })
      .expect(200)

    const draft = await Payroll.findOne({ userId: teacher.id })
    await request(app)
      .post(`/api/v1/payroll/${draft!.id}/approve`)
      .set(auth(boss.token))
      .expect(200)

    const mine = await request(app).get('/api/v1/payroll/me').set(auth(teacher.token)).expect(200)
    expect(mine.body.data).toHaveLength(1)
    // Those ids name other people's payments.
    expect(mine.body.data[0].basis.paymentIds).toBeUndefined()
  })
})

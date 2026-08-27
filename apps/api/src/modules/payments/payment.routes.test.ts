import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { User } from '../users/user.model.js'
import { Branch } from '../branches/branch.model.js'
import { Student } from '../students/student.model.js'
import { Group, Course, Room, Enrollment } from '../groups/group.model.js'
import { Invoice } from './invoice.model.js'
import { hashPassword } from '../auth/password.service.js'
import { generateSecret, generateTotp } from '../auth/totp.service.js'
import { encryptField } from '../../config/crypto.js'

let app: Express
const PASSWORD = 'Xorazm-2026-strong'

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

let phoneCounter = 0
const nextPhone = () => `+9989044${String(phoneCounter++).padStart(5, '0')}`
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function makeActor(role: string, branchId?: unknown) {
  const phone = nextPhone()
  const totpSecret = role === 'superadmin' ? generateSecret() : null

  await User.create({
    fullName: `${role} user`,
    phone,
    passwordHash: await hashPassword(PASSWORD),
    roles: [role === 'superadmin' ? { role } : { role, branchId }],
    ...(totpSecret
      ? { twoFactor: { enabled: true, secret: encryptField(totpSecret), confirmedAt: new Date() } }
      : {}),
  })

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({
      phone,
      password: PASSWORD,
      ...(totpSecret ? { totpCode: generateTotp(totpSecret) } : {}),
    })
    .expect(200)

  return { phone, token: response.body.data.accessToken as string }
}

describe('Debtors endpoints (§11.3 — /payments/debtors)', () => {
  it('allows superadmin and manager to view debtors with sums and contact info', async () => {
    const branch = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const boss = await makeActor('superadmin')
    const manager = await makeActor('manager', branch._id)
    const teacherUser = await User.create({
      fullName: 'Teacher Ustoz',
      phone: nextPhone(),
      passwordHash: await hashPassword(PASSWORD),
      roles: [{ role: 'teacher', branchId: branch._id }],
    })
    const teacher = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: teacherUser.phone, password: PASSWORD })
      .expect(200)
    const teacherToken = teacher.body.data.accessToken as string

    const course = await Course.create({ slug: 'english', name: { uz: 'Ingliz tili' }, defaultPrice: 600000 })
    const room = await Room.create({ branchId: branch._id, name: '1-xona', capacity: 15 })
    const group = await Group.create({
      branchId: branch._id,
      courseId: course._id,
      name: 'IELTS-1',
      teacherId: teacherUser._id,
      roomId: room._id,
      schedule: { pattern: 'toq', days: [1, 3, 5], startTime: '09:00', endTime: '10:30' },
      startDate: new Date('2026-01-01'),
      capacity: 12,
      price: 600000,
    })

    const student1 = await Student.create({
      branchId: branch._id,
      fullName: 'Alisher Navoiy',
      phone: '+998901111111',
      parentPhone: '+998902222222',
      monthlyFee: 600000,
      status: 'overdue',
    })
    const student2 = await Student.create({
      branchId: branch._id,
      fullName: 'Bobur Mirzo',
      phone: '+998903333333',
      parentPhone: '+998904444444',
      monthlyFee: 600000,
      status: 'overdue',
    })

    await Enrollment.create({ branchId: branch._id, studentId: student1._id, groupId: group._id, price: 600000 })
    await Enrollment.create({ branchId: branch._id, studentId: student2._id, groupId: group._id, price: 600000 })

    // Invoice 1: 0 paid, overdue by 15 days
    const pastDate = new Date(Date.now() - 15 * 24 * 3600 * 1000)
    await Invoice.create({
      branchId: branch._id,
      studentId: student1._id,
      groupId: group._id,
      period: '2026-08',
      amount: 600000,
      finalAmount: 600000,
      paidAmount: 0,
      dueDate: pastDate,
      status: 'overdue',
    })

    // Invoice 2: 200,000 paid out of 600,000, due in future
    const futureDate = new Date(Date.now() + 5 * 24 * 3600 * 1000)
    await Invoice.create({
      branchId: branch._id,
      studentId: student2._id,
      groupId: group._id,
      period: '2026-08',
      amount: 600000,
      finalAmount: 600000,
      paidAmount: 200000,
      dueDate: futureDate,
      status: 'partial',
    })

    // 1. Manager tests /payments/debtors
    const managerRes = await request(app)
      .get('/api/v1/payments/debtors')
      .set(auth(manager.token))
      .expect(200)

    expect(managerRes.body.data.total).toBe(2)
    expect(managerRes.body.data.totalDebt).toBe(1000000) // 600k + 400k
    expect(managerRes.body.data.items).toHaveLength(2)

    const row1 = managerRes.body.data.items.find((i: { studentName: string }) => i.studentName === 'Alisher Navoiy')
    expect(row1).toBeDefined()
    expect(row1.due).toBe(600000)
    expect(row1.daysOverdue).toBeGreaterThanOrEqual(14)
    expect(row1.phone).toBe('+998901111111')
    expect(row1.parentPhone).toBe('+998902222222')
    expect(row1.groupName).toBe('IELTS-1')

    const row2 = managerRes.body.data.items.find((i: { studentName: string }) => i.studentName === 'Bobur Mirzo')
    expect(row2).toBeDefined()
    expect(row2.due).toBe(400000)
    expect(row2.daysOverdue).toBe(0)

    // 2. Superadmin tests /payments/debtors
    const bossRes = await request(app)
      .get('/api/v1/payments/debtors')
      .set(auth(boss.token))
      .expect(200)
    expect(bossRes.body.data.total).toBe(2)
    expect(bossRes.body.data.totalDebt).toBe(1000000)

    // 3. Unpaid tab (/payments/debtors/unpaid) returns only student1 (paidAmount: 0)
    const unpaidRes = await request(app)
      .get('/api/v1/payments/debtors/unpaid')
      .set(auth(manager.token))
      .expect(200)
    expect(unpaidRes.body.data.total).toBe(1)
    expect(unpaidRes.body.data.items[0].studentName).toBe('Alisher Navoiy')
    expect(unpaidRes.body.data.items[0].due).toBe(600000)

    // 4. Overdue band filter minDaysOverdue=10 returns only student1 (15 days overdue)
    const bandRes = await request(app)
      .get('/api/v1/payments/debtors?minDaysOverdue=10')
      .set(auth(manager.token))
      .expect(200)
    expect(bandRes.body.data.total).toBe(1)
    expect(bandRes.body.data.items[0].studentName).toBe('Alisher Navoiy')

    // 5. Teacher tests /payments/debtors (gets hasDebt: true and no amount)
    const teacherRes = await request(app)
      .get('/api/v1/payments/debtors')
      .set(auth(teacherToken))
      .expect(200)
    expect(teacherRes.body.data.totalDebt).toBeUndefined()
    expect(teacherRes.body.data.items).toHaveLength(2)
    expect(teacherRes.body.data.items[0].hasDebt).toBe(true)
    expect(teacherRes.body.data.items[0].due).toBeUndefined()

    // Opening the debtors list recalculates overdue invoices and promotes the
    // student status to match — but never demotes it (see syncBillableStudentStatuses),
    // since listDebtors itself reads status === 'overdue' as its primary filter.
    const after = await Student.findById(student1._id)
    expect(after?.status).toBe('overdue')

    const stillFlagged = await Student.findById(student2._id)
    expect(stillFlagged?.status).toBe('overdue')
  })
})

/** A2 — the printable receipt; A5 — the ledger/balance drift report. */
describe('Accept payment → receipt (A2) and reconciliation (A5)', () => {
  it('accepts a payment, issues a downloadable PDF receipt, and reconciles clean', async () => {
    const branch = await Branch.create({ slug: 'fargona', name: { uz: "Farg'ona" } })
    const manager = await makeActor('manager', branch._id)
    const boss = await makeActor('superadmin')

    const course = await Course.create({ slug: 'math', name: { uz: 'Matematika' }, defaultPrice: 500000 })
    const teacherUser = await User.create({
      fullName: 'Teacher Two',
      phone: nextPhone(),
      passwordHash: await hashPassword(PASSWORD),
      roles: [{ role: 'teacher', branchId: branch._id }],
    })
    const room = await Room.create({ branchId: branch._id, name: '2-xona', capacity: 10 })
    const group = await Group.create({
      branchId: branch._id,
      courseId: course._id,
      name: 'Math-1',
      teacherId: teacherUser._id,
      roomId: room._id,
      schedule: { pattern: 'toq', days: [2, 4], startTime: '10:00', endTime: '11:30' },
      startDate: new Date('2026-01-01'),
      capacity: 10,
      price: 500000,
    })

    const student = await Student.create({
      branchId: branch._id,
      fullName: 'Kamola Rashidova',
      phone: '+998906666666',
      monthlyFee: 500000,
      status: 'active',
    })
    await Enrollment.create({ branchId: branch._id, studentId: student._id, groupId: group._id, price: 500000 })

    const invoice = await Invoice.create({
      branchId: branch._id,
      studentId: student._id,
      groupId: group._id,
      period: '2026-08',
      amount: 500000,
      finalAmount: 500000,
      paidAmount: 0,
      dueDate: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      status: 'pending',
    })

    // Partial payment (A3 — 300,000 of 500,000, 200,000 remaining).
    const acceptRes = await request(app)
      .post('/api/v1/payments')
      .set(auth(manager.token))
      .send({ studentId: student._id, invoiceId: invoice._id, amount: 300000, method: 'naqd' })
      .expect(201)

    const paymentId = acceptRes.body.data.payment._id as string
    expect(acceptRes.body.data.payment.receiptNo).toBeTruthy()

    const updatedInvoice = await Invoice.findById(invoice._id)
    expect(updatedInvoice?.paidAmount).toBe(300000)
    expect(updatedInvoice?.status).toBe('partial')

    const receiptRes = await request(app)
      .get(`/api/v1/payments/${paymentId}/receipt.pdf`)
      .set(auth(manager.token))
      .expect(200)
    expect(receiptRes.headers['content-type']).toContain('application/pdf')
    expect(receiptRes.headers['content-disposition']).toContain('.pdf')

    // A5 — the ledger and balance agree with no manual entry involved.
    const reconcileRes = await request(app)
      .get('/api/v1/payments/reconcile')
      .set(auth(boss.token))
      .expect(200)
    expect(reconcileRes.body.data.driftCount).toBe(0)

    // A manager outside the current month cannot refund; superadmin can.
    const refundRes = await request(app)
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set(auth(boss.token))
      .send({ reason: "Ortiqcha to'lov qaytarildi", amount: 100000 })
      .expect(201)
    expect(refundRes.body.data.amount).toBe(-100000)

    const afterRefundInvoice = await Invoice.findById(invoice._id)
    expect(afterRefundInvoice?.paidAmount).toBe(200000)

    const reconcileAfterRefund = await request(app)
      .get('/api/v1/payments/reconcile')
      .set(auth(boss.token))
      .expect(200)
    expect(reconcileAfterRefund.body.data.driftCount).toBe(0)
  })
})

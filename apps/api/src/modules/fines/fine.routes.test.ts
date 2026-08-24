import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { makeBranch, makeActor, auth, selectBranch } from '../../test/actors.js'
import { Fine } from './fine.model.js'
import { Student } from '../students/student.model.js'
import { AuditLog } from '../audit/audit.model.js'

/**
 * TZ §12 — `jarima`.
 *
 * §12.4 is the part worth pinning down: a fine is cancelled, never deleted, and
 * always with a reason; a fine already charged cannot be cancelled at all; and
 * the person fined can appeal their own fine and nobody else's.
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

const REASON = 'Uch marta darsga kech qoldi'

describe('POST /fines', () => {
  it('lets the boss fine a student, and audits it (§21.3)', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const student = await Student.create({
      branchId: branch._id,
      fullName: 'Aziz Tursunov',
      status: 'active',
      monthlyFee: 700_000,
    })

    const response = await request(app)
      .post('/api/v1/fines')
      .set(auth(boss.token))
      .send({ targetType: 'student', targetId: student.id, amount: 50_000, reason: REASON })
      .expect(201)

    // A student fine lands on an invoice; an employee fine on a payslip.
    expect(response.body.data.appliedTo).toBe('invoice')
    expect(response.body.data.status).toBe('issued')
    expect(await AuditLog.countDocuments({ action: 'fine.issue' })).toBe(1)
  })

  it('routes an employee fine to payroll by default', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    const teacher = await makeActor(app, 'teacher', branch._id)
    await selectBranch(app, boss.token, branch.id)

    const response = await request(app)
      .post('/api/v1/fines')
      .set(auth(boss.token))
      .send({ targetType: 'employee', targetId: teacher.id, amount: 50_000, reason: REASON })
      .expect(201)

    expect(response.body.data.appliedTo).toBe('payroll')
  })

  it('refuses a fine against an id that does not exist', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)

    await request(app)
      .post('/api/v1/fines')
      .set(auth(boss.token))
      .send({
        targetType: 'student',
        targetId: '6a85645d86d8a9e7be911943',
        amount: 50_000,
        reason: REASON,
      })
      .expect(400)
  })

  it('refuses a Manager — §4.2 gives fine.issue to the boss alone', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)
    const student = await Student.create({
      branchId: branch._id,
      fullName: 'Aziz Tursunov',
      status: 'active',
      monthlyFee: 700_000,
    })

    await request(app)
      .post('/api/v1/fines')
      .set(auth(manager.token))
      .send({ targetType: 'student', targetId: student.id, amount: 50_000, reason: REASON })
      .expect(403)
  })

  it('rejects a reason too short to act on later', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const student = await Student.create({
      branchId: branch._id,
      fullName: 'Aziz Tursunov',
      status: 'active',
      monthlyFee: 700_000,
    })

    const response = await request(app)
      .post('/api/v1/fines')
      .set(auth(boss.token))
      .send({ targetType: 'student', targetId: student.id, amount: 50_000, reason: 'kech' })
      .expect(400)

    expect(response.body.error.details.reason).toContain('reasonTooShort')
  })
})

describe('cancelling and appealing (§12.4)', () => {
  it('cancels without deleting, and keeps the reason', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const teacher = await makeActor(app, 'teacher', branch._id)

    const fine = await Fine.create({
      branchId: branch._id,
      targetType: 'employee',
      targetId: teacher.id,
      amount: 50_000,
      reason: REASON,
      status: 'issued',
    })

    await request(app)
      .post(`/api/v1/fines/${fine.id}/cancel`)
      .set(auth(boss.token))
      .send({ reason: 'Sabab asossiz edi' })
      .expect(200)

    const after = await Fine.findById(fine._id)
    // The record survives — "issued then withdrawn" is a different fact from
    // "never happened", and an appeal is about the first one.
    expect(after).toBeTruthy()
    expect(after!.status).toBe('cancelled')
    expect(after!.cancelledReason).toBe('Sabab asossiz edi')
  })

  it('refuses to cancel a fine that has already been charged', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const teacher = await makeActor(app, 'teacher', branch._id)

    const fine = await Fine.create({
      branchId: branch._id,
      targetType: 'employee',
      targetId: teacher.id,
      amount: 50_000,
      reason: REASON,
      status: 'issued',
      appliedAt: new Date(),
    })

    const refused = await request(app)
      .post(`/api/v1/fines/${fine.id}/cancel`)
      .set(auth(boss.token))
      .send({ reason: 'Kech bo‘ldi' })
      .expect(409)

    expect(refused.body.error.code).toBe('CONFLICT')
  })

  it('lets the person fined appeal their own fine, and nobody else theirs', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const teacher = await makeActor(app, 'teacher', branch._id)
    const other = await makeActor(app, 'teacher', branch._id)

    const fine = await Fine.create({
      branchId: branch._id,
      targetType: 'employee',
      targetId: teacher.id,
      amount: 50_000,
      reason: REASON,
      status: 'issued',
    })

    await request(app)
      .post(`/api/v1/fines/${fine.id}/appeal`)
      .set(auth(other.token))
      .send({ reason: 'Bu men emasman' })
      .expect(403)

    await request(app)
      .post(`/api/v1/fines/${fine.id}/appeal`)
      .set(auth(teacher.token))
      .send({ reason: 'Kasal edim, spravka bor' })
      .expect(200)

    expect((await Fine.findById(fine._id))!.status).toBe('appealed')
  })

  it('lets the boss waive an appealed fine', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const teacher = await makeActor(app, 'teacher', branch._id)

    const fine = await Fine.create({
      branchId: branch._id,
      targetType: 'employee',
      targetId: teacher.id,
      amount: 50_000,
      reason: REASON,
      status: 'appealed',
      appeal: { at: new Date(), by: teacher.id, text: 'Kasal edim' },
    })

    await request(app)
      .post(`/api/v1/fines/${fine.id}/appeal/decide`)
      .set(auth(boss.token))
      .send({ outcome: 'waived', reason: 'Spravka ko‘rsatildi' })
      .expect(200)

    const after = await Fine.findById(fine._id)
    expect(after!.status).toBe('waived')
    expect(after!.appeal?.outcome).toBe('waived')
  })
})

describe('GET /fines?mine=true — everyone sees their own (§4.2 fine.viewOwn)', () => {
  it('shows a teacher their own fines without the issuing grant', async () => {
    const branch = await makeBranch()
    const teacher = await makeActor(app, 'teacher', branch._id)
    const other = await makeActor(app, 'teacher', branch._id)

    await Fine.create({
      branchId: branch._id,
      targetType: 'employee',
      targetId: teacher.id,
      amount: 50_000,
      reason: REASON,
      status: 'issued',
    })
    await Fine.create({
      branchId: branch._id,
      targetType: 'employee',
      targetId: other.id,
      amount: 90_000,
      reason: REASON,
      status: 'issued',
    })

    // Without `mine`, a teacher has no business reading the list at all.
    await request(app).get('/api/v1/fines').set(auth(teacher.token)).expect(403)

    const mine = await request(app)
      .get('/api/v1/fines?mine=true')
      .set(auth(teacher.token))
      .expect(200)

    expect(mine.body.data.total).toBe(1)
    expect(mine.body.data.items[0].amount).toBe(50_000)
  })
})

describe('/fine-rules — superadmin only (§4.2)', () => {
  it('creates a rule that starts switched off (§12)', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)

    const response = await request(app)
      .post('/api/v1/fine-rules')
      .set(auth(boss.token))
      .send({
        name: { uz: 'Kechikish' },
        targetType: 'student',
        trigger: 'late_payment',
        amount: 20_000,
      })
      .expect(201)

    // "Nothing fires automatically unless the SuperAdmin enables it."
    expect(response.body.data.isActive).toBe(false)
  })

  it('refuses a Manager outright', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)
    await request(app).get('/api/v1/fine-rules').set(auth(manager.token)).expect(403)
  })
})

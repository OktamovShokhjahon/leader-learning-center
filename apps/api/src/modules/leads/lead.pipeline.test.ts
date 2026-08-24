import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { makeBranch, makeActor, auth, selectBranch } from '../../test/actors.js'
import { Lead } from './lead.model.js'
import { Student } from '../students/student.model.js'
import { User } from '../users/user.model.js'
import { Course, Group, Enrollment } from '../groups/group.model.js'

/**
 * TZ §7.2 — the lead pipeline's write side.
 *
 * Conversion is the case that matters: it writes a Student, sometimes an
 * Enrollment and sometimes a User, so it has to be idempotent. A double-clicked
 * Convert button is the ordinary case, and two student records for one child is
 * a mess only a human can unpick.
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

async function makeLead(branchId: unknown, phone = '+998901112233') {
  return Lead.create({
    branchId,
    fullName: 'Dilnoza Rahimova',
    phone,
    // The public form always supplies both slugs, so the model requires them.
    courseSlug: 'general-english',
    branchSlug: 'urganch-markaz',
    status: 'yangi',
    source: 'instagram',
    history: [{ at: new Date(), action: 'created' }],
  })
}

describe('PATCH /leads/:id', () => {
  it('moves a lead through the funnel and appends to its history', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)
    const lead = await makeLead(branch._id)

    await request(app)
      .patch(`/api/v1/leads/${lead.id}`)
      .set(auth(manager.token))
      .send({ status: 'boglanildi' })
      .expect(200)

    const after = await Lead.findById(lead._id)
    expect(after!.status).toBe('boglanildi')
    // §20 Sales computes time-to-first-contact from this trail, so it has to grow.
    expect(after!.history).toHaveLength(2)
    expect(after!.history[1]!.action).toBe('status:boglanildi')
  })

  it('refuses a refusal with no reason — the churn report needs one', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)
    const lead = await makeLead(branch._id)

    await request(app)
      .patch(`/api/v1/leads/${lead.id}`)
      .set(auth(manager.token))
      .send({ status: 'rad_etdi' })
      .expect(400)

    await request(app)
      .patch(`/api/v1/leads/${lead.id}`)
      .set(auth(manager.token))
      .send({ status: 'rad_etdi', rejectReason: 'Narx qimmat' })
      .expect(200)
  })

  it('refuses to reach "became a student" by dragging a card', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)
    const lead = await makeLead(branch._id)

    // Conversion writes a Student, so it has its own endpoint.
    await request(app)
      .patch(`/api/v1/leads/${lead.id}`)
      .set(auth(manager.token))
      .send({ status: 'oquvchi_boldi' })
      .expect(400)
  })

  it('refuses a Teacher the pipeline entirely', async () => {
    const branch = await makeBranch()
    const teacher = await makeActor(app, 'teacher', branch._id)
    const lead = await makeLead(branch._id)

    await request(app).get('/api/v1/leads').set(auth(teacher.token)).expect(403)
    await request(app)
      .patch(`/api/v1/leads/${lead.id}`)
      .set(auth(teacher.token))
      .send({ status: 'boglanildi' })
      .expect(403)
  })
})

describe('POST /leads/:id/trial', () => {
  it('books the trial lesson and moves the stage with it', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)
    const lead = await makeLead(branch._id)

    await request(app)
      .post(`/api/v1/leads/${lead.id}/trial`)
      .set(auth(manager.token))
      .send({ at: new Date('2026-09-01T09:00:00Z').toISOString() })
      .expect(200)

    const after = await Lead.findById(lead._id)
    expect(after!.status).toBe('sinov_darsiga_yozildi')
    expect(after!.nextActionAt).toBeTruthy()
  })
})

describe('POST /leads/:id/convert', () => {
  it('creates a student, enrols them, and opens a login when asked', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    const teacher = await makeActor(app, 'teacher', branch._id)
    await selectBranch(app, boss.token, branch.id)
    const lead = await makeLead(branch._id)

    const course = await Course.create({ slug: 'ge', name: { uz: 'GE' }, defaultPrice: 700_000 })
    const group = await Group.create({
      branchId: branch._id,
      courseId: course._id,
      name: 'GE-A2',
      teacherId: teacher.id,
      schedule: { pattern: 'juft', days: [2, 4, 6], startTime: '09:00', endTime: '10:30' },
      startDate: new Date(),
      capacity: 12,
      price: 700_000,
      status: 'active',
    })

    const response = await request(app)
      .post(`/api/v1/leads/${lead.id}/convert`)
      .set(auth(boss.token))
      .send({ groupId: group.id, createLogin: true, password: 'Xorazm-2026-strong' })
      .expect(201)

    expect(response.body.data.replayed).toBe(false)

    const student = await Student.findOne({ phone: lead.phone })
    expect(student).toBeTruthy()
    expect(student!.monthlyFee).toBe(700_000)
    expect(await Enrollment.countDocuments({ studentId: student!._id, status: 'active' })).toBe(1)

    // The login exists and is linked back to the student record (§10.2).
    const account = await User.findOne({ phone: lead.phone })
    expect(account).toBeTruthy()
    expect(student!.userId?.toString()).toBe(account!.id)
    expect(account!.mustChangePassword).toBe(false)

    expect((await Lead.findById(lead._id))!.status).toBe('oquvchi_boldi')
  })

  it('replays instead of minting a second student', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const lead = await makeLead(branch._id)

    await request(app)
      .post(`/api/v1/leads/${lead.id}/convert`)
      .set(auth(boss.token))
      .send({ createLogin: false })
      .expect(201)

    const replay = await request(app)
      .post(`/api/v1/leads/${lead.id}/convert`)
      .set(auth(boss.token))
      .send({ createLogin: false })
      .expect(200)

    expect(replay.body.data.replayed).toBe(true)
    expect(await Student.countDocuments({ phone: lead.phone })).toBe(1)
  })

  it('links to an existing student with the same phone rather than duplicating', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)

    const existing = await Student.create({
      branchId: branch._id,
      fullName: 'Dilnoza Rahimova',
      phone: '+998901112233',
      status: 'active',
      monthlyFee: 700_000,
    })
    const lead = await makeLead(branch._id, '+998901112233')

    const response = await request(app)
      .post(`/api/v1/leads/${lead.id}/convert`)
      .set(auth(boss.token))
      .send({ createLogin: false })
      .expect(200)

    expect(response.body.data.replayed).toBe(true)
    expect(await Student.countDocuments({})).toBe(1)
    expect((await Lead.findById(lead._id))!.convertedStudentId?.toString()).toBe(existing.id)
  })
})

describe('GET /leads/report — §20 Sales', () => {
  it('reports conversion and time to first contact', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)

    const contacted = await makeLead(branch._id, '+998901112233')
    await makeLead(branch._id, '+998901112244')

    await request(app)
      .patch(`/api/v1/leads/${contacted.id}`)
      .set(auth(manager.token))
      .send({ status: 'boglanildi' })
      .expect(200)

    const report = await request(app)
      .get('/api/v1/leads/report')
      .set(auth(manager.token))
      .expect(200)

    expect(report.body.data.total).toBe(2)
    expect(report.body.data.converted).toBe(0)
    expect(report.body.data.conversionRate).toBe(0)
    expect(report.body.data.medianHoursToContact).not.toBeNull()
  })
})

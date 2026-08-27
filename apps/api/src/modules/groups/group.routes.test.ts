import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { User } from '../users/user.model.js'
import { Branch } from '../branches/branch.model.js'
import { Student } from '../students/student.model.js'
import { Group, Course, Room, Enrollment, Lesson, Attendance } from './group.model.js'
import { hashPassword } from '../auth/password.service.js'

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
const nextPhone = () => `+9989066${String(phoneCounter++).padStart(5, '0')}`
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function makeActor(role: string, branchId?: unknown) {
  const phone = nextPhone()
  await User.create({
    fullName: `${role} user`,
    phone,
    passwordHash: await hashPassword(PASSWORD),
    roles: [role === 'superadmin' ? { role } : { role, branchId }],
  })
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone, password: PASSWORD })
    .expect(200)
  return { phone, token: response.body.data.accessToken as string }
}

/** B1 — attendance grid data: history filtering and the shared rate aggregation. */
describe('Attendance history and rate (B1/H1)', () => {
  it('filters /attendance/history by the lesson date, not by when it was marked', async () => {
    const branch = await Branch.create({ slug: 'jizzax', name: { uz: 'Jizzax' } })
    const manager = await makeActor('manager', branch._id)
    const teacherUser = await User.create({
      fullName: 'Teacher Attendance',
      phone: nextPhone(),
      passwordHash: await hashPassword(PASSWORD),
      roles: [{ role: 'teacher', branchId: branch._id }],
    })

    const course = await Course.create({ slug: 'physics', name: { uz: 'Fizika' }, defaultPrice: 400000 })
    const room = await Room.create({ branchId: branch._id, name: '3-xona', capacity: 10 })
    const group = await Group.create({
      branchId: branch._id,
      courseId: course._id,
      name: 'Physics-1',
      teacherId: teacherUser._id,
      roomId: room._id,
      schedule: { pattern: 'toq', days: [1, 3], startTime: '08:00', endTime: '09:30' },
      startDate: new Date('2026-01-01'),
      capacity: 10,
      price: 400000,
    })

    const student = await Student.create({
      branchId: branch._id,
      fullName: 'Aziza Karimova',
      phone: '+998907777777',
      monthlyFee: 400000,
      status: 'active',
    })
    await Enrollment.create({ branchId: branch._id, studentId: student._id, groupId: group._id, price: 400000 })

    // One lesson inside the query window (today, so marking it stays within
    // the 48h edit window a Manager is allowed), one well outside it.
    const today = new Date()
    const rangeStart = new Date(today.getTime() - 7 * 24 * 3600 * 1000)
    const rangeEnd = new Date(today.getTime() + 7 * 24 * 3600 * 1000)
    const inRangeLesson = await Lesson.create({
      branchId: branch._id,
      groupId: group._id,
      date: today,
      status: 'planned',
    })
    const outOfRangeLesson = await Lesson.create({
      branchId: branch._id,
      groupId: group._id,
      date: new Date(today.getTime() - 60 * 24 * 3600 * 1000),
      status: 'planned',
    })

    // Mark the in-range lesson through the real endpoint so `markedAt` follows
    // the actual write path (present by default per §10.1).
    await request(app)
      .post('/api/v1/groups/attendance')
      .set(auth(manager.token))
      .send({
        lessonId: inRangeLesson._id,
        entries: [{ studentId: student._id, status: 'present' }],
      })
      .expect(200)

    // The out-of-range lesson is marked `absent` directly, bypassing the API,
    // to isolate the filter under test from the write path.
    await Attendance.create({
      branchId: branch._id,
      lessonId: outOfRangeLesson._id,
      studentId: student._id,
      groupId: group._id,
      status: 'absent',
    })

    const historyRes = await request(app)
      .get(
        `/api/v1/groups/attendance/history?studentId=${student._id}&from=${rangeStart.toISOString().slice(0, 10)}&to=${rangeEnd.toISOString().slice(0, 10)}`,
      )
      .set(auth(manager.token))
      .expect(200)

    expect(historyRes.body.data).toHaveLength(1)
    expect(historyRes.body.data[0].status).toBe('present')
    expect(historyRes.body.data[0].lessonId._id).toBe(inRangeLesson._id.toString())
  })

  it('computes attendance rate counting present/late/excused, not just present', async () => {
    const branch = await Branch.create({ slug: 'termiz', name: { uz: 'Termiz' } })
    const manager = await makeActor('manager', branch._id)
    const teacherUser = await User.create({
      fullName: 'Teacher Rate',
      phone: nextPhone(),
      passwordHash: await hashPassword(PASSWORD),
      roles: [{ role: 'teacher', branchId: branch._id }],
    })
    const course = await Course.create({ slug: 'chemistry', name: { uz: 'Kimyo' }, defaultPrice: 400000 })
    const group = await Group.create({
      branchId: branch._id,
      courseId: course._id,
      name: 'Chemistry-1',
      teacherId: teacherUser._id,
      schedule: { pattern: 'toq', days: [2, 4], startTime: '11:00', endTime: '12:30' },
      startDate: new Date('2026-01-01'),
      price: 400000,
    })
    const student = await Student.create({
      branchId: branch._id,
      fullName: 'Bekzod Toshev',
      status: 'active',
    })

    const statuses = ['present', 'present', 'absent', 'late', 'excused'] as const
    for (const [index, status] of statuses.entries()) {
      const lesson = await Lesson.create({
        branchId: branch._id,
        groupId: group._id,
        date: new Date(2026, 7, index + 1),
        status: 'held',
      })
      await Attendance.create({
        branchId: branch._id,
        lessonId: lesson._id,
        studentId: student._id,
        groupId: group._id,
        status,
      })
    }

    const rateRes = await request(app)
      .get(`/api/v1/groups/attendance/rate?studentId=${student._id}`)
      .set(auth(manager.token))
      .expect(200)

    // 4 of 5 count toward the rate (only the flat absence does not) → 80%.
    expect(rateRes.body.data.total).toBe(5)
    expect(rateRes.body.data.absent).toBe(1)
    expect(rateRes.body.data.rate).toBe(80)
  })
})

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { User } from '../users/user.model.js'
import { Branch } from '../branches/branch.model.js'
import { Student } from '../students/student.model.js'
import { Group, Course, Enrollment, Lesson } from '../groups/group.model.js'
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
const nextPhone = () => `+9989077${String(phoneCounter++).padStart(5, '0')}`
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function makeActor(role: string, branchId?: unknown) {
  const phone = nextPhone()
  const user = await User.create({
    fullName: `${role} user`,
    phone,
    passwordHash: await hashPassword(PASSWORD),
    roles: [role === 'superadmin' ? { role } : { role, branchId }],
  })
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone, password: PASSWORD })
    .expect(200)
  return { phone, token: response.body.data.accessToken as string, user }
}

/** C — Grading ("Baho"): the teacher's per-lesson panel and the student's average. */
describe('Grading (C1/C2)', () => {
  it('grades a lesson for the whole group and reports a student average', async () => {
    const branch = await Branch.create({ slug: 'samarqand', name: { uz: 'Samarqand' } })
    const { token: teacherToken, user: teacherUser } = await makeActor('teacher', branch._id)

    const course = await Course.create({ slug: 'algebra', name: { uz: 'Algebra' }, defaultPrice: 350000 })
    const group = await Group.create({
      branchId: branch._id,
      courseId: course._id,
      name: 'Algebra-1',
      teacherId: teacherUser._id,
      schedule: { pattern: 'toq', days: [1, 3], startTime: '09:00', endTime: '10:30' },
      startDate: new Date('2026-01-01'),
      price: 350000,
    })

    const student1 = await Student.create({ branchId: branch._id, fullName: 'Diyora Rasulova', status: 'active' })
    const student2 = await Student.create({ branchId: branch._id, fullName: 'Jasur Nematov', status: 'active' })
    await Enrollment.create({ branchId: branch._id, studentId: student1._id, groupId: group._id, price: 350000 })
    await Enrollment.create({ branchId: branch._id, studentId: student2._id, groupId: group._id, price: 350000 })

    const lesson = await Lesson.create({
      branchId: branch._id,
      groupId: group._id,
      date: new Date(),
      status: 'planned',
    })

    // C1 — clicking a date opens the roster for that lesson.
    const rosterRes = await request(app)
      .get(`/api/v1/grades/roster?groupId=${group._id}&date=${lesson.date.toISOString().slice(0, 10)}`)
      .set(auth(teacherToken))
      .expect(200)
    expect(rosterRes.body.data.students).toHaveLength(2)
    expect(rosterRes.body.data.students[0].value).toBeNull()

    // C1 — bulk save the whole group in one request.
    await request(app)
      .post('/api/v1/grades')
      .set(auth(teacherToken))
      .send({
        lessonId: lesson._id,
        entries: [
          { studentId: student1._id, value: 5, comment: "A'lo" },
          { studentId: student2._id, value: 3 },
        ],
      })
      .expect(200)

    const secondLesson = await Lesson.create({
      branchId: branch._id,
      groupId: group._id,
      date: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      status: 'planned',
    })
    await request(app)
      .post('/api/v1/grades')
      .set(auth(teacherToken))
      .send({ lessonId: secondLesson._id, entries: [{ studentId: student1._id, value: 3 }] })
      .expect(200)

    // C2 — the student's average is computed once, server-side: (5 + 3) / 2 = 4.
    const averageRes = await request(app)
      .get(`/api/v1/grades/average?studentId=${student1._id}`)
      .set(auth(teacherToken))
      .expect(200)
    expect(averageRes.body.data.overall).toBe(4)
    expect(averageRes.body.data.byGroup).toHaveLength(1)
    expect(averageRes.body.data.byGroup[0].average).toBe(4)

    const historyRes = await request(app)
      .get(`/api/v1/grades/history?studentId=${student1._id}`)
      .set(auth(teacherToken))
      .expect(200)
    expect(historyRes.body.data).toHaveLength(2)
  })

  it('refuses a teacher grading a group that is not theirs', async () => {
    const branch = await Branch.create({ slug: 'nukus', name: { uz: 'Nukus' } })
    const { user: ownerTeacher } = await makeActor('teacher', branch._id)
    const { token: outsiderToken } = await makeActor('teacher', branch._id)

    const course = await Course.create({ slug: 'biology', name: { uz: 'Biologiya' }, defaultPrice: 300000 })
    const group = await Group.create({
      branchId: branch._id,
      courseId: course._id,
      name: 'Biology-1',
      teacherId: ownerTeacher._id,
      schedule: { pattern: 'toq', days: [2, 4], startTime: '09:00', endTime: '10:30' },
      startDate: new Date('2026-01-01'),
      price: 300000,
    })
    const student = await Student.create({ branchId: branch._id, fullName: 'Test Student', status: 'active' })
    const lesson = await Lesson.create({ branchId: branch._id, groupId: group._id, date: new Date(), status: 'planned' })

    await request(app)
      .post('/api/v1/grades')
      .set(auth(outsiderToken))
      .send({ lessonId: lesson._id, entries: [{ studentId: student._id, value: 4 }] })
      .expect(403)
  })
})

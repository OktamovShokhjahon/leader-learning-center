import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { User } from '../users/user.model.js'
import { Branch } from '../branches/branch.model.js'
import { Student } from '../students/student.model.js'
import { Group, Course, Enrollment } from '../groups/group.model.js'
import { VideoLesson } from './content.model.js'
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
const nextPhone = () => `+9989088${String(phoneCounter++).padStart(5, '0')}`
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

/** D1 — per-group access control; D2 — one uploaded video, referenced by several lessons. */
describe('Video lesson access control (D1) and video reuse (D2)', () => {
  it('grants access by group, not merely by course, and always shows free lessons', async () => {
    const branch = await Branch.create({ slug: 'qarshi', name: { uz: 'Qarshi' } })
    const boss = await makeActor('superadmin')
    const teacherUser = await User.create({
      fullName: 'Teacher Content',
      phone: nextPhone(),
      passwordHash: await hashPassword(PASSWORD),
      roles: [{ role: 'teacher', branchId: branch._id }],
    })

    const course = await Course.create({ slug: 'ielts', name: { uz: 'IELTS' }, defaultPrice: 500000 })
    const groupA = await Group.create({
      branchId: branch._id,
      courseId: course._id,
      name: 'IELTS-A',
      teacherId: teacherUser._id,
      schedule: { pattern: 'toq', days: [1, 3], startTime: '09:00', endTime: '10:30' },
      startDate: new Date('2026-01-01'),
      price: 500000,
    })
    const groupB = await Group.create({
      branchId: branch._id,
      courseId: course._id,
      name: 'IELTS-B',
      teacherId: teacherUser._id,
      schedule: { pattern: 'juft', days: [2, 4], startTime: '09:00', endTime: '10:30' },
      startDate: new Date('2026-01-01'),
      price: 500000,
    })

    // Two students on the SAME course, but different groups.
    const studentAUser = await User.create({
      fullName: 'Student A',
      phone: nextPhone(),
      passwordHash: await hashPassword(PASSWORD),
      roles: [{ role: 'student', branchId: branch._id }],
    })
    const studentA = await Student.create({
      branchId: branch._id,
      fullName: 'Student A',
      userId: studentAUser._id,
      status: 'active',
    })
    await Enrollment.create({ branchId: branch._id, studentId: studentA._id, groupId: groupA._id, price: 500000 })

    const studentBUser = await User.create({
      fullName: 'Student B',
      phone: nextPhone(),
      passwordHash: await hashPassword(PASSWORD),
      roles: [{ role: 'student', branchId: branch._id }],
    })
    const studentB = await Student.create({
      branchId: branch._id,
      fullName: 'Student B',
      userId: studentBUser._id,
      status: 'active',
    })
    await Enrollment.create({ branchId: branch._id, studentId: studentB._id, groupId: groupB._id, price: 500000 })

    const gatedLesson = await VideoLesson.create({
      courseId: course._id,
      title: { uz: 'Reading strategiyalari' },
      provider: 'youtube',
      videoId: 'abc123XYZ_',
      isPublished: true,
      isFree: false,
      groupIds: [groupA._id],
    })
    const freeLesson = await VideoLesson.create({
      courseId: course._id,
      title: { uz: 'Kirish darsi' },
      provider: 'youtube',
      videoId: 'freeVideo01',
      isPublished: true,
      isFree: true,
      groupIds: [],
    })

    const studentALogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: studentAUser.phone, password: PASSWORD })
      .expect(200)
    const studentBLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: studentBUser.phone, password: PASSWORD })
      .expect(200)

    const aRes = await request(app)
      .get('/api/v1/content/lessons/mine')
      .set(auth(studentALogin.body.data.accessToken))
      .expect(200)
    const aIds = aRes.body.data.map((l: { _id: string }) => l._id)
    expect(aIds).toContain(gatedLesson._id.toString())
    expect(aIds).toContain(freeLesson._id.toString())

    // Student B shares the course but not the granted group — no access to
    // the gated lesson, but the free one is always visible.
    const bRes = await request(app)
      .get('/api/v1/content/lessons/mine')
      .set(auth(studentBLogin.body.data.accessToken))
      .expect(200)
    const bIds = bRes.body.data.map((l: { _id: string }) => l._id)
    expect(bIds).not.toContain(gatedLesson._id.toString())
    expect(bIds).toContain(freeLesson._id.toString())

    // D2 — the same uploaded file, referenced by a second lesson, shows up
    // once in the reuse picker with a usedBy count of 2.
    await VideoLesson.create({
      courseId: course._id,
      title: { uz: 'Speaking darsi 1' },
      provider: 'file',
      videoId: '/uploads/shared-video.mp4',
      isPublished: true,
      groupIds: [groupA._id],
    })
    await VideoLesson.create({
      courseId: course._id,
      title: { uz: 'Speaking darsi 2 (boshqa guruh uchun)' },
      provider: 'file',
      videoId: '/uploads/shared-video.mp4',
      isPublished: true,
      groupIds: [groupB._id],
    })

    const videosRes = await request(app)
      .get('/api/v1/content/lessons/videos')
      .set(auth(boss.token))
      .expect(200)
    const shared = videosRes.body.data.find((v: { videoId: string }) => v.videoId === '/uploads/shared-video.mp4')
    expect(shared.usedBy).toBe(2)
  })
})

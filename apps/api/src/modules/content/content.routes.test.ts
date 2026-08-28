import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { User } from '../users/user.model.js'
import { Branch } from '../branches/branch.model.js'
import { Student } from '../students/student.model.js'
import { Group, Course, Enrollment } from '../groups/group.model.js'
import { VideoLesson, TeacherProfile } from './content.model.js'
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

/**
 * The teacher card and the teacher's login are opened in one act (§21.1 +
 * §23), so a teacher can no longer exist as a login with no face on the site.
 */
describe('Teacher profiles — the card and the login', () => {
  const card = (slug: string) => ({
    slug,
    fullName: 'Aziza Yusupova',
    role: { uz: 'IELTS o‘qituvchisi' },
    subjects: ['ielts'],
    experienceYears: 7,
    photo: '/uploads/aziza.jpg',
    isPublic: true,
    order: 1,
  })

  it('opens the teacher login alongside the card, and links the two', async () => {
    const branch = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const boss = await makeActor('superadmin')
    const phone = nextPhone()

    const created = await request(app)
      .post('/api/v1/content/teachers')
      .set(auth(boss.token))
      .send({
        ...card('aziza-yusupova'),
        account: { phone, password: PASSWORD, branchId: String(branch._id) },
      })
      .expect(201)

    expect(created.body.data.userId).toBeTruthy()
    // A teacher opened with a branch belongs on that branch's page (§6.2).
    expect(created.body.data.branchIds).toEqual([String(branch._id)])

    const account = await User.findById(created.body.data.userId)
    expect(account?.phone).toBe(phone)
    expect(account?.roles.map((assignment) => assignment.role)).toEqual(['teacher'])
    expect(account?.photo).toBe('/uploads/aziza.jpg')

    // The login works, which is the whole point of opening it here.
    await request(app).post('/api/v1/auth/login').send({ phone, password: PASSWORD }).expect(200)

    // And the roster carries the login next to the card.
    const list = await request(app)
      .get('/api/v1/content/teachers')
      .set(auth(boss.token))
      .expect(200)
    expect(list.body.data.items[0].userId.phone).toBe(phone)
    expect(list.body.data.items[0].userId.isActive).toBe(true)
  })

  it('puts the card on the public endpoint, photo and all', async () => {
    const branch = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const boss = await makeActor('superadmin')

    await request(app)
      .post('/api/v1/content/teachers')
      .set(auth(boss.token))
      .send({
        ...card('aziza-yusupova'),
        account: { phone: nextPhone(), password: PASSWORD, branchId: String(branch._id) },
      })
      .expect(201)

    const published = await request(app).get('/api/v1/public/teachers').expect(200)
    expect(published.body.data).toHaveLength(1)
    expect(published.body.data[0].photo).toBe('/uploads/aziza.jpg')
    // §23 — the public shape never maps a face onto an internal account.
    expect(published.body.data[0].userId).toBeUndefined()
  })

  it('leaves no login behind when the slug is already taken', async () => {
    const branch = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const boss = await makeActor('superadmin')
    await TeacherProfile.create(card('aziza-yusupova'))
    const before = await User.countDocuments({})

    await request(app)
      .post('/api/v1/content/teachers')
      .set(auth(boss.token))
      .send({
        ...card('aziza-yusupova'),
        account: { phone: nextPhone(), password: PASSWORD, branchId: String(branch._id) },
      })
      .expect(409)

    expect(await User.countDocuments({})).toBe(before)
  })

  it('gives a card that was published without a login one later, and refuses a second', async () => {
    const branch = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const boss = await makeActor('superadmin')

    const created = await request(app)
      .post('/api/v1/content/teachers')
      .set(auth(boss.token))
      .send(card('aziza-yusupova'))
      .expect(201)
    expect(created.body.data.userId).toBeFalsy()

    const account = { phone: nextPhone(), password: PASSWORD, branchId: String(branch._id) }
    const granted = await request(app)
      .patch(`/api/v1/content/teachers/${created.body.data._id}`)
      .set(auth(boss.token))
      .send({ account })
      .expect(200)
    expect(granted.body.data.userId).toBeTruthy()

    // §8 keeps replacing an existing login on the Accounts screen, where the
    // sign-out consequence is spelled out.
    await request(app)
      .patch(`/api/v1/content/teachers/${created.body.data._id}`)
      .set(auth(boss.token))
      .send({ account: { ...account, phone: nextPhone() } })
      .expect(409)
  })

  it('renames the account when the card is renamed', async () => {
    const branch = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const boss = await makeActor('superadmin')

    const created = await request(app)
      .post('/api/v1/content/teachers')
      .set(auth(boss.token))
      .send({
        ...card('aziza-yusupova'),
        account: { phone: nextPhone(), password: PASSWORD, branchId: String(branch._id) },
      })
      .expect(201)

    await request(app)
      .patch(`/api/v1/content/teachers/${created.body.data._id}`)
      .set(auth(boss.token))
      .send({ fullName: 'Aziza Yusupova-Xolmatova' })
      .expect(200)

    const account = await User.findById(created.body.data.userId)
    expect(account?.fullName).toBe('Aziza Yusupova-Xolmatova')
  })

  it('refuses a weak password before either record exists (§8)', async () => {
    const branch = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const boss = await makeActor('superadmin')
    const before = await User.countDocuments({})

    const response = await request(app)
      .post('/api/v1/content/teachers')
      .set(auth(boss.token))
      .send({
        ...card('aziza-yusupova'),
        account: { phone: nextPhone(), password: 'parol123', branchId: String(branch._id) },
      })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_FAILED')
    expect(await User.countDocuments({})).toBe(before)
    expect(await TeacherProfile.countDocuments({})).toBe(0)
  })
})

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { makeBranch, makeActor, auth, selectBranch } from '../../test/actors.js'
import { Course, Room, Group } from '../groups/group.model.js'

/**
 * TZ §21.1 — courses and rooms.
 *
 * The interesting cases are the two refusals: neither may be deleted out from
 * under a live group, because a dangling `courseId` or `roomId` breaks the group
 * list rather than tidying the catalogue.
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

const COURSE = { name: { uz: 'General English' }, slug: 'general-english', defaultPrice: 700_000 }

describe('courses', () => {
  it('lets the boss create, rename and hide a course', async () => {
    const boss = await makeActor(app, 'superadmin')

    const created = await request(app)
      .post('/api/v1/courses')
      .set(auth(boss.token))
      .send(COURSE)
      .expect(201)

    expect(created.body.data.isPublic).toBe(true)

    const updated = await request(app)
      .patch(`/api/v1/courses/${created.body.data._id}`)
      .set(auth(boss.token))
      .send({ isPublic: false, defaultPrice: 800_000 })
      .expect(200)

    expect(updated.body.data.isPublic).toBe(false)
    expect(updated.body.data.defaultPrice).toBe(800_000)
  })

  it('refuses a duplicate slug rather than creating a second catalogue entry', async () => {
    const boss = await makeActor(app, 'superadmin')
    await request(app).post('/api/v1/courses').set(auth(boss.token)).send(COURSE).expect(201)

    const duplicate = await request(app)
      .post('/api/v1/courses')
      .set(auth(boss.token))
      .send({ ...COURSE, name: { uz: 'Boshqa nom' } })
      .expect(409)

    expect(duplicate.body.error.code).toBe('CONFLICT')
  })

  it('refuses to delete a course an active group still teaches', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    const teacher = await makeActor(app, 'teacher', branch._id)

    const course = await Course.create({ ...COURSE, name: { uz: 'GE' } })
    await Group.create({
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

    const refused = await request(app)
      .delete(`/api/v1/courses/${course.id}`)
      .set(auth(boss.token))
      .expect(409)

    expect(refused.body.error.details.groups).toBe(1)
    // Still there, still teachable.
    expect(await Course.countDocuments({ deletedAt: null })).toBe(1)
  })

  it('is readable by any signed-in role, writable only with content.manage', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    const teacher = await makeActor(app, 'teacher', branch._id)
    await request(app).post('/api/v1/courses').set(auth(boss.token)).send(COURSE).expect(201)

    // A teacher picking a course for a test module needs the list.
    await request(app).get('/api/v1/courses').set(auth(teacher.token)).expect(200)

    // §4.2 — `content.manage` is `limited` for a teacher (their own materials),
    // and the catalogue is not their material.
    await request(app)
      .post('/api/v1/courses')
      .set(auth(teacher.token))
      .send({ ...COURSE, slug: 'ielts' })
      .expect(403)
  })
})

describe('rooms', () => {
  it('creates a room in the selected branch and lists only that branch', async () => {
    const own = await makeBranch('urganch-markaz')
    const other = await makeBranch('urganch-2')
    const boss = await makeActor(app, 'superadmin')

    await selectBranch(app, boss.token, own.id)
    await request(app)
      .post('/api/v1/rooms')
      .set(auth(boss.token))
      .send({ name: '1-xona', capacity: 14 })
      .expect(201)

    const inOwn = await request(app).get('/api/v1/rooms').set(auth(boss.token)).expect(200)
    expect(inOwn.body.data.total).toBe(1)

    await selectBranch(app, boss.token, other.id)
    const inOther = await request(app).get('/api/v1/rooms').set(auth(boss.token)).expect(200)
    expect(inOther.body.data.total).toBe(0)
  })

  it('refuses to create a room while no single branch is selected (§5.1)', async () => {
    await makeBranch()
    // A SuperAdmin's session starts in the consolidated 'ALL' scope, and a room
    // created there would belong to no branch at all.
    const boss = await makeActor(app, 'superadmin')

    const refused = await request(app)
      .post('/api/v1/rooms')
      .set(auth(boss.token))
      .send({ name: '1-xona' })
      .expect(400)

    expect(refused.body.error.code).toBe('BRANCH_SCOPE_REQUIRED')
    expect(await Room.countDocuments({})).toBe(0)
  })

  it('refuses to delete a room an active group is timetabled in', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    const teacher = await makeActor(app, 'teacher', branch._id)
    await selectBranch(app, boss.token, branch.id)

    const room = await Room.create({ branchId: branch._id, name: '1-xona', capacity: 14 })
    const course = await Course.create({ ...COURSE, name: { uz: 'GE' } })
    await Group.create({
      branchId: branch._id,
      courseId: course._id,
      name: 'GE-A2',
      teacherId: teacher.id,
      roomId: room._id,
      schedule: { pattern: 'juft', days: [2, 4, 6], startTime: '09:00', endTime: '10:30' },
      startDate: new Date(),
      capacity: 12,
      price: 700_000,
      status: 'active',
    })

    const refused = await request(app)
      .delete(`/api/v1/rooms/${room.id}`)
      .set(auth(boss.token))
      .expect(409)

    expect(refused.body.error.details.groups).toBe(1)
  })
})

describe('unmatched paths', () => {
  it('still returns the §23 404 envelope', async () => {
    // The catalogue routers are mounted on their own prefixes for exactly this
    // reason: one mounted at the bare `/api/v1` would run its `requireAuth` for
    // every unmatched path and answer 401 instead.
    const response = await request(app).get('/api/v1/nope').expect(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })
})

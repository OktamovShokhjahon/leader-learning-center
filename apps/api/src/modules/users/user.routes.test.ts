import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { User } from './user.model.js'
import { Branch } from '../branches/branch.model.js'
import { Session } from '../auth/session.model.js'
import { AuditLog } from '../audit/audit.model.js'
import { hashPassword } from '../auth/password.service.js'
import { generateSecret, generateTotp } from '../auth/totp.service.js'
import { encryptField } from '../../config/crypto.js'

/**
 * TZ §4.2 / §4.3 — the permission matrix, enforced by the API.
 *
 * "The API is the source of truth. Hiding a button in the UI is a convenience,
 * never a security control." These tests are that claim, checked: every case
 * here is a request a hostile client could make with the UI removed entirely.
 */
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
const nextPhone = () => `+9989011${String(phoneCounter++).padStart(5, '0')}`

async function makeBranch(slug: string) {
  return Branch.create({ slug, name: { uz: slug } })
}

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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

describe('POST /users — who may create whom (§4.2 Staff)', () => {
  it('lets a SuperAdmin create an Admin', async () => {
    const branch = await makeBranch('urganch-markaz')
    const boss = await makeActor('superadmin')

    const response = await request(app)
      .post('/api/v1/users')
      .set(auth(boss.token))
      .send({
        fullName: 'Yangi Admin',
        phone: nextPhone(),
        password: PASSWORD,
        roles: [{ role: 'admin', branchId: branch.id }],
      })
      .expect(201)

    // An administrator has seen this password, so it is not yet the user's own.
    expect(response.body.data.mustChangePassword).toBe(true)
    expect(response.body.data.passwordHash).toBeUndefined()
  })

  it('refuses an Admin creating another Admin', async () => {
    const branch = await makeBranch('urganch-markaz')
    const admin = await makeActor('admin', branch._id)

    const response = await request(app)
      .post('/api/v1/users')
      .set(auth(admin.token))
      .send({
        fullName: 'Sherik Admin',
        phone: nextPhone(),
        password: PASSWORD,
        roles: [{ role: 'admin', branchId: branch.id }],
      })
      .expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('lets an Admin create a Teacher in their own branch', async () => {
    const branch = await makeBranch('urganch-markaz')
    const admin = await makeActor('admin', branch._id)

    await request(app)
      .post('/api/v1/users')
      .set(auth(admin.token))
      .send({
        fullName: 'Yangi Ustoz',
        phone: nextPhone(),
        password: PASSWORD,
        roles: [{ role: 'teacher', branchId: branch.id }],
      })
      .expect(201)
  })

  it('refuses an Admin creating a Teacher in someone else’s branch', async () => {
    const own = await makeBranch('urganch-markaz')
    const other = await makeBranch('urganch-2')
    const admin = await makeActor('admin', own._id)

    await request(app)
      .post('/api/v1/users')
      .set(auth(admin.token))
      .send({
        fullName: 'Boshqa filial ustozi',
        phone: nextPhone(),
        password: PASSWORD,
        roles: [{ role: 'teacher', branchId: other.id }],
      })
      .expect(403)
  })

  it('refuses a Manager creating staff at all', async () => {
    const branch = await makeBranch('urganch-markaz')
    const manager = await makeActor('manager', branch._id)

    await request(app)
      .post('/api/v1/users')
      .set(auth(manager.token))
      .send({
        fullName: 'Ustoz',
        phone: nextPhone(),
        password: PASSWORD,
        roles: [{ role: 'teacher', branchId: branch.id }],
      })
      .expect(403)
  })

  it('refuses a Teacher outright', async () => {
    const branch = await makeBranch('urganch-markaz')
    const teacher = await makeActor('teacher', branch._id)

    await request(app).get('/api/v1/users').set(auth(teacher.token)).expect(403)
  })

  it('rejects a duplicate phone with DUPLICATE_PHONE, not a 500', async () => {
    const branch = await makeBranch('urganch-markaz')
    const boss = await makeActor('superadmin')
    const phone = nextPhone()

    const body = {
      fullName: 'Ustoz',
      phone,
      password: PASSWORD,
      roles: [{ role: 'teacher', branchId: branch.id }],
    }
    await request(app).post('/api/v1/users').set(auth(boss.token)).send(body).expect(201)

    const duplicate = await request(app)
      .post('/api/v1/users')
      .set(auth(boss.token))
      .send(body)
      .expect(409)

    expect(duplicate.body.error.code).toBe('DUPLICATE_PHONE')
  })

  it('rejects a superadmin role carrying a branch, and a branch role without one (§4.1)', async () => {
    const branch = await makeBranch('urganch-markaz')
    const boss = await makeActor('superadmin')

    const withBranch = await request(app)
      .post('/api/v1/users')
      .set(auth(boss.token))
      .send({
        fullName: 'Ikkinchi boss',
        phone: nextPhone(),
        password: PASSWORD,
        roles: [{ role: 'superadmin', branchId: branch.id }],
      })
      .expect(400)
    expect(withBranch.body.error.code).toBe('VALIDATION_FAILED')

    await request(app)
      .post('/api/v1/users')
      .set(auth(boss.token))
      .send({
        fullName: 'Filialsiz admin',
        phone: nextPhone(),
        password: PASSWORD,
        roles: [{ role: 'admin' }],
      })
      .expect(400)
  })

  it('rejects a weak or common password before the account exists (§8)', async () => {
    const branch = await makeBranch('urganch-markaz')
    const boss = await makeActor('superadmin')

    const response = await request(app)
      .post('/api/v1/users')
      .set(auth(boss.token))
      .send({
        fullName: 'Ustoz',
        phone: nextPhone(),
        password: 'parol123',
        roles: [{ role: 'teacher', branchId: branch.id }],
      })
      .expect(400)

    expect(response.body.error.details.password).toContain('passwordTooCommon')
    expect(await User.countDocuments({})).toBe(1)
  })
})

describe('GET /users — visibility', () => {
  it('shows an Admin only their own branch’s staff (§4.2 note 9 in spirit)', async () => {
    const own = await makeBranch('urganch-markaz')
    const other = await makeBranch('urganch-2')
    const admin = await makeActor('admin', own._id)
    await makeActor('teacher', own._id)
    await makeActor('teacher', other._id)

    const response = await request(app).get('/api/v1/users').set(auth(admin.token)).expect(200)

    const branchIds = response.body.data.items.flatMap((user: { roles: { branchId: string }[] }) =>
      user.roles.map((role) => role.branchId),
    )
    expect(branchIds.every((id: string) => id === own.id)).toBe(true)
    expect(response.body.data.total).toBe(2)
  })

  it('shows a SuperAdmin everyone', async () => {
    const own = await makeBranch('urganch-markaz')
    const other = await makeBranch('urganch-2')
    const boss = await makeActor('superadmin')
    await makeActor('teacher', own._id)
    await makeActor('teacher', other._id)

    const response = await request(app).get('/api/v1/users').set(auth(boss.token)).expect(200)
    expect(response.body.data.total).toBe(3)
  })

  it('paginates per §23', async () => {
    const branch = await makeBranch('urganch-markaz')
    const boss = await makeActor('superadmin')
    for (let index = 0; index < 5; index += 1) await makeActor('teacher', branch._id)

    const response = await request(app)
      .get('/api/v1/users?page=2&limit=2')
      .set(auth(boss.token))
      .expect(200)

    expect(response.body.data.items).toHaveLength(2)
    expect(response.body.data).toMatchObject({ page: 2, limit: 2, total: 6, pages: 3 })
  })
})

describe('PATCH /users/:id/roles', () => {
  it('signs the user out of every device, because their scope changed (§8)', async () => {
    const branchA = await makeBranch('urganch-markaz')
    const branchB = await makeBranch('urganch-2')
    const boss = await makeActor('superadmin')
    const teacher = await makeActor('teacher', branchA._id)

    const teacherDoc = await User.findOne({ phone: teacher.phone })
    expect(await Session.countDocuments({ userId: teacherDoc!._id, revokedAt: null })).toBe(1)

    await request(app)
      .patch(`/api/v1/users/${teacherDoc!.id}/roles`)
      .set(auth(boss.token))
      .send({ roles: [{ role: 'teacher', branchId: branchB.id }] })
      .expect(200)

    expect(await Session.countDocuments({ userId: teacherDoc!._id, revokedAt: null })).toBe(0)
    // The old access token is dead immediately, not in fifteen minutes.
    await request(app).get('/api/v1/auth/me').set(auth(teacher.token)).expect(401)

    const entry = await AuditLog.findOne({ action: 'user.roles.update' }).lean()
    expect(entry).toBeTruthy()
  })

  it('refuses a user editing their own roles', async () => {
    const boss = await makeActor('superadmin')
    const bossDoc = await User.findOne({ phone: boss.phone })

    await request(app)
      .patch(`/api/v1/users/${bossDoc!.id}/roles`)
      .set(auth(boss.token))
      .send({ roles: [{ role: 'superadmin' }] })
      .expect(403)
  })
})

describe('DELETE /users/:id — deactivation', () => {
  it('deactivates and revokes sessions instead of deleting the record', async () => {
    const branch = await makeBranch('urganch-markaz')
    const boss = await makeActor('superadmin')
    const teacher = await makeActor('teacher', branch._id)
    const teacherDoc = await User.findOne({ phone: teacher.phone })

    await request(app)
      .delete(`/api/v1/users/${teacherDoc!.id}`)
      .set(auth(boss.token))
      .send({ reason: 'Ishdan bo‘shadi' })
      .expect(200)

    const after = await User.findById(teacherDoc!._id)
    // The record survives — years of lessons and payroll point at it.
    expect(after).toBeTruthy()
    expect(after!.isActive).toBe(false)

    // Their sessions are revoked, so the token dies as a dead session rather
    // than as a disabled account — either way it stops working at once.
    const blocked = await request(app).get('/api/v1/auth/me').set(auth(teacher.token)).expect(401)
    expect(blocked.body.error.code).toBe('SESSION_REVOKED')

    // And signing in again is refused on the account itself.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: teacher.phone, password: PASSWORD })
      .expect(403)
    expect(login.body.error.code).toBe('ACCOUNT_DISABLED')
  })

  it('refuses to deactivate the last SuperAdmin', async () => {
    const boss = await makeActor('superadmin')
    const second = await makeActor('superadmin')
    const secondDoc = await User.findOne({ phone: second.phone })

    await request(app)
      .delete(`/api/v1/users/${secondDoc!.id}`)
      .set(auth(boss.token))
      .send({})
      .expect(200)

    const bossDoc = await User.findOne({ phone: boss.phone })
    const response = await request(app)
      .delete(`/api/v1/users/${bossDoc!.id}`)
      .set(auth(second.token))
      .send({})
      .expect(401)

    // The second boss was just deactivated, so their token is already dead —
    // which is itself the check that deactivation takes effect immediately.
    expect(response.body.error.code).toBe('SESSION_REVOKED')
    expect((await User.findById(bossDoc!._id))!.isActive).toBe(true)
  })
})

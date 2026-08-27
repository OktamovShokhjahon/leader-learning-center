import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { User } from '../users/user.model.js'
import { Branch } from '../branches/branch.model.js'
import { Student } from './student.model.js'
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
const nextPhone = () => `+9989055${String(phoneCounter++).padStart(5, '0')}`
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

/** A4 — freeze is a record (fromDate/toDate/amount/reason), not a bare toggle. */
describe('Student freeze / unfreeze (A4)', () => {
  it('records a freeze period, sets status frozen, and reverses it on unfreeze', async () => {
    const branch = await Branch.create({ slug: 'buxoro', name: { uz: 'Buxoro' } })
    const manager = await makeActor('manager', branch._id)

    const student = await Student.create({
      branchId: branch._id,
      fullName: 'Zulfiya Qodirova',
      phone: '+998905555555',
      status: 'active',
    })

    const fromDate = new Date()
    const toDate = new Date(Date.now() + 30 * 24 * 3600 * 1000)

    const freezeRes = await request(app)
      .post(`/api/v1/students/${student._id}/freeze`)
      .set(auth(manager.token))
      .send({ fromDate, toDate, amount: 300000, reason: "Oilaviy sabab bo'yicha ta'til" })
      .expect(200)

    expect(freezeRes.body.data.status).toBe('frozen')
    expect(freezeRes.body.data.freezePeriods).toHaveLength(1)
    expect(freezeRes.body.data.freezePeriods[0].amount).toBe(300000)
    expect(freezeRes.body.data.freezePeriods[0].reason).toContain('sabab')
    expect(freezeRes.body.data.freezePeriods[0].unfrozenAt).toBeFalsy()

    const unfreezeRes = await request(app)
      .post(`/api/v1/students/${student._id}/unfreeze`)
      .set(auth(manager.token))
      .expect(200)

    expect(unfreezeRes.body.data.status).toBe('active')
    expect(unfreezeRes.body.data.freezePeriods[0].unfrozenAt).toBeTruthy()
  })

  it('rejects a freeze whose toDate is before fromDate', async () => {
    const branch = await Branch.create({ slug: 'namangan', name: { uz: 'Namangan' } })
    const manager = await makeActor('manager', branch._id)
    const student = await Student.create({
      branchId: branch._id,
      fullName: 'Otabek Yusupov',
      status: 'active',
    })

    await request(app)
      .post(`/api/v1/students/${student._id}/freeze`)
      .set(auth(manager.token))
      .send({
        fromDate: new Date(),
        toDate: new Date(Date.now() - 24 * 3600 * 1000),
        reason: 'Notoʻgʻri sana',
      })
      .expect(400)
  })
})

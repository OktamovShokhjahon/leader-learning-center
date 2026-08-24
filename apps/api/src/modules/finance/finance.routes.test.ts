import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { User } from '../users/user.model.js'
import { Branch } from '../branches/branch.model.js'
import { AuditLog } from '../audit/audit.model.js'
import { hashPassword } from '../auth/password.service.js'

/**
 * TZ §30.2 is an acceptance criterion, so it gets a test rather than a promise:
 *
 *   "An Admin account receives 403 on every finance endpoint, and the attempt
 *    appears in the audit log."
 *
 * §4.3 explains why the guard sits at the router rather than in each handler —
 * "so a mistake in a single controller cannot leak it". These tests hit the
 * mounted routes, which is the only way to prove the mount is actually guarded.
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
const nextPhone = () => `+9989033${String(phoneCounter++).padStart(5, '0')}`
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

/** Every finance surface §15 exposes. Adding a route here should fail loudly. */
const FINANCE_ROUTES = [
  '/api/v1/finance/overview',
  '/api/v1/finance/revenue',
  '/api/v1/finance/branches-comparison',
]

async function makeActor(role: string) {
  const branch = await Branch.findOne({}).lean()
  const phone = nextPhone()

  await User.create({
    fullName: `${role} user`,
    phone,
    passwordHash: await hashPassword(PASSWORD),
    roles: [role === 'superadmin' ? { role } : { role, branchId: branch?._id }],
  })

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone, password: PASSWORD })
    .expect(200)

  return { phone, token: response.body.data.accessToken as string }
}

beforeEach(async () => {
  await Branch.create({
    name: { uz: 'Urganch' },
    slug: 'urganch-test',
    phones: ['+998901234567'],
  })
})

describe('finance is SuperAdmin-only (§4.3, §15, §30.2)', () => {
  /**
   * §30.2 words this as "an Admin account receives 403 on every finance
   * endpoint". The Admin role is gone (ADR 0004) and the Manager inherited the
   * front-desk half of it — including payment approval — so the Manager is now
   * the account that criterion is really about: the one that handles money
   * daily and still must not see the centre's finances.
   */
  it('refuses a Manager and a Teacher on every finance endpoint', async () => {
    for (const role of ['manager', 'teacher']) {
      const actor = await makeActor(role)
      for (const route of FINANCE_ROUTES) {
        const response = await request(app).get(route).set(auth(actor.token))
        expect(response.status, `${route} must refuse a ${role}`).toBe(403)
        expect(response.body.error.code).toBe('FORBIDDEN')
      }
    }
  })

  it('lets a SuperAdmin through', async () => {
    const boss = await makeActor('superadmin')

    for (const route of FINANCE_ROUTES) {
      const response = await request(app).get(route).set(auth(boss.token))
      expect(response.status, `${route} must serve a superadmin`).toBe(200)
    }
  })

  it('refuses an anonymous request without leaking whether the route exists', async () => {
    for (const route of FINANCE_ROUTES) {
      await request(app).get(route).expect(401)
    }
  })

  /** §21.3 — "any 403 on a finance endpoint" is a mandatory audit entry. */
  it('writes the refused attempt to the audit log', async () => {
    const manager = await makeActor('manager')

    await request(app).get('/api/v1/finance/overview').set(auth(manager.token)).expect(403)

    // The audit write is deliberately not awaited by the guard, so give the
    // insert a moment rather than asserting on a race.
    await new Promise((resolve) => setTimeout(resolve, 150))

    const entry = await AuditLog.findOne({ action: 'access.denied' }).lean()

    expect(entry, 'a denied finance read must be audited').toBeTruthy()
    expect(entry?.outcome).toBe('failure')
    expect(entry?.path).toContain('/finance/overview')
    expect(entry?.reason).toContain('superadmin')
  })
})

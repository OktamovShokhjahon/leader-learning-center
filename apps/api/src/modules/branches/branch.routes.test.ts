import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { User } from '../users/user.model.js'
import { Branch } from './branch.model.js'
import { Lead } from '../leads/lead.model.js'
import { Session } from '../auth/session.model.js'
import { hashPassword } from '../auth/password.service.js'
import { generateSecret, generateTotp } from '../auth/totp.service.js'
import { encryptField } from '../../config/crypto.js'

/**
 * TZ §5 — multi-branch architecture, "a core requirement, not an add-on".
 *
 * The test that matters most here is the last one: that a request scoped to one
 * branch cannot see another branch's operational data *even though the
 * controller never mentions `branchId`*. That is the §5.1 promise — "forgetting
 * the filter in a controller must be impossible by construction" — and it is
 * only true if the plugin actually works.
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
const nextPhone = () => `+9989022${String(phoneCounter++).padStart(5, '0')}`
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

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

const validBranch = {
  name: { uz: 'Xiva filiali', ru: 'Филиал Хива' },
  slug: 'xiva',
  phones: ['+998901234567'],
  geo: { lat: 41.3775, lng: 60.3619 },
}

describe('POST /branches (§4.2 — SuperAdmin only)', () => {
  it('lets a SuperAdmin create a branch with the §5.3 defaults', async () => {
    const boss = await makeActor('superadmin')

    const response = await request(app)
      .post('/api/v1/branches')
      .set(auth(boss.token))
      .send(validBranch)
      .expect(201)

    // §5.3 — the financial year runs September → August, per the Молия sheet.
    expect(response.body.data.financialYearStart).toBe(9)
    expect(response.body.data.timezone).toBe('Asia/Tashkent')
    expect(response.body.data.currency).toBe('UZS')
    // §4.2 note 4 — the default discount ceiling.
    expect(response.body.data.settings.discountCeilingPercent).toBe(20)
  })

  it('refuses an Admin', async () => {
    const branch = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const admin = await makeActor('admin', branch._id)

    await request(app).post('/api/v1/branches').set(auth(admin.token)).send(validBranch).expect(403)
  })

  it('refuses an anonymous request', async () => {
    await request(app).post('/api/v1/branches').send(validBranch).expect(401)
  })

  it('rejects a duplicate slug — it is a public URL (§5.3)', async () => {
    const boss = await makeActor('superadmin')
    await request(app).post('/api/v1/branches').set(auth(boss.token)).send(validBranch).expect(201)

    const duplicate = await request(app)
      .post('/api/v1/branches')
      .set(auth(boss.token))
      .send(validBranch)
      .expect(409)

    expect(duplicate.body.error.code).toBe('CONFLICT')
  })

  it('rejects a malformed slug', async () => {
    const boss = await makeActor('superadmin')
    const response = await request(app)
      .post('/api/v1/branches')
      .set(auth(boss.token))
      .send({ ...validBranch, slug: 'Xiva Filiali!' })
      .expect(400)

    expect(response.body.error.details.slug).toContain('invalidSlug')
  })

  it('creates a branch with only a name, leaving the optional fields empty', async () => {
    const boss = await makeActor('superadmin')
    await request(app)
      .post('/api/v1/branches')
      .set(auth(boss.token))
      .send({ name: { uz: 'Yangi filial' }, slug: 'yangi' })
      .expect(201)
  })
})

describe('GET /branches — visibility', () => {
  it('shows an Admin only the branches they hold a role in', async () => {
    const own = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    await Branch.create({ slug: 'xiva', name: { uz: 'Xiva' } })
    const admin = await makeActor('admin', own._id)

    const response = await request(app).get('/api/v1/branches').set(auth(admin.token)).expect(200)

    expect(response.body.data.total).toBe(1)
    expect(response.body.data.items[0].slug).toBe('urganch')
  })

  it('answers 404, not 403, when an Admin asks for another branch by id', async () => {
    const own = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const other = await Branch.create({ slug: 'xiva', name: { uz: 'Xiva' } })
    const admin = await makeActor('admin', own._id)

    // A 403 would confirm the branch exists; that is not an Admin's business.
    await request(app).get(`/api/v1/branches/${other.id}`).set(auth(admin.token)).expect(404)
  })

  it('shows a SuperAdmin every branch', async () => {
    await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    await Branch.create({ slug: 'xiva', name: { uz: 'Xiva' } })
    const boss = await makeActor('superadmin')

    const response = await request(app).get('/api/v1/branches').set(auth(boss.token)).expect(200)
    expect(response.body.data.total).toBe(2)
  })
})

describe('DELETE /branches/:id — archive, never destroy', () => {
  it('soft-deletes and moves anyone parked on it to the consolidated scope', async () => {
    const branch = await Branch.create({ slug: 'xiva', name: { uz: 'Xiva' } })
    const boss = await makeActor('superadmin')

    await request(app)
      .post('/api/v1/auth/branch')
      .set(auth(boss.token))
      .send({ branchId: branch.id })
      .expect(200)

    await request(app).delete(`/api/v1/branches/${branch.id}`).set(auth(boss.token)).expect(200)

    const archived = await Branch.findById(branch._id)
    // The document survives: invoices, attendance and payroll all point at it.
    expect(archived).toBeTruthy()
    expect(archived!.isActive).toBe(false)
    expect(archived!.deletedAt).toBeTruthy()

    const session = await Session.findOne({})
    expect(session!.activeBranchId).toBe('ALL')

    // And it disappears from the public site's branch list.
    const publicList = await request(app).get('/api/v1/public/branches').expect(200)
    expect(publicList.body.data).toHaveLength(0)
  })

  it('refuses while staff are still attached to it', async () => {
    const branch = await Branch.create({ slug: 'xiva', name: { uz: 'Xiva' } })
    const boss = await makeActor('superadmin')
    await makeActor('teacher', branch._id)

    const response = await request(app)
      .delete(`/api/v1/branches/${branch.id}`)
      .set(auth(boss.token))
      .expect(409)

    expect(response.body.error.details.staffCount).toBe(1)
  })
})

describe('branch scoping (§5.1)', () => {
  it('hides another branch’s data from a controller that never mentions branchId', async () => {
    const own = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const other = await Branch.create({ slug: 'xiva', name: { uz: 'Xiva' } })

    for (const [branch, name] of [
      [own, 'Urganch o‘quvchisi'],
      [other, 'Xiva o‘quvchisi'],
    ] as const) {
      await Lead.create({
        branchId: branch._id,
        branchSlug: branch.slug,
        fullName: name,
        phone: nextPhone(),
        courseSlug: 'ielts',
      })
    }

    const admin = await makeActor('admin', own._id)

    // Read through the scope the API itself installs for this session. The query
    // is awaited *inside* the callback, exactly as a controller does downstream
    // of `requireAuth` — a Mongoose query handed out of the scope unexecuted
    // would run its hooks outside the AsyncLocalStorage context and see nothing.
    const { runWithScope, withAllBranches } = await import('../../middleware/branch-scope.js')

    const visible = await runWithScope({ branchId: own.id, role: 'admin' }, async () =>
      Lead.find({}).lean(),
    )

    expect(visible).toHaveLength(1)
    expect(visible[0]!.branchSlug).toBe('urganch')
    expect(admin.token).toBeTruthy()

    // The consolidated SuperAdmin scope is the documented single exception.
    const consolidated = await runWithScope({ branchId: own.id, role: 'superadmin' }, async () =>
      withAllBranches('test: consolidated report', async () => Lead.find({}).lean()),
    )
    expect(consolidated).toHaveLength(2)
  })

  it('scopes a real HTTP request, through a controller that never filters by branch', async () => {
    const own = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const other = await Branch.create({ slug: 'xiva', name: { uz: 'Xiva' } })

    for (const branch of [own, other]) {
      await Lead.create({
        branchId: branch._id,
        branchSlug: branch.slug,
        fullName: `${branch.slug} o‘quvchisi`,
        phone: nextPhone(),
        courseSlug: 'ielts',
      })
    }

    const manager = await makeActor('manager', own._id)
    const response = await request(app).get('/api/v1/leads').set(auth(manager.token)).expect(200)

    // `GET /leads` never mentions branchId. The plugin did this.
    expect(response.body.data.total).toBe(1)
    expect(response.body.data.items[0].branchSlug).toBe('urganch')

    const funnel = await request(app)
      .get('/api/v1/leads/funnel')
      .set(auth(manager.token))
      .expect(200)
    // The aggregation pipeline is scoped too, not only `find`.
    expect(funnel.body.data.yangi).toBe(1)
  })

  it('shows a SuperAdmin every branch’s leads in the consolidated scope (§5.1)', async () => {
    const own = await Branch.create({ slug: 'urganch', name: { uz: 'Urganch' } })
    const other = await Branch.create({ slug: 'xiva', name: { uz: 'Xiva' } })

    for (const branch of [own, other]) {
      await Lead.create({
        branchId: branch._id,
        branchSlug: branch.slug,
        fullName: `${branch.slug} o‘quvchisi`,
        phone: nextPhone(),
        courseSlug: 'ielts',
      })
    }

    const boss = await makeActor('superadmin')
    const all = await request(app).get('/api/v1/leads').set(auth(boss.token)).expect(200)
    expect(all.body.data.total).toBe(2)

    // Narrowing the switcher to one branch narrows the data with it.
    await request(app)
      .post('/api/v1/auth/branch')
      .set(auth(boss.token))
      .send({ branchId: own.id })
      .expect(200)

    const narrowed = await request(app).get('/api/v1/leads').set(auth(boss.token)).expect(200)
    expect(narrowed.body.data.total).toBe(1)
  })
})

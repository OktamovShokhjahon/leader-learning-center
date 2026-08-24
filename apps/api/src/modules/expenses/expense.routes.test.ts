import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { makeBranch, makeActor, auth, selectBranch } from '../../test/actors.js'
import { Expense, ExpenseCategory } from './expense.model.js'
import { AuditLog } from '../audit/audit.model.js'

/**
 * TZ §13 — `harajat`, and the two ceilings that decide where a row lands.
 *
 * §4.2 note 5: a Manager may only spend from a petty category, under a
 * per-transaction cap. Note 6: anything above the branch approval ceiling waits
 * for the boss instead of being booked.
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

async function seedCategories(branchId: unknown) {
  const petty = await ExpenseCategory.create({
    branchId,
    slug: 'kanselyariya',
    name: { uz: 'Kanselyariya' },
    petty: true,
  })
  const big = await ExpenseCategory.create({
    branchId,
    slug: 'arenda',
    name: { uz: 'Arenda' },
    petty: false,
  })
  const payrollOnly = await ExpenseCategory.create({
    branchId,
    slug: 'oylik',
    name: { uz: 'Oylik' },
    payrollOnly: true,
  })
  return { petty, big, payrollOnly }
}

describe('POST /expenses — the ten-second path (§13.1)', () => {
  it('books a small expense straight away and audits it', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const { petty } = await seedCategories(branch._id)

    const response = await request(app)
      .post('/api/v1/expenses')
      .set(auth(boss.token))
      .send({ amount: 50_000, categoryId: petty.id, comment: 'Qog‘oz' })
      .expect(201)

    expect(response.body.data.needsApproval).toBe(false)
    expect(response.body.data.expense.status).toBe('approved')
    expect(await AuditLog.countDocuments({ action: 'expense.create' })).toBe(1)
  })

  it('sends an above-ceiling expense to the boss instead of booking it (note 6)', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const { big } = await seedCategories(branch._id)

    // The default `money.expenseApprovalCeiling` is 1 000 000 so'm.
    const response = await request(app)
      .post('/api/v1/expenses')
      .set(auth(boss.token))
      .send({ amount: 5_000_000, categoryId: big.id })
      .expect(201)

    expect(response.body.data.needsApproval).toBe(true)
    expect(response.body.data.expense.status).toBe('pending_approval')
  })

  it('refuses a hand-entered salary — Oylik comes from payroll (§13.2)', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const { payrollOnly } = await seedCategories(branch._id)

    await request(app)
      .post('/api/v1/expenses')
      .set(auth(boss.token))
      .send({ amount: 100_000, categoryId: payrollOnly.id })
      .expect(400)

    expect(await Expense.countDocuments({})).toBe(0)
  })
})

describe('a Manager is limited (§4.2 note 5)', () => {
  it('allows a petty category under the cap', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)
    const { petty } = await seedCategories(branch._id)

    await request(app)
      .post('/api/v1/expenses')
      .set(auth(manager.token))
      .send({ amount: 50_000, categoryId: petty.id })
      .expect(201)
  })

  it('refuses a non-petty category outright', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)
    const { big } = await seedCategories(branch._id)

    const refused = await request(app)
      .post('/api/v1/expenses')
      .set(auth(manager.token))
      .send({ amount: 50_000, categoryId: big.id })
      .expect(403)

    expect(refused.body.error.code).toBe('FORBIDDEN')
  })

  it('refuses an amount over the per-transaction ceiling', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)
    const { petty } = await seedCategories(branch._id)

    // The default `money.pettyCashCeiling` is 200 000 so'm.
    await request(app)
      .post('/api/v1/expenses')
      .set(auth(manager.token))
      .send({ amount: 900_000, categoryId: petty.id })
      .expect(403)

    expect(await Expense.countDocuments({})).toBe(0)
  })

  it('shows a Manager only their own rows, never the branch books', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    const manager = await makeActor(app, 'manager', branch._id)
    await selectBranch(app, boss.token, branch.id)
    const { petty } = await seedCategories(branch._id)

    await request(app)
      .post('/api/v1/expenses')
      .set(auth(boss.token))
      .send({ amount: 10_000, categoryId: petty.id })
      .expect(201)
    await request(app)
      .post('/api/v1/expenses')
      .set(auth(manager.token))
      .send({ amount: 20_000, categoryId: petty.id })
      .expect(201)

    const mine = await request(app).get('/api/v1/expenses').set(auth(manager.token)).expect(200)
    expect(mine.body.data.total).toBe(1)
    expect(mine.body.data.items[0].amount).toBe(20_000)

    const all = await request(app).get('/api/v1/expenses').set(auth(boss.token)).expect(200)
    expect(all.body.data.total).toBe(2)
  })
})

describe('approval (§13.3)', () => {
  it('approves once and refuses a second decision', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const { big } = await seedCategories(branch._id)

    const created = await request(app)
      .post('/api/v1/expenses')
      .set(auth(boss.token))
      .send({ amount: 5_000_000, categoryId: big.id })
      .expect(201)
    const id = created.body.data.expense._id

    await request(app)
      .post(`/api/v1/expenses/${id}/approve`)
      .set(auth(boss.token))
      .send({})
      .expect(200)

    const twice = await request(app)
      .post(`/api/v1/expenses/${id}/reject`)
      .set(auth(boss.token))
      .send({ reason: 'changed my mind' })
      .expect(409)

    expect(twice.body.error.code).toBe('CONFLICT')
  })

  it('summarises by category for the Молия sheet', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')
    await selectBranch(app, boss.token, branch.id)
    const { petty } = await seedCategories(branch._id)

    for (const amount of [10_000, 20_000, 30_000]) {
      await request(app)
        .post('/api/v1/expenses')
        .set(auth(boss.token))
        .send({ amount, categoryId: petty.id })
        .expect(201)
    }

    const summary = await request(app)
      .get('/api/v1/expenses/summary?groupBy=category')
      .set(auth(boss.token))
      .expect(200)

    expect(summary.body.data.total).toBe(60_000)
    expect(summary.body.data.rows[0].slug).toBe('kanselyariya')
    expect(summary.body.data.rows[0].count).toBe(3)
  })
})

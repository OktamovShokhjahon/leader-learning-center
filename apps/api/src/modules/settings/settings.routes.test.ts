import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { makeBranch, makeActor, auth } from '../../test/actors.js'
import { invalidateSettingsCache, resolveSetting } from './settings.service.js'
import { AuditLog } from '../audit/audit.model.js'

/**
 * TZ §21.1 — the settings store, and the cascade every other module reads
 * through: branch override → centre-wide row → registry default.
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
  // The service caches for 30s; a fresh database must not be read through a
  // cache warmed by the previous test.
  invalidateSettingsCache()
})

describe('GET /settings', () => {
  it('reports every registered key with its default, before anything is stored', async () => {
    const boss = await makeActor(app, 'superadmin')
    const response = await request(app).get('/api/v1/settings').set(auth(boss.token)).expect(200)

    const discount = response.body.data.find(
      (row: { key: string }) => row.key === 'money.discountCeilingPercent',
    )
    expect(discount.isDefault).toBe(true)
    expect(discount.effective).toBe(20)
  })

  it('never returns a secret, only whether one is set (§8)', async () => {
    const boss = await makeActor(app, 'superadmin')
    await request(app)
      .patch('/api/v1/settings')
      .set(auth(boss.token))
      .send({ key: 'integration.eskizToken', value: 'super-secret-token' })
      .expect(200)

    const response = await request(app).get('/api/v1/settings').set(auth(boss.token)).expect(200)
    const token = response.body.data.find(
      (row: { key: string }) => row.key === 'integration.eskizToken',
    )
    expect(token.effective).not.toContain('super-secret')
    expect(token.effective).toBe('••••••••')

    // Nor does it reach the audit log.
    const entry = await AuditLog.findOne({ action: 'setting.update' }).lean()
    expect(JSON.stringify(entry)).not.toContain('super-secret')
  })

  it('refuses anyone who is not the boss', async () => {
    const branch = await makeBranch()
    const manager = await makeActor(app, 'manager', branch._id)
    await request(app).get('/api/v1/settings').set(auth(manager.token)).expect(403)
  })
})

describe('the cascade', () => {
  it('prefers a branch override over the centre-wide value', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')

    await request(app)
      .patch('/api/v1/settings')
      .set(auth(boss.token))
      .send({ key: 'money.discountCeilingPercent', value: 30 })
      .expect(200)
    await request(app)
      .patch('/api/v1/settings')
      .set(auth(boss.token))
      .send({ key: 'money.discountCeilingPercent', value: 50, branchId: branch.id })
      .expect(200)

    expect(await resolveSetting('money.discountCeilingPercent')).toBe(30)
    expect(await resolveSetting('money.discountCeilingPercent', branch.id)).toBe(50)
  })

  it('falls back to the centre-wide value when an override is cleared', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')

    await request(app)
      .patch('/api/v1/settings')
      .set(auth(boss.token))
      .send({ key: 'money.discountCeilingPercent', value: 30 })
      .expect(200)
    await request(app)
      .patch('/api/v1/settings')
      .set(auth(boss.token))
      .send({ key: 'money.discountCeilingPercent', value: 50, branchId: branch.id })
      .expect(200)

    await request(app)
      .delete(`/api/v1/settings/money.discountCeilingPercent?branchId=${branch.id}`)
      .set(auth(boss.token))
      .expect(200)

    expect(await resolveSetting('money.discountCeilingPercent', branch.id)).toBe(30)
  })

  it('refuses a branch override on a centre-wide key', async () => {
    const branch = await makeBranch()
    const boss = await makeActor(app, 'superadmin')

    await request(app)
      .patch('/api/v1/settings')
      .set(auth(boss.token))
      .send({ key: 'notify.smsEnabled', value: true, branchId: branch.id })
      .expect(400)
  })
})

describe('validation', () => {
  it('rejects a value the key’s schema will not take', async () => {
    const boss = await makeActor(app, 'superadmin')

    // The ceiling is a percentage — 500 is not one.
    await request(app)
      .patch('/api/v1/settings')
      .set(auth(boss.token))
      .send({ key: 'money.discountCeilingPercent', value: 500 })
      .expect(400)

    expect(await resolveSetting('money.discountCeilingPercent')).toBe(20)
  })

  it('rejects a key that is not in the registry', async () => {
    const boss = await makeActor(app, 'superadmin')
    await request(app)
      .patch('/api/v1/settings')
      .set(auth(boss.token))
      .send({ key: 'money.madeUpKey', value: 1 })
      .expect(400)
  })

  it('404s on clearing a key that does not exist', async () => {
    const boss = await makeActor(app, 'superadmin')
    await request(app).delete('/api/v1/settings/nope.nope').set(auth(boss.token)).expect(404)
  })
})

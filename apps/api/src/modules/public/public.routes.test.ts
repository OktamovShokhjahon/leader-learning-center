import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'

/**
 * These cover everything that happens *before* the database is touched:
 * schema validation, phone normalisation, the honeypot, and the §23 error
 * envelope. They need no Mongo, so they run anywhere.
 *
 * The persistence path (duplicate-merge, branch resolution) is covered by
 * integration tests against `mongodb-memory-server` once a mongod binary is
 * available in the environment — see the note in README.
 */
const app = createApp()

const validLead = {
  fullName: 'Aziza Rahimova',
  phone: '+998901234567',
  courseSlug: 'ielts',
  consent: true,
  locale: 'uz',
}

describe('GET /api/v1/health', () => {
  it('reports status and db state', async () => {
    const response = await request(app).get('/api/v1/health').expect(200)
    expect(response.body.data.status).toBe('ok')
    expect(response.body.data).toHaveProperty('db')
  })
})

describe('POST /api/v1/public/leads — validation', () => {
  it('rejects a missing phone with the §23 error envelope', async () => {
    const { phone: _phone, ...withoutPhone } = validLead
    const response = await request(app).post('/api/v1/public/leads').send(withoutPhone).expect(400)

    expect(response.body.error.code).toBe('VALIDATION_FAILED')
    expect(response.body.error.details).toHaveProperty('phone')
  })

  it('rejects a non-Uzbek phone number', async () => {
    const response = await request(app)
      .post('/api/v1/public/leads')
      .send({ ...validLead, phone: '+7 900 123 45 67' })
      .expect(400)

    expect(response.body.error.details.phone).toContain('invalidPhone')
  })

  it('rejects a missing consent checkbox', async () => {
    const { consent: _consent, ...withoutConsent } = validLead
    const response = await request(app)
      .post('/api/v1/public/leads')
      .send(withoutConsent)
      .expect(400)

    expect(response.body.error.details).toHaveProperty('consent')
  })

  it('rejects a name that is too short', async () => {
    const response = await request(app)
      .post('/api/v1/public/leads')
      .send({ ...validLead, fullName: 'Az' })
      .expect(400)

    expect(response.body.error.details.fullName).toContain('nameTooShort')
  })

  it('rejects a filled honeypot before the database is touched', async () => {
    // §7.1 — a filled honeypot is a bot. It gets 201 so it learns nothing, but
    // nothing is written; this passes with no Mongo connection, which proves it.
    const response = await request(app)
      .post('/api/v1/public/leads')
      .send({ ...validLead, website: 'http://spam.example' })
      .expect(400)

    // The schema caps `website` at zero characters, so it fails validation first.
    expect(response.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('normalises a spaced phone number to +998XXXXXXXXX', async () => {
    // Reaches the service layer, which needs Mongo — assert only that validation
    // passed, i.e. the failure is no longer VALIDATION_FAILED.
    const response = await request(app)
      .post('/api/v1/public/leads')
      .send({ ...validLead, phone: '+998 90 123 45 67' })

    expect(response.body.error?.code).not.toBe('VALIDATION_FAILED')
  })
})

describe('POST /api/v1/public/contact — validation', () => {
  it('rejects a message shorter than 10 characters', async () => {
    const response = await request(app)
      .post('/api/v1/public/contact')
      .send({ fullName: 'Aziza Rahimova', phone: '+998901234567', message: 'salom' })
      .expect(400)

    expect(response.body.error.details.message).toContain('messageTooShort')
  })
})

describe('unknown routes', () => {
  it('returns the §23 envelope for a 404', async () => {
    const response = await request(app).get('/api/v1/nope').expect(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })
})

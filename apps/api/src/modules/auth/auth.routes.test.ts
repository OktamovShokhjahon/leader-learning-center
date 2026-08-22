import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../../app.js'
import { connectTestDatabase, disconnectTestDatabase, clearTestDatabase } from '../../test/db.js'
import { User } from '../users/user.model.js'
import { Branch } from '../branches/branch.model.js'
import { Session } from './session.model.js'
import { AuditLog } from '../audit/audit.model.js'
import { hashPassword } from './password.service.js'
import { generateSecret, generateTotp } from './totp.service.js'
import { encryptField } from '../../config/crypto.js'
import { REFRESH_COOKIE } from './token.service.js'

/**
 * TZ §8 — the authentication module, end to end against a real MongoDB.
 *
 * The properties worth protecting here are the ones a unit test cannot see:
 * that a wrong password and an unknown phone are indistinguishable, that a
 * replayed refresh token kills the family, and that a branch cannot be changed
 * by anything the browser holds (§5.2).
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

async function makeBranch(slug = 'urganch-markaz') {
  return Branch.create({ slug, name: { uz: 'Urganch — Markaziy' } })
}

async function makeUser(overrides: Record<string, unknown> = {}) {
  return User.create({
    fullName: 'Umarbek Ulugbekovich',
    phone: '+998901112233',
    passwordHash: await hashPassword(PASSWORD),
    roles: [{ role: 'admin', branchId: (await makeBranch())._id }],
    ...overrides,
  })
}

/** Logs in and returns the access token plus the refresh cookie. */
async function signIn(phone: string, password = PASSWORD, extra: Record<string, unknown> = {}) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ phone, password, ...extra })
    .expect(200)

  const cookies = response.headers['set-cookie'] as unknown as string[]
  return {
    accessToken: response.body.data.accessToken as string,
    user: response.body.data.user,
    cookie: cookies.find((cookie) => cookie.startsWith(REFRESH_COOKIE))!,
  }
}

const refreshValueOf = (cookie: string) => cookie.split(';')[0]!.split('=')[1]!

describe('POST /auth/login', () => {
  it('signs a user in and returns an access token plus a refresh cookie', async () => {
    await makeUser()
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998901112233', password: PASSWORD, deviceName: 'Reception PC' })
      .expect(200)

    expect(response.body.data.accessToken).toBeTypeOf('string')
    expect(response.body.data.user.activeRole).toBe('admin')

    const cookies = response.headers['set-cookie'] as unknown as string[]
    const refresh = cookies.find((cookie) => cookie.startsWith(REFRESH_COOKIE))!
    // §8 — the refresh token must not be readable by script, and must not ride
    // along on cross-site requests.
    expect(refresh).toMatch(/HttpOnly/i)
    expect(refresh).toMatch(/SameSite=Strict/i)

    // The access token itself is never a cookie: §8 puts it in memory only.
    expect(cookies.some((cookie) => cookie.includes('accessToken'))).toBe(false)
  })

  it('normalises the phone, so a spaced number signs in', async () => {
    await makeUser()
    await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998 90 111 22 33', password: PASSWORD })
      .expect(200)
  })

  it('answers identically for an unknown phone and a wrong password', async () => {
    await makeUser()

    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998900000000', password: PASSWORD })
      .expect(401)

    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998901112233', password: 'not-the-password' })
      .expect(401)

    // Identical code *and* message: anything else enumerates the centre's staff.
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(wrong.body.error).toEqual(unknown.body.error)
  })

  it('refuses a deactivated account', async () => {
    await makeUser({ isActive: false })
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998901112233', password: PASSWORD })
      .expect(403)

    expect(response.body.error.code).toBe('ACCOUNT_DISABLED')
  })

  it('records both successful and failed logins in the audit log (§8)', async () => {
    await makeUser()
    await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998901112233', password: 'wrong' })
    await signIn('+998901112233')

    const entries = await AuditLog.find({ action: 'auth.login' }).sort({ at: 1 }).lean()
    expect(entries.map((entry) => entry.outcome)).toEqual(['failure', 'success'])
    expect(entries[1]?.ip).toBeTruthy()
  })
})

describe('progressive lockout (§8)', () => {
  it('locks the account after five failures and reports how long to wait', async () => {
    await makeUser()

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: '+998901112233', password: 'wrong' })
        .expect(401)
    }

    // The sixth attempt is refused before the password is even checked — note
    // this one uses the *correct* password and is still rejected.
    const locked = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998901112233', password: PASSWORD })
      .expect(429)

    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED')
    expect(locked.body.error.details.retryAfterSeconds).toBeGreaterThan(0)
    expect(locked.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('clears the counter after a successful sign-in', async () => {
    await makeUser()
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: '+998901112233', password: 'wrong' })
        .expect(401)
    }

    await signIn('+998901112233')

    // Four more failures would have crossed the threshold had the counter
    // survived; it did not, so this stays a plain 401.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: '+998901112233', password: 'wrong' })
        .expect(401)
    }
  })
})

describe('POST /auth/refresh — rotation and reuse detection (§8)', () => {
  it('rotates the token on every use', async () => {
    await makeUser()
    const { cookie } = await signIn('+998901112233')

    const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200)
    const rotated = (first.headers['set-cookie'] as unknown as string[])[0]!

    expect(first.body.data.accessToken).toBeTypeOf('string')
    expect(refreshValueOf(rotated)).not.toBe(refreshValueOf(cookie))
  })

  it('revokes the whole family when an already-rotated token is replayed', async () => {
    await makeUser()
    const { cookie } = await signIn('+998901112233')

    const rotatedResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .expect(200)
    const rotated = (rotatedResponse.headers['set-cookie'] as unknown as string[])[0]!

    // An attacker replays the token they captured before the real client
    // rotated it.
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401)
    expect(replay.body.error.code).toBe('TOKEN_REUSED')

    // The legitimate holder is signed out too — the family is gone.
    const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', rotated).expect(401)
    expect(after.body.error.code).toBe('SESSION_REVOKED')

    const session = await Session.findOne({})
    expect(session?.revokedReason).toBe('reuse_detected')
  })

  it('rejects a forged token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=not-a-real-token`)
      .expect(401)

    expect(response.body.error.code).toBe('TOKEN_INVALID')
  })
})

describe('GET /auth/me and the session list', () => {
  it('rejects a request with no token', async () => {
    const response = await request(app).get('/api/v1/auth/me').expect(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('rejects a tampered token', async () => {
    await makeUser()
    const { accessToken } = await signIn('+998901112233')
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken.slice(0, -2)}xx`)
      .expect(401)

    expect(response.body.error.code).toBe('TOKEN_INVALID')
  })

  it('describes the signed-in user and their branch', async () => {
    await makeUser()
    const { accessToken } = await signIn('+998901112233', PASSWORD, { deviceName: 'Reception PC' })

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    expect(response.body.data.phone).toBe('+998901112233')
    expect(response.body.data.activeRole).toBe('admin')
    expect(response.body.data.roles[0].branchName).toBe('Urganch — Markaziy')
    // The response must never carry anything password- or secret-shaped.
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|argon2|secret/i)
  })

  it('lists active devices and marks the current one', async () => {
    await makeUser()
    const { accessToken } = await signIn('+998901112233', PASSWORD, { deviceName: 'Reception PC' })
    await signIn('+998901112233', PASSWORD, { deviceName: 'Boss phone' })

    const response = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    expect(response.body.data).toHaveLength(2)
    expect(
      response.body.data.filter((session: { isCurrent: boolean }) => session.isCurrent),
    ).toHaveLength(1)
  })

  it('terminating a session invalidates its refresh family immediately (§8)', async () => {
    await makeUser()
    const laptop = await signIn('+998901112233', PASSWORD, { deviceName: 'Laptop' })
    const phone = await signIn('+998901112233', PASSWORD, { deviceName: 'Phone' })

    const sessions = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${laptop.accessToken}`)
      .expect(200)

    const phoneSession = sessions.body.data.find(
      (session: { isCurrent: boolean }) => !session.isCurrent,
    )

    await request(app)
      .delete(`/api/v1/auth/sessions/${phoneSession.id}`)
      .set('Authorization', `Bearer ${laptop.accessToken}`)
      .expect(200)

    // The terminated device can neither refresh nor use its access token.
    await request(app).post('/api/v1/auth/refresh').set('Cookie', phone.cookie).expect(401)
    const blocked = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${phone.accessToken}`)
      .expect(401)
    expect(blocked.body.error.code).toBe('SESSION_REVOKED')
  })
})

describe('POST /auth/password', () => {
  it('changes the password and signs every other device out', async () => {
    await makeUser()
    const laptop = await signIn('+998901112233', PASSWORD, { deviceName: 'Laptop' })
    const phone = await signIn('+998901112233', PASSWORD, { deviceName: 'Phone' })

    await request(app)
      .post('/api/v1/auth/password')
      .set('Authorization', `Bearer ${laptop.accessToken}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'Yangi-Parol-2026!',
        confirmPassword: 'Yangi-Parol-2026!',
      })
      .expect(200)

    // The device that made the change stays signed in; the other does not.
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${laptop.accessToken}`)
      .expect(200)
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${phone.accessToken}`)
      .expect(401)

    await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998901112233', password: 'Yangi-Parol-2026!' })
      .expect(200)
  })

  it('rejects a common password (§8)', async () => {
    await makeUser()
    const { accessToken } = await signIn('+998901112233')

    const response = await request(app)
      .post('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: PASSWORD, newPassword: 'Parol123', confirmPassword: 'Parol123' })
      .expect(400)

    expect(response.body.error.details.newPassword).toContain('passwordTooCommon')
  })

  it('rejects a wrong current password', async () => {
    await makeUser()
    const { accessToken } = await signIn('+998901112233')

    await request(app)
      .post('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'not-the-password',
        newPassword: 'Yangi-Parol-2026!',
        confirmPassword: 'Yangi-Parol-2026!',
      })
      .expect(401)
  })
})

describe('two-factor authentication (§8)', () => {
  async function makeSuperadmin() {
    const secret = generateSecret()
    await User.create({
      fullName: 'Boss',
      phone: '+998900000001',
      passwordHash: await hashPassword(PASSWORD),
      roles: [{ role: 'superadmin' }],
      twoFactor: { enabled: true, secret: encryptField(secret), confirmedAt: new Date() },
    })
    return secret
  }

  it('requires a code once 2FA is enabled', async () => {
    await makeSuperadmin()
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998900000001', password: PASSWORD })
      .expect(401)

    expect(response.body.error.code).toBe('TOTP_REQUIRED')
  })

  it('rejects a wrong code', async () => {
    await makeSuperadmin()
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998900000001', password: PASSWORD, totpCode: '000000' })
      .expect(401)

    expect(response.body.error.code).toBe('TOTP_INVALID')
  })

  it('accepts the current code', async () => {
    const secret = await makeSuperadmin()
    await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998900000001', password: PASSWORD, totpCode: generateTotp(secret) })
      .expect(200)
  })

  it('lets a SuperAdmin sign in with password alone — 2FA is opt-in, not mandatory', async () => {
    await User.create({
      fullName: 'Boss',
      phone: '+998900000002',
      passwordHash: await hashPassword(PASSWORD),
      roles: [{ role: 'superadmin' }],
    })

    const signedIn = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+998900000002', password: PASSWORD })
      .expect(200)

    expect(signedIn.body.data.accessToken).toBeTruthy()
    expect(signedIn.body.data.user.twoFactorEnabled).toBe(false)
  })

})

describe('POST /auth/branch — the switcher (§5.2)', () => {
  it('lets a SuperAdmin switch, and stores the choice server-side', async () => {
    const secret = generateSecret()
    await User.create({
      fullName: 'Boss',
      phone: '+998900000004',
      passwordHash: await hashPassword(PASSWORD),
      roles: [{ role: 'superadmin' }],
      twoFactor: { enabled: true, secret: encryptField(secret), confirmedAt: new Date() },
    })
    const branch = await makeBranch('urganch-2')

    const { accessToken, user } = await signIn('+998900000004', PASSWORD, {
      totpCode: generateTotp(secret),
    })
    // The boss lands on the consolidated view.
    expect(user.activeBranchId).toBe('ALL')

    await request(app)
      .post('/api/v1/auth/branch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ branchId: branch.id })
      .expect(200)

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
    expect(me.body.data.activeBranchId).toBe(branch.id)

    // §5.2 — the selection lives on the session document, not only in a cookie.
    const session = await Session.findById((await Session.findOne({}))!.id)
    expect(session?.activeBranchId?.toString()).toBe(branch.id)
  })

  it('refuses a non-SuperAdmin, who has no switcher at all (§4.2)', async () => {
    await makeUser()
    const other = await makeBranch('urganch-2')
    const { accessToken } = await signIn('+998901112233')

    const response = await request(app)
      .post('/api/v1/auth/branch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ branchId: other.id })
      .expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')
  })
})

describe('POST /auth/logout', () => {
  it('revokes the session and clears the cookie', async () => {
    await makeUser()
    const { cookie, accessToken } = await signIn('+998901112233')

    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(200)

    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401)
    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401)
  })

  it('succeeds even with no session to revoke', async () => {
    await request(app).post('/api/v1/auth/logout').expect(200)
  })
})

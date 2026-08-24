import request from 'supertest'
import type { Express } from 'express'
import type { Role } from '@leader/shared/permissions'
import { User } from '../modules/users/user.model.js'
import { Branch } from '../modules/branches/branch.model.js'
import { hashPassword } from '../modules/auth/password.service.js'
import { generateSecret, generateTotp } from '../modules/auth/totp.service.js'
import { encryptField } from '../config/crypto.js'

/**
 * Test fixtures shared by every route suite.
 *
 * These were copy-pasted into four test files, which meant a change to how a
 * SuperAdmin signs in — TOTP enrolment, say — had to be made four times and was
 * inevitably made three.
 */

export const PASSWORD = 'Xorazm-2026-strong'

let phoneCounter = 0

/** Unique per process, so parallel suites cannot collide on the unique index. */
export function nextPhone(): string {
  return `+9989011${String(phoneCounter++).padStart(5, '0')}`
}

export function resetPhoneCounter() {
  phoneCounter = 0
}

export async function makeBranch(slug = 'urganch-markaz') {
  return Branch.create({ slug, name: { uz: slug } })
}

export type Actor = { phone: string; token: string; id: string }

/**
 * Creates an account and signs it in, returning a usable bearer token.
 *
 * A SuperAdmin is enrolled in TOTP first: 2FA is opt-in since ADR 0002, but
 * exercising the challenge on the account that can read every branch's finance
 * is worth the extra line here.
 */
export async function makeActor(
  app: Express,
  role: Role,
  branchId?: unknown,
  overrides: Record<string, unknown> = {},
): Promise<Actor> {
  const phone = nextPhone()
  const totpSecret = role === 'superadmin' ? generateSecret() : null

  const user = await User.create({
    fullName: `${role} user`,
    phone,
    passwordHash: await hashPassword(PASSWORD),
    roles: [role === 'superadmin' ? { role } : { role, branchId }],
    ...(totpSecret
      ? { twoFactor: { enabled: true, secret: encryptField(totpSecret), confirmedAt: new Date() } }
      : {}),
    ...overrides,
  })

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({
      phone,
      password: PASSWORD,
      ...(totpSecret ? { totpCode: generateTotp(totpSecret) } : {}),
    })
    .expect(200)

  return { phone, token: response.body.data.accessToken as string, id: user.id }
}

/** The Authorization header, spelled once. */
export const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

/**
 * A SuperAdmin's session starts in whatever branch the login picked. Most write
 * routes now carry `requireSingleBranch`, so a test that means to write needs a
 * single branch selected rather than the consolidated `'ALL'` scope.
 */
export async function selectBranch(app: Express, token: string, branchId: string) {
  await request(app)
    .post('/api/v1/auth/branch')
    .set(auth(token))
    .send({ branchId })
    .expect(200)
}

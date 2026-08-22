import { User } from '../modules/users/user.model.js'
import { hashPassword } from '../modules/auth/password.service.js'
import { normalizePhone } from '@leader/shared/schemas'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'

/**
 * TZ §8 — "Staff accounts are created by an administrator; there is no public
 * staff self-registration." Which leaves the question of where the *first*
 * administrator comes from. This does that, once, and only on an empty
 * collection.
 *
 * Nothing is created unless `SEED_SUPERADMIN_PHONE` and
 * `SEED_SUPERADMIN_PASSWORD` are both set: a hard-coded default password on a
 * boss account with access to every branch's finance would be the single worst
 * bug this project could ship.
 *
 * The account is created with `mustChangePassword` set. Sign-in is phone +
 * password: TZ §8 made 2FA mandatory for SuperAdmin, and that requirement was
 * lifted at the client's request — see docs/adr/0002-optional-two-factor.md.
 * Enrolling a second factor from the panel via `POST /auth/2fa/enable` is
 * strongly recommended for an account that can read every branch's finance.
 */
export async function seedSuperadmin(): Promise<boolean> {
  const phone = env.SEED_SUPERADMIN_PHONE
  const password = env.SEED_SUPERADMIN_PASSWORD

  if (!phone || !password) {
    const existing = await User.countDocuments({ 'roles.role': 'superadmin', deletedAt: null })
    if (existing === 0) {
      logger.warn(
        'No SuperAdmin exists and none is configured. Set SEED_SUPERADMIN_PHONE and ' +
          'SEED_SUPERADMIN_PASSWORD, then restart, to create the first account.',
      )
    }
    return false
  }

  const normalizedPhone = normalizePhone(phone)

  if (await User.exists({ phone: normalizedPhone })) return false

  await User.create({
    fullName: 'SuperAdmin',
    phone: normalizedPhone,
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
    roles: [{ role: 'superadmin' }],
    locale: 'uz',
    isActive: true,
  })

  logger.warn(
    { phone: normalizedPhone },
    'Created the bootstrap SuperAdmin. Sign in with the phone and password, change ' +
      'the password, then remove SEED_SUPERADMIN_* from the environment. Enabling 2FA ' +
      'on this account is strongly recommended: it can read every branch finance page.',
  )
  return true
}

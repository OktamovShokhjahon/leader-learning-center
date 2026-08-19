import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import { LoginAttempt } from './lockout.model.js'

/**
 * TZ §8 — brute-force protection: progressive lockout on top of the router's
 * `express-rate-limit`, "tied to phone + IP".
 *
 * Two independent counters:
 *
 * - **`phone|ip`** — the §8 rule verbatim: 5 failures lock for 1 minute, 10 for
 *   15 minutes. This is the one that stops someone at a keyboard.
 * - **`phone`** alone — a much looser 20-failure threshold, so an attacker
 *   spraying one account from many addresses still hits a wall. It is loose on
 *   purpose: a strict phone-only counter would let anyone lock a rival out of
 *   their own account by failing five logins against their number, and a
 *   denial-of-service against the centre's staff is a worse outcome than the
 *   slightly slower guessing this permits.
 *
 * The window is rolling: counters are removed by TTL once they go quiet, so an
 * honest user who mistypes twice today does not start tomorrow at two.
 */
const WINDOW_MS = 15 * 60 * 1000

const TIERS = [
  { failures: 10, lockMs: 15 * 60 * 1000 },
  { failures: 5, lockMs: 60 * 1000 },
] as const

const DISTRIBUTED_TIERS = [
  { failures: 40, lockMs: 60 * 60 * 1000 },
  { failures: 20, lockMs: 15 * 60 * 1000 },
] as const

type Tiers = readonly { failures: number; lockMs: number }[]

function lockDurationFor(failures: number, tiers: Tiers): number {
  return tiers.find((tier) => failures >= tier.failures)?.lockMs ?? 0
}

const keysFor = (phone: string, ip: string | undefined) => [
  { key: `${phone}|${ip ?? 'unknown'}`, tiers: TIERS as Tiers },
  { key: phone, tiers: DISTRIBUTED_TIERS as Tiers },
]

/**
 * Throws `ACCOUNT_LOCKED` when either counter is currently locked.
 *
 * Called *before* the password is checked, so a locked account costs no argon2
 * time — the lockout has to be cheaper than the thing it protects, or it becomes
 * the attack.
 */
export async function assertNotLocked(phone: string, ip: string | undefined): Promise<void> {
  const keys = keysFor(phone, ip).map((entry) => entry.key)
  const locked = await LoginAttempt.findOne({
    key: { $in: keys },
    lockedUntil: { $gt: new Date() },
  })
    .sort({ lockedUntil: -1 })
    .lean()

  if (!locked?.lockedUntil) return

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((locked.lockedUntil.getTime() - Date.now()) / 1000),
  )
  throw new ApiError(
    429,
    ERROR_CODES.ACCOUNT_LOCKED,
    'Too many failed attempts. Try again shortly.',
    { retryAfterSeconds },
  )
}

/** Records a failure against both counters and applies the tier that now matches. */
export async function recordFailure(phone: string, ip: string | undefined): Promise<void> {
  const now = Date.now()

  await Promise.all(
    keysFor(phone, ip).map(async ({ key, tiers }) => {
      const attempt = await LoginAttempt.findOneAndUpdate(
        { key },
        {
          $inc: { failures: 1 },
          $set: { lastFailedAt: new Date(now), expiresAt: new Date(now + WINDOW_MS) },
          $setOnInsert: { firstFailedAt: new Date(now) },
        },
        { upsert: true, new: true },
      )

      const lockMs = lockDurationFor(attempt.failures, tiers)
      if (lockMs === 0) return

      // Only ever extends a lock, never shortens one already in force.
      const lockedUntil = new Date(now + lockMs)
      if (!attempt.lockedUntil || attempt.lockedUntil < lockedUntil) {
        attempt.lockedUntil = lockedUntil
        // The record must outlive the lock it holds, or TTL would free the
        // account early.
        attempt.expiresAt = new Date(lockedUntil.getTime() + WINDOW_MS)
        await attempt.save()
      }
    }),
  )
}

/** A successful login clears the counters for that phone. */
export async function clearFailures(phone: string, ip: string | undefined): Promise<void> {
  await LoginAttempt.deleteMany({ key: { $in: keysFor(phone, ip).map((entry) => entry.key) } })
}

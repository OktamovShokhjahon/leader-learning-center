import { hash, verify } from '@node-rs/argon2'
import { isCommonPassword } from '@leader/shared/common-passwords'
import { ApiError, ERROR_CODES } from '@leader/shared/errors'

/**
 * TZ §8 — "Passwords hashed with argon2id."
 *
 * `@node-rs/argon2` rather than the `argon2` package: it ships prebuilt binaries
 * for every platform the team and CI run on, so `npm install` never needs
 * node-gyp and a Visual Studio toolchain on Windows. Same algorithm, same
 * output format.
 *
 * Parameters follow the OWASP Password Storage Cheat Sheet's argon2id baseline
 * (19 MiB, 2 iterations, parallelism 1). At ~50 ms per hash this is affordable
 * for a login endpoint and expensive for an offline attacker.
 */
/**
 * `Algorithm.Argon2id` is declared as an ambient `const enum`, which
 * `isolatedModules` cannot import, so the value is inlined with the name kept
 * next to it. It is fixed by the argon2 spec and will not move.
 */
const ARGON2ID = 2

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export async function hashPassword(password: string): Promise<string> {
  // Checked here as well as in the zod schema: services are called by the seed
  // script and by future imports, which do not go through request validation.
  if (isCommonPassword(password)) {
    throw new ApiError(400, ERROR_CODES.PASSWORD_TOO_COMMON, 'This password is too easy to guess')
  }
  if (password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters')
  }
  return hash(password, OPTIONS)
}

/**
 * Never throws on a malformed stored hash — a corrupt record must read as
 * "wrong password", not as a 500 that tells an attacker the account exists.
 */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password, OPTIONS)
  } catch {
    return false
  }
}

/**
 * Burns roughly the same time as a real verification.
 *
 * Called when no account matches the phone, so that a request for an unknown
 * number takes as long as one for a known number. Without it, response timing
 * alone enumerates the centre's staff and student phone numbers.
 */
let dummyHash: Promise<string> | null = null

export async function burnPasswordTime(): Promise<void> {
  // Computed on first use rather than at import time, so loading the module
  // (which the test suite does repeatedly) does not cost a hash.
  dummyHash ??= hash('timing-equalisation-placeholder', OPTIONS)
  await verifyPassword(await dummyHash, 'not-the-password')
}

/** PIN codes (§8, PIC 10) get the same treatment — they are short, so this matters more. */
export const hashPin = (pin: string) => hash(pin, OPTIONS)
export const verifyPin = (storedHash: string, pin: string) => verifyPassword(storedHash, pin)

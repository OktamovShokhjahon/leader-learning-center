/**
 * TZ §8 — "Minimum 8 characters, blocked against a common-password list."
 *
 * A deliberately small, high-value list rather than a 100k-entry dump: it is
 * shipped to the browser so the user is told *while typing* that their password
 * is guessable, instead of after a round trip. The API checks the same list, and
 * the real defence against guessing is the progressive lockout in §8.
 *
 * Contents: the most-used passwords worldwide, plus the ones this centre will
 * actually see — keyboard walks, `leader*`, local city and phone fragments.
 * Comparison is case-insensitive and ignores trailing digits, so `Parol123`
 * is caught by the entry `parol`.
 */
export const COMMON_PASSWORDS: readonly string[] = [
  'password',
  'passw0rd',
  'p@ssword',
  'welcome',
  'admin',
  'administrator',
  'superadmin',
  'manager',
  'teacher',
  'student',
  'login',
  'letmein',
  'iloveyou',
  'princess',
  'sunshine',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'master',
  'shadow',
  'michael',
  'jordan',
  'jennifer',
  'hunter',
  'trustno',
  'freedom',
  'whatever',
  'qwerty',
  'qwertyuiop',
  'qazwsx',
  'zxcvbn',
  'zxcvbnm',
  'asdfgh',
  'asdfghjkl',
  'qweasd',
  'qwerty123',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '111111',
  '000000',
  '654321',
  'abc123',
  'abcd1234',
  'a1b2c3',
  // Uzbek / Russian keyboard and language reality of this centre
  'parol',
  'parool',
  'salom',
  'assalom',
  'oquvchi',
  'ustoz',
  'maktab',
  'uzbekistan',
  'ozbekiston',
  'toshkent',
  'urganch',
  'urgench',
  'xorazm',
  'horazm',
  'khorezm',
  'leader',
  'leaderlc',
  'leaderonline',
  'ingliz',
  'english',
  'matematika',
  'privet',
  'lyubov',
  'krasota',
  'rossiya',
  'ytrewq',
  'йцукен',
  'пароль',
  '998998',
  '998901234567',
]

const COMMON_SET = new Set(COMMON_PASSWORDS)

/**
 * True when the password is a known-guessable one.
 *
 * Trailing digits and a trailing `!` are stripped before the lookup, because
 * `Password1!` is exactly as guessable as `password` — appending a digit is the
 * single most predictable way people satisfy a complexity rule.
 */
export function isCommonPassword(password: string): boolean {
  const normalized = password.trim().toLowerCase()
  if (COMMON_SET.has(normalized)) return true

  const stripped = normalized.replace(/[!@#$%^&*_.\-]*\d*[!@#$%^&*_.\-]*$/, '')
  return stripped.length > 0 && COMMON_SET.has(stripped)
}

import { describe, it, expect } from 'vitest'
import {
  base32Encode,
  base32Decode,
  generateSecret,
  generateTotp,
  verifyTotp,
  totpUri,
  generateRecoveryCodes,
} from './totp.service.js'

/**
 * TZ §8 — 2FA is mandatory for the SuperAdmin, the one account with access to
 * every branch's money. This implementation is written here rather than pulled
 * from a package, so it is checked against the RFC's own test vectors: an
 * off-by-one in the time step would lock the boss out of his own system.
 */
describe('TOTP — RFC 6238 test vectors', () => {
  // RFC 6238 Appendix B: the shared secret is the ASCII string
  // "12345678901234567890", which is this in base32.
  const SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'))

  // The RFC tabulates 8-digit codes; the last six of each are what a 6-digit
  // authenticator shows, which is what this implementation produces.
  const VECTORS: [number, string][] = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ]

  it.each(VECTORS)('matches the published code at T=%i', (unixSeconds, expected) => {
    expect(generateTotp(SECRET, new Date(unixSeconds * 1000))).toBe(expected)
  })
})

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = Buffer.from([0x00, 0xff, 0x10, 0x7a, 0x5c, 0x01, 0x93])
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true)
  })

  it('accepts padding and whitespace, as pasted from an authenticator app', () => {
    const secret = generateSecret()
    const spaced = secret.replace(/(.{4})/g, '$1 ')
    expect(base32Decode(spaced).equals(base32Decode(secret))).toBe(true)
  })

  it('rejects a secret containing characters outside the alphabet', () => {
    expect(() => base32Decode('ABC1!')).toThrow(/Invalid base32/)
  })
})

describe('verifyTotp', () => {
  const secret = generateSecret()
  const now = new Date('2026-08-19T10:00:00.000Z')

  it('accepts the current code', () => {
    expect(verifyTotp(secret, generateTotp(secret, now), now)).toBe(true)
  })

  it('accepts one step of clock drift in either direction', () => {
    const previous = new Date(now.getTime() - 30_000)
    const next = new Date(now.getTime() + 30_000)
    expect(verifyTotp(secret, generateTotp(secret, previous), now)).toBe(true)
    expect(verifyTotp(secret, generateTotp(secret, next), now)).toBe(true)
  })

  it('rejects a code two steps out, so a stale code cannot be replayed', () => {
    const stale = new Date(now.getTime() - 90_000)
    expect(verifyTotp(secret, generateTotp(secret, stale), now)).toBe(false)
  })

  it('rejects anything that is not six digits', () => {
    expect(verifyTotp(secret, '12345', now)).toBe(false)
    expect(verifyTotp(secret, '1234567', now)).toBe(false)
    expect(verifyTotp(secret, 'abcdef', now)).toBe(false)
    expect(verifyTotp(secret, '', now)).toBe(false)
  })

  it('rejects a valid code generated from a different secret', () => {
    expect(verifyTotp(secret, generateTotp(generateSecret(), now), now)).toBe(false)
  })
})

describe('enrolment helpers', () => {
  it('generates a 32-character (20-byte) secret', () => {
    expect(generateSecret()).toMatch(/^[A-Z2-7]{32}$/)
  })

  it('builds an otpauth URI an authenticator can scan', () => {
    const secret = generateSecret()
    const uri = new URL(totpUri(secret, '+998901234567'))

    expect(uri.protocol).toBe('otpauth:')
    expect(uri.searchParams.get('secret')).toBe(secret)
    expect(uri.searchParams.get('issuer')).toBe('Leader LC')
    expect(uri.searchParams.get('digits')).toBe('6')
    expect(uri.searchParams.get('period')).toBe('30')
    // The phone must survive as the account label so a user with two accounts
    // can tell them apart in the app.
    expect(decodeURIComponent(uri.pathname)).toContain('+998901234567')
  })

  it('generates distinct recovery codes', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(8)
    expect(new Set(codes).size).toBe(8)
    for (const code of codes) expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/)
  })
})

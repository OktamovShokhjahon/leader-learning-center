import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * TZ §8 — "2FA (TOTP) mandatory for SuperAdmin, optional for Admin."
 *
 * RFC 6238 / RFC 4226 in about eighty lines of `node:crypto`, rather than a
 * dependency. TOTP is a HMAC and a modulo; the libraries that wrap it are mostly
 * base32 plus a QR encoder, and this codebase needs neither at runtime — the
 * client renders the QR from the `otpauth://` URI.
 */
const DIGITS = 6
const PERIOD_SECONDS = 30

/**
 * Accept the neighbouring steps as well as the current one: phone clocks drift,
 * and a code typed at second 29 arrives in the next window. ±1 step is the
 * standard tolerance — a 90-second acceptance band.
 */
const DRIFT_STEPS = 1

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]

  return output
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character)
    if (index === -1) throw new Error('Invalid base32 character in TOTP secret')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

/** 20 bytes — the RFC 4226 recommended shared-secret length for HMAC-SHA1. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20))
}

function hotp(secret: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))

  const digest = createHmac('sha1', secret).update(buffer).digest()
  // RFC 4226 §5.3 dynamic truncation. A SHA-1 digest is always 20 bytes, so the
  // offset and the four bytes it selects are always in range.
  const offset = digest.readUInt8(digest.length - 1) & 0x0f
  const binary = digest.readUInt32BE(offset) & 0x7fffffff

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0')
}

export function generateTotp(secretBase32: string, at: Date = new Date()): string {
  const counter = Math.floor(at.getTime() / 1000 / PERIOD_SECONDS)
  return hotp(base32Decode(secretBase32), counter)
}

/**
 * Constant-time comparison across the accepted window.
 *
 * Every candidate step is compared even after a match, so the time taken does
 * not reveal *which* step matched — that would leak the client's clock offset.
 */
export function verifyTotp(secretBase32: string, code: string, at: Date = new Date()): boolean {
  if (!/^\d{6}$/.test(code)) return false

  const secret = base32Decode(secretBase32)
  const currentStep = Math.floor(at.getTime() / 1000 / PERIOD_SECONDS)
  const supplied = Buffer.from(code)
  let matched = false

  for (let offset = -DRIFT_STEPS; offset <= DRIFT_STEPS; offset += 1) {
    const candidate = Buffer.from(hotp(secret, currentStep + offset))
    if (candidate.length === supplied.length && timingSafeEqual(candidate, supplied)) matched = true
  }

  return matched
}

/** The `otpauth://` URI an authenticator app scans. */
export function totpUri(secretBase32: string, accountName: string, issuer = 'Leader LC'): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`)
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/**
 * Single-use recovery codes, handed over once when 2FA is enabled.
 *
 * Without these, a SuperAdmin who loses their phone loses the only account that
 * can restore anyone else's access — and §8 makes 2FA mandatory for exactly that
 * account.
 */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(10)).slice(0, 10)
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
}

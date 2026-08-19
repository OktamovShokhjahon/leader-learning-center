import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { env } from './env.js'

/**
 * TZ §8 — "the student's `passportSeries` field is optional and encrypted at
 * rest". The same primitive protects TOTP secrets, which are password-equivalent:
 * a leaked database must not hand over anyone's second factor.
 *
 * AES-256-GCM. The stored string is `v1.<iv>.<tag>.<ciphertext>`, all base64url.
 * The version prefix exists so a future key rotation can decrypt old values
 * while writing new ones.
 */
const KEY = Buffer.from(env.encryptionKey, 'hex')
const IV_BYTES = 12
const VERSION = 'v1'

export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')
}

export function decryptField(stored: string): string {
  const [version, iv, tag, ciphertext] = stored.split('.')
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Encrypted field is malformed or was written with an unknown key version')
  }
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * Refresh tokens and OTP codes are stored as a SHA-256 digest rather than in
 * clear. They are high-entropy random values, so a fast hash is right here —
 * argon2 is for passwords, which are not.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 32 bytes of entropy, URL-safe — used for refresh tokens and one-time links. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** Constant-time compare for anything secret; falls back safely on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'

/**
 * TZ §26.1 — env is zod-validated at boot. A missing or malformed variable
 * fails the process immediately with a readable message rather than surfacing
 * as an undefined at 3 a.m.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Mongo must be a replica set — payment/invoice writes run in transactions (§26.4). */
  MONGO_URL: z.string().url().optional(),
  /**
   * Dev convenience: spin up an in-memory replica set when no MONGO_URL is
   * configured. Never enabled in production.
   */
  USE_MEMORY_DB: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  REDIS_URL: z.string().url().optional(),

  /** Comma-separated list of origins allowed to call the API. */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // ── §8 authentication ──────────────────────────────────────────────────────
  /** Signs the 15-minute access token. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  /** §8 — refresh cookie lives 30 days and is rotated on every use. */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Set in production so the refresh cookie is shared across api. and www. */
  COOKIE_DOMAIN: z.string().optional(),
  /**
   * AES-256-GCM key (64 hex chars) for the fields §8 requires to be encrypted at
   * rest: TOTP secrets and, later, `students.passportSeries`.
   */
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-f\d]{64}$/i, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
    .optional(),

  /**
   * Dev-only escape hatch: accept payments on a standalone mongod, without the
   * transaction TZ §26.4 requires. Refused in production.
   */
  ALLOW_NON_TRANSACTIONAL_PAYMENTS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  /** Bootstrap SuperAdmin, seeded once on an empty database. */
  SEED_SUPERADMIN_PHONE: z.string().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  · ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment configuration:\n${issues}`)
}

const isProduction = parsed.data.NODE_ENV === 'production'

/**
 * Outside production a missing secret is generated per boot rather than
 * hard-failing, so `npm run dev:api` and the test suite work from a bare
 * checkout. The cost is that every restart invalidates existing tokens, which is
 * the correct trade-off for a dev machine and unacceptable in production —
 * hence the hard check below.
 */
function requiredSecret(name: string, value: string | undefined, bytes: number): string {
  if (value) return value
  if (isProduction) {
    throw new Error(
      `${name} is required in production. Generate one with:\n` +
        `  node -e "console.log(require('crypto').randomBytes(${bytes}).toString('hex'))"`,
    )
  }
  return randomBytes(bytes).toString('hex')
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  isProduction,
  isTest: parsed.data.NODE_ENV === 'test',
  jwtSecret: requiredSecret('JWT_SECRET', parsed.data.JWT_SECRET, 32),
  encryptionKey: requiredSecret('ENCRYPTION_KEY', parsed.data.ENCRYPTION_KEY, 32),
}

if (env.isProduction && env.USE_MEMORY_DB) {
  throw new Error('USE_MEMORY_DB must not be enabled in production')
}

import 'dotenv/config'
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
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  · ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment configuration:\n${issues}`)
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
}

if (env.isProduction && env.USE_MEMORY_DB) {
  throw new Error('USE_MEMORY_DB must not be enabled in production')
}

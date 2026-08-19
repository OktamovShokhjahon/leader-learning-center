import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'

/**
 * TZ §8 — "progressive lockout (5 failures → 1 min, 10 → 15 min, tied to phone + IP)".
 *
 * Kept in Mongo rather than Redis because Redis is optional in this deployment
 * (`REDIS_URL` is not required) and a lockout that evaporates on a cache restart
 * is not a lockout. The write volume is trivial: one document per failing
 * phone+IP pair, removed by TTL once it goes cold.
 */
const loginAttemptSchema = new Schema(
  {
    /** Either `phone|ip` or `phone` — see the two keys in lockout.service.ts. */
    key: { type: String, required: true, unique: true, index: true },
    failures: { type: Number, default: 0 },
    firstFailedAt: { type: Date, default: Date.now },
    lastFailedAt: { type: Date, default: Date.now },
    lockedUntil: Date,
    /** TTL anchor; pushed forward on each failure so an active attack stays tracked. */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false },
)

loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type LoginAttemptDocument = HydratedDocument<InferSchemaType<typeof loginAttemptSchema>>
export const LoginAttempt = model('LoginAttempt', loginAttemptSchema)

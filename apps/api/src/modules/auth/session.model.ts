import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'

/**
 * TZ §8 — one document per logged-in device.
 *
 * This is both the "Faol qurilmalar" list (PIC 10) and the refresh-token family.
 * A refresh token is an opaque 32-byte random value; only its SHA-256 digest is
 * stored, so a database leak cannot be replayed as a login.
 *
 * **Rotation and reuse detection.** Every refresh swaps `tokenHash` for a new
 * one and pushes the old digest onto `usedTokenHashes`. Presenting a digest from
 * that list means the token was captured and replayed after the legitimate
 * client already rotated it, so the entire family is revoked immediately (§8).
 *
 * It also carries the active branch (§5.2): the branch switcher writes here, not
 * only into a cookie, so an API call cannot be pointed at another branch by
 * editing anything the browser holds.
 */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    /**
     * Capped in the service to the last 10 rotations. Older digests are dropped:
     * a token that stale is long past its 30-day expiry, so it can no longer be
     * presented, and keeping every digest forever would grow the document without
     * bound on a device that refreshes every 15 minutes.
     */
    usedTokenHashes: { type: [String], default: [], index: true },

    /** §5.2 — the branch this session is looking at; `'ALL'` is SuperAdmin-only. */
    activeBranchId: { type: Schema.Types.Mixed, default: null },

    deviceName: String,
    userAgent: String,
    ip: String,
    /** Bumped on every refresh so the sessions list can show "last used". */
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokedReason: {
      type: String,
      enum: [
        'logout',
        'reuse_detected',
        'revoked_by_user',
        'password_changed',
        'account_disabled',
        'role_changed',
      ],
    },
  },
  { timestamps: true },
)

/**
 * Mongo removes the document itself once it is a day past expiry. The one-day
 * grace keeps a just-expired session visible long enough to explain to the user
 * why they were signed out.
 */
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 })
sessionSchema.index({ userId: 1, revokedAt: 1 })

export type SessionDocument = HydratedDocument<InferSchemaType<typeof sessionSchema>>
export const Session = model('Session', sessionSchema)

export function isSessionUsable(session: SessionDocument | null): session is SessionDocument {
  if (!session) return false
  if (session.revokedAt) return false
  return session.expiresAt.getTime() > Date.now()
}

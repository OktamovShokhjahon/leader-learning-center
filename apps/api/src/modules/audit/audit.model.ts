import { Schema, model, type InferSchemaType } from 'mongoose'
import { ROLES } from '@leader/shared/permissions'

/**
 * TZ §21.3 / §22 — `auditLogs`.
 *
 * Deliberately not branch-scoped by the plugin: `branchId` is nullable here
 * (an account-level event such as a password change belongs to no branch), and
 * §4.2 note 9 restricts an Admin to their own branch's entries at the *query*
 * level, which the service does explicitly so the restriction is visible.
 *
 * Append-only by contract: nothing in the codebase updates or deletes an entry.
 */
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    /** Denormalised so the log still reads correctly after a role change. */
    role: { type: String, enum: ROLES },
    actorName: String,
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },

    /** Dotted verb, e.g. `auth.login`, `student.update`, `payment.refund`. */
    action: { type: String, required: true, index: true },
    entity: String,
    entityId: { type: Schema.Types.ObjectId },

    /**
     * The request path, for events that are about a *route* rather than a
     * document — §21.3's "any 403 on a finance endpoint" being the reason this
     * exists. Those have no entity id to record, and forcing a URL into
     * `entityId` silently fails its ObjectId cast.
     */
    path: String,

    /** Only the changed fields, never a whole document — see `diff()`. */
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,

    ip: String,
    userAgent: String,
    /** Set when the action failed, e.g. a rejected login. */
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    reason: String,

    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
)

// §22 index list: auditLogs(entity, entityId, at)
auditLogSchema.index({ entity: 1, entityId: 1, at: -1 })
auditLogSchema.index({ branchId: 1, at: -1 })

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>
export const AuditLog = model('AuditLog', auditLogSchema)

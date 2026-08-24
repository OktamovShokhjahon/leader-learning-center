import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'

/**
 * TZ §22 — `settings`.
 *
 * Deliberately **not** branch-scoped by the plugin. A branch override and the
 * centre-wide default live in the same collection and are read together by
 * `resolveSetting`; letting the plugin filter one of them out would make the
 * cascade silently return the default whenever a branch was selected.
 *
 * `value` is `Mixed` because the registry in `@leader/shared/settings` owns the
 * shape — a number here, an array of dates there — and validation happens at
 * the service boundary against that key's zod schema, not at the collection.
 */
const settingSchema = new Schema(
  {
    key: { type: String, required: true, index: true },
    /** Absent for a centre-wide value; set for a per-branch override. */
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    value: { type: Schema.Types.Mixed },

    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

// One row per key per branch; the global row is the one with a null branchId.
settingSchema.index({ key: 1, branchId: 1 }, { unique: true })

export type SettingDocument = HydratedDocument<InferSchemaType<typeof settingSchema>>
export const Setting = model('Setting', settingSchema)

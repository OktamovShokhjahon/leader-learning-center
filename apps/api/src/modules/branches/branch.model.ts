import { Schema, model, type InferSchemaType } from 'mongoose'
import { LOCALES } from '@leader/shared/locales'

/**
 * TZ §5.3 / §22 — `branches`.
 *
 * Branches are deliberately NOT branch-scoped: they are the scope. Full CRUD,
 * the branch switcher and per-branch settings land in Phase 1.
 */
const localizedString = {
  uz: { type: String, required: true },
  ru: String,
  en: String,
}

const branchSchema = new Schema(
  {
    name: { type: localizedString, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    city: localizedString,
    address: localizedString,
    workingHours: localizedString,
    phones: { type: [String], default: [] },
    email: String,
    /** §5.2 — hue offset from the signature gradient, so the boss recognises the branch. */
    accentHue: { type: Number, default: 0 },
    logo: String,
    coverPhoto: String,
    geo: { lat: Number, lng: Number },
    currency: { type: String, default: 'UZS' },
    timezone: { type: String, default: 'Asia/Tashkent' },
    /** §5.3 — the financial year runs September → August, per the Молия sheet. */
    financialYearStart: { type: Number, default: 9, min: 1, max: 12 },
    defaultLocale: { type: String, enum: LOCALES, default: 'uz' },
    settings: {
      discountCeilingPercent: { type: Number, default: 20 },
      expenseApprovalCeiling: Number,
      overdueGraceDays: { type: Number, default: 3 },
    },
    isActive: { type: Boolean, default: true },
    openedAt: Date,

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

export type BranchDocument = InferSchemaType<typeof branchSchema>
export const Branch = model('Branch', branchSchema)

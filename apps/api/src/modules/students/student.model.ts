import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { STUDENT_STATUSES, DROP_REASONS, GENDERS } from '@leader/shared/schemas'
import { branchScopePlugin } from '../../middleware/branch-scope.js'

/**
 * TZ §22 — `students`, derived from the workbook columns (`F.I`, `Telefon`,
 * `Status`, `Kelgan sanasi`, `Sinf`, `Yosh`, `Chek`).
 *
 * `branchId` is required and indexed, and the branch-scope plugin filters every
 * read by it (§5.1). A student always belongs to exactly one branch; a transfer
 * moves them and is recorded in the audit log.
 */
/**
 * A4 — a freeze is a record (from/to/amount/reason), not a bare status flip,
 * so it can be shown in payment history and auto-reversed on `toDate`.
 * Append-only, mirroring the `Payment` ledger's immutability: unfreezing
 * early sets `unfrozenAt` rather than deleting the row.
 */
const freezePeriodSchema = new Schema(
  {
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    amount: Number,
    reason: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    unfrozenAt: Date,
  },
  { timestamps: true },
)

const studentSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    /** Set when the student (or parent) has a login for the cabinet. */
    userId: { type: Schema.Types.ObjectId, ref: 'User' },

    fullName: { type: String, required: true, trim: true },
    photo: String,
    birthDate: Date,
    gender: { type: String, enum: GENDERS },
    schoolClass: String,
    age: Number,
    address: String,

    phone: { type: String, index: true },
    parentName: String,
    parentPhone: String,
    telegramId: String,

    status: { type: String, enum: STUDENT_STATUSES, default: 'pending', index: true },
    /** §9.1 — `dropped` is useless for the churn report without a cause. */
    dropReason: { type: String, enum: DROP_REASONS },
    level: String,
    joinedAt: { type: Date, default: Date.now },
    source: String,

    /** §26.4 — whole so'm. `Chek` in the workbook. */
    monthlyFee: { type: Number, default: 0, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    /**
     * §11.2 — an overpayment lands here and is applied to the next invoice.
     * Never negative: debt is derived from unpaid invoices, not from a balance.
     */
    balance: { type: Number, default: 0, min: 0 },

    notes: String,
    documents: { type: [{ name: String, url: String, uploadedAt: Date }], default: [] },
    /** A4 — history of freeze periods; the active one is the last with no `unfrozenAt`. */
    freezePeriods: { type: [freezePeriodSchema], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// §22 index list
studentSchema.index({ branchId: 1, status: 1 })
studentSchema.index({ fullName: 'text' })

studentSchema.plugin(branchScopePlugin)

export type StudentDocument = HydratedDocument<InferSchemaType<typeof studentSchema>>
export const Student = model('Student', studentSchema)

/** §11.1 — frozen and completed students generate no invoices. */
export function isBillable(status: string): boolean {
  return status !== 'frozen' && status !== 'completed' && status !== 'dropped'
}

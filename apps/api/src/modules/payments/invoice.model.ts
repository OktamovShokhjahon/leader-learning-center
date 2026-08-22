import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { INVOICE_STATUSES, PAYMENT_METHODS } from '@leader/shared/schemas'
import { branchScopePlugin } from '../../middleware/branch-scope.js'

/**
 * TZ §22 — `invoices`. Replaces the `1-oy … 8-oy` columns of the workbook.
 *
 * Every amount is a whole number of so'm (§26.4). `finalAmount` is stored rather
 * than derived so a later change to a discount rule cannot silently rewrite what
 * a student was actually billed.
 */
const invoiceItemSchema = new Schema(
  {
    /** §12.2 — a fine is a separate line, never merged into the course fee. */
    type: { type: String, enum: ['tuition', 'fine', 'other'], required: true },
    refId: Schema.Types.ObjectId,
    label: String,
    amount: { type: Number, required: true },
  },
  { _id: false },
)

const invoiceSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    /** `YYYY-MM` (§11.1). */
    period: { type: String, required: true, index: true },

    items: { type: [invoiceItemSchema], default: [] },
    amount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },

    dueDate: { type: Date, required: true, index: true },
    status: { type: String, enum: INVOICE_STATUSES, default: 'pending', index: true },
    paidAt: Date,

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// §22 — one invoice per student per period; the guard against a double run.
invoiceSchema.index({ studentId: 1, groupId: 1, period: 1 }, { unique: true })
invoiceSchema.index({ branchId: 1, status: 1, dueDate: 1 })

invoiceSchema.plugin(branchScopePlugin)

export type InvoiceDocument = HydratedDocument<InferSchemaType<typeof invoiceSchema>>
export const Invoice = model('Invoice', invoiceSchema)

/**
 * §11.1 — "status = overdue when now > dueDate && paidAmount < finalAmount".
 * Grace days are a branch setting; the caller passes the already-shifted date.
 */
export function deriveStatus(
  finalAmount: number,
  paidAmount: number,
  dueDate: Date,
  now: Date,
): (typeof INVOICE_STATUSES)[number] {
  if (paidAmount >= finalAmount) return 'paid'
  if (now > dueDate) return 'overdue'
  return paidAmount > 0 ? 'partial' : 'pending'
}

/**
 * TZ §22 — `payments`.
 *
 * §11.2: "Payments are immutable. A mistake is corrected by a refund or
 * correction document that references the original — never by editing or
 * deleting. This is what makes the money history trustworthy."
 */
const paymentSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },

    amount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    providerTxnId: String,

    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receivedAt: { type: Date, default: Date.now, index: true },
    /** Sequential per branch, for the printed receipt (§11.2). */
    receiptNo: { type: String, index: true },
    note: String,

    /**
     * The client's rule: an Admin approves payments without seeing the centre's
     * finances.
     *
     * A payment taken at the desk lands `pending` and is counted as money in
     * only once approved — so `approvalStatus` gates revenue, while §15's
     * totals stay behind the SuperAdmin-only finance router. `approvedBy` is
     * kept separate from `receivedBy` so the two-person trail survives.
     */
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectedReason: String,

    /** A refund is its own document pointing at the payment it reverses. */
    isRefund: { type: Boolean, default: false },
    refundOf: { type: Schema.Types.ObjectId, ref: 'Payment' },
    refundReason: String,

    /**
     * §26.4 — idempotency. A unique sparse index means a replayed request with
     * the same key cannot create a second payment, which is what stops a
     * double-tapped button taking the money twice.
     */
    idempotencyKey: { type: String, index: true, sparse: true, unique: true },
  },
  { timestamps: true },
)

paymentSchema.index({ branchId: 1, receivedAt: -1 })
paymentSchema.plugin(branchScopePlugin)

export type PaymentDocument = HydratedDocument<InferSchemaType<typeof paymentSchema>>
export const Payment = model('Payment', paymentSchema)

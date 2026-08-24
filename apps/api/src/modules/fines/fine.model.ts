import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import {
  FINE_TARGETS,
  FINE_STATUSES,
  FINE_TRIGGERS,
  SALARY_SCHEMES,
  PAYROLL_STATUSES,
} from '@leader/shared/schemas'
import { branchScopePlugin } from '../../middleware/branch-scope.js'

/**
 * TZ §22 — `fineRules`, `fines`, plus `salarySchemes` and `payrolls` from §14.
 *
 * Fines and payroll live in one file because they are two halves of the same
 * arithmetic: an employee fine is a payroll deduction, and separating them into
 * modules that import each other's models buys nothing.
 */

/* ── Fine rules (§12.1) ───────────────────────────────────────────────── */

const fineRuleSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    name: { uz: { type: String, required: true }, ru: String, en: String },
    targetType: { type: String, enum: FINE_TARGETS, required: true },
    trigger: { type: String, enum: FINE_TRIGGERS, required: true },
    mode: { type: String, enum: ['fixed', 'percent'], default: 'fixed' },
    amount: { type: Number, required: true, min: 0 },
    threshold: { type: Number, default: 1, min: 1 },
    gracePeriodDays: { type: Number, default: 0, min: 0 },
    /**
     * §12 — "Each rule can be switched off; nothing fires automatically unless
     * the SuperAdmin enables it." So it starts off, deliberately.
     */
    isActive: { type: Boolean, default: false },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

fineRuleSchema.plugin(branchScopePlugin)
export type FineRuleDocument = HydratedDocument<InferSchemaType<typeof fineRuleSchema>>
export const FineRule = model('FineRule', fineRuleSchema)

/* ── Fines (§12.1) ────────────────────────────────────────────────────── */

const fineSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    targetType: { type: String, enum: FINE_TARGETS, required: true },
    /** A `Student` id or a `User` id, depending on `targetType`. */
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    /** Null for a manual fine (§12.1). */
    ruleId: { type: Schema.Types.ObjectId, ref: 'FineRule' },

    amount: { type: Number, required: true, min: 1 },
    /** §12.1 — "free text, required for manual". */
    reason: { type: String, required: true },
    evidenceUrl: String,

    status: { type: String, enum: FINE_STATUSES, default: 'issued', index: true },
    /** A student fine becomes an invoice line; an employee fine a payslip deduction. */
    appliedTo: { type: String, enum: ['invoice', 'payroll'] },
    /** Set once it has actually landed there, so it is never applied twice. */
    appliedRefId: { type: Schema.Types.ObjectId },
    appliedAt: Date,

    /** §12.4 — an appeal is a first-class state, not a comment. */
    appeal: {
      at: Date,
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      text: String,
      decidedAt: Date,
      decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      outcome: { type: String, enum: ['upheld', 'waived'] },
    },

    cancelledReason: String,
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

fineSchema.index({ branchId: 1, targetType: 1, targetId: 1, createdAt: -1 })
fineSchema.index({ branchId: 1, status: 1 })
fineSchema.plugin(branchScopePlugin)

export type FineDocument = HydratedDocument<InferSchemaType<typeof fineSchema>>
export const Fine = model('Fine', fineSchema)

/* ── Salary schemes (§14.1) ───────────────────────────────────────────── */

const salarySchemeSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scheme: { type: String, enum: SALARY_SCHEMES, required: true },
    baseAmount: { type: Number, default: 0 },
    /** Overrides the group's `teacherShare` when set (§14.1). */
    share: Number,
    rate: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

salarySchemeSchema.index({ userId: 1, branchId: 1 }, { unique: true })
salarySchemeSchema.plugin(branchScopePlugin)

export type SalarySchemeDocument = HydratedDocument<InferSchemaType<typeof salarySchemeSchema>>
export const SalaryScheme = model('SalaryScheme', salarySchemeSchema)

/* ── Payroll (§14.2) ──────────────────────────────────────────────────── */

const payrollSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** `YYYY-MM`, the same key invoices use. */
    period: { type: String, required: true, index: true },

    scheme: { type: String, enum: SALARY_SCHEMES, required: true },
    /**
     * §30.7 — "a percentage-based teacher's figure is traceable to the exact
     * collected payments that produced it". These are those payments, kept as
     * ids rather than a total, so the trace survives a later correction.
     */
    basis: {
      collectedTotal: { type: Number, default: 0 },
      paymentIds: { type: [Schema.Types.ObjectId], default: [] },
      lessonsTaught: { type: Number, default: 0 },
      activeStudents: { type: Number, default: 0 },
      share: Number,
    },

    gross: { type: Number, default: 0 },
    /** Employee fines (§12.3), itemised so the payslip can show them. */
    deductions: {
      type: [
        {
          _id: false,
          fineId: { type: Schema.Types.ObjectId, ref: 'Fine' },
          label: String,
          amount: Number,
        },
      ],
      default: [],
    },
    net: { type: Number, default: 0 },

    status: { type: String, enum: PAYROLL_STATUSES, default: 'draft', index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    paidAt: Date,
    /** The `Oylik` expense this run generated, so the books reconcile (§13.2). */
    expenseId: { type: Schema.Types.ObjectId, ref: 'Expense' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// One payslip per person per period — the guard against a double run.
payrollSchema.index({ userId: 1, period: 1, branchId: 1 }, { unique: true })
payrollSchema.plugin(branchScopePlugin)

export type PayrollDocument = HydratedDocument<InferSchemaType<typeof payrollSchema>>
export const Payroll = model('Payroll', payrollSchema)

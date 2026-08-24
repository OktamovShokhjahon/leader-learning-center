import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { EXPENSE_STATUSES } from '@leader/shared/schemas'
import { branchScopePlugin } from '../../middleware/branch-scope.js'

/**
 * TZ §22 — `expenseCategories` and `expenses`, implementing §13.
 *
 * Both are branch-scoped: an expense belongs to the branch that incurred it, and
 * a category can carry a per-branch budget. That is what makes
 * `GET /expenses/summary?groupBy=branch` a cross-branch report a SuperAdmin runs
 * deliberately, rather than something every query leaks by accident.
 */

const expenseCategorySchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    slug: { type: String, required: true },
    name: {
      uz: { type: String, required: true },
      ru: String,
      en: String,
    },
    /** A lucide icon name — §13.1 wants "large icon tiles, not a dropdown". */
    icon: { type: String, default: 'circle-ellipsis' },
    color: { type: String, default: '#6E7B8B' },
    /** §13.2 — "sub-categories one level deep", so no recursion to worry about. */
    parentId: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory' },

    /** §4.2 note 5 — a Manager may only spend from a petty category. */
    petty: { type: Boolean, default: false },
    /** §13.2 — `Oylik` is generated from payroll, never entered by hand. */
    payrollOnly: { type: Boolean, default: false },
    monthlyBudget: Number,

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

expenseCategorySchema.index({ branchId: 1, slug: 1 }, { unique: true })
expenseCategorySchema.plugin(branchScopePlugin)

export type ExpenseCategoryDocument = HydratedDocument<
  InferSchemaType<typeof expenseCategorySchema>
>
export const ExpenseCategory = model('ExpenseCategory', expenseCategorySchema)

const expenseSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true, index: true },

    /** §26.4 — whole so'm, never a float. */
    amount: { type: Number, required: true, min: 1 },
    spentAt: { type: Date, required: true, default: Date.now, index: true },
    comment: String,
    vendor: String,
    receiptUrl: String,

    status: { type: String, enum: EXPENSE_STATUSES, default: 'approved', index: true },
    /** §13.3 — a recurring expense seeds a draft each period. */
    recurring: {
      type: String,
      enum: ['none', 'monthly', 'quarterly', 'yearly'],
      default: 'none',
    },
    /** Set on a row generated from a recurring template, pointing at its parent. */
    recurringOf: { type: Schema.Types.ObjectId, ref: 'Expense' },

    /** §13.3 / §4.2 note 6 — above the ceiling this waits for the boss. */
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectedReason: String,

    /** Set when payroll generated this row, so it is never double-counted. */
    payrollId: { type: Schema.Types.ObjectId, ref: 'Payroll' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// The three questions §13.3 asks: what did this branch spend, on what, and when.
expenseSchema.index({ branchId: 1, spentAt: -1 })
expenseSchema.index({ branchId: 1, categoryId: 1, spentAt: -1 })
expenseSchema.index({ branchId: 1, status: 1 })

expenseSchema.plugin(branchScopePlugin)

export type ExpenseDocument = HydratedDocument<InferSchemaType<typeof expenseSchema>>
export const Expense = model('Expense', expenseSchema)

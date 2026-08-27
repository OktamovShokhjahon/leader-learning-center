/**
 * TZ §11 — invoices, payments and the qarzdor list.
 *
 * Every amount here is a whole number of so'm (§26.4). Nothing in this file
 * accepts a float, because a float is how money quietly goes missing.
 */
import { z } from 'zod'
import { objectIdSchema, paginationSchema } from './common.js'

/** §11.1 — `pending → partial → paid / overdue / cancelled`. */
export const INVOICE_STATUSES = ['pending', 'partial', 'paid', 'overdue', 'cancelled'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

/**
 * §11.2 — the payment methods the front desk actually uses.
 *
 * ⚠️ The workbook marks payments `к` / `б` in the monthly columns and the client
 * has not yet said what those stand for (§31 Q1). Until they do, the importer
 * cannot map historical rows onto this list.
 */
export const PAYMENT_METHODS = ['naqd', 'plastik', 'bank', 'payme', 'click', 'uzum'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** `YYYY-MM` — the billing period (§11.1). */
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'invalidPeriod')

export const generateInvoicesSchema = z.object({
  period: periodSchema,
  /** Preview the run without writing anything — the safe default for a boss. */
  dryRun: z.boolean().default(false),
})

export const invoiceQuerySchema = paginationSchema.extend({
  status: z.enum(INVOICE_STATUSES).optional(),
  studentId: objectIdSchema.optional(),
  groupId: objectIdSchema.optional(),
  period: periodSchema.optional(),
})

/**
 * §11.2 — accepting a payment. Partial payments are allowed and the balance
 * stays visible as debt; an overpayment lands on the student's balance and is
 * applied to the next invoice.
 */
export const acceptPaymentSchema = z.object({
  studentId: objectIdSchema,
  /** Omitted means "apply to the oldest unpaid invoice". */
  invoiceId: objectIdSchema.optional(),
  amount: z.coerce.number().int().min(1, 'amountTooLow'),
  method: z.enum(PAYMENT_METHODS),
  note: z.string().trim().max(300).optional(),
  /**
   * §26.4 — an idempotency key so a double-tapped "Accept" button cannot take
   * the same money twice.
   */
  idempotencyKey: z.string().trim().min(8).max(64).optional(),
})
export type AcceptPaymentInput = z.input<typeof acceptPaymentSchema>

/** §11.2 — payments are immutable; a mistake is corrected by a refund document. */
export const refundPaymentSchema = z.object({
  reason: z.string().trim().min(5, 'reasonTooShort').max(300),
  /** Omitted refunds the whole payment. */
  amount: z.coerce.number().int().min(1).optional(),
})

export const paymentQuerySchema = paginationSchema.extend({
  studentId: objectIdSchema.optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

/** §11.3 — the qarzdorlar page. */
export const debtorQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
  courseId: objectIdSchema.optional(),
  groupId: objectIdSchema.optional(),
  teacherId: objectIdSchema.optional(),
  /** §11.3 colour bands: 1–3, 4–10, 10+ days overdue. */
  minDaysOverdue: z.coerce.number().int().min(0).optional(),
  /** "Kurs puli to'lamaganlar" — nothing paid at all this period, not merely short. */
  unpaidOnly: z.coerce.boolean().optional(),
})

export const setFeeSchema = z.object({
  monthlyFee: z.coerce.number().int().min(0),
  discountPercent: z.coerce.number().int().min(0).max(100).optional(),
})

/** §15.1 — the finance dashboard's period selector. */
export const financeQuerySchema = z.object({
  /** Defaults to the current month on the server. */
  period: periodSchema.optional(),
  /** §15.2 — the financial year runs September → August. */
  year: z.coerce.number().int().min(2018).max(2100).optional(),
})

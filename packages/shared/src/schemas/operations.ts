import { z } from 'zod'
import { paginationSchema, objectIdSchema, localizedSchema, slugSchema } from './common.js'

/**
 * TZ §12 (jarima) and §13 (harajat) — fines and expenses.
 *
 * Both are money, so both are integer so'm end to end (§26.4). Both are also
 * things the client asked for by name in their own words, so the vocabulary
 * here stays theirs: `jarima`, `harajat`, `Oylik`, `Arenda`.
 */

/* ── Expenses (§13) ───────────────────────────────────────────────────── */

/** §13.2, seeded from the centre's real spending. */
export const EXPENSE_CATEGORY_SEED = [
  { slug: 'arenda', uz: 'Arenda', ru: 'Аренда', icon: 'building', color: '#8B5E3C' },
  { slug: 'oylik', uz: 'Oylik', ru: 'Зарплата', icon: 'wallet', color: '#2F6F6B', payroll: true },
  { slug: 'kommunal', uz: 'Kommunal', ru: 'Коммунальные', icon: 'zap', color: '#C7761F' },
  { slug: 'reklama', uz: 'Reklama / Instagram', ru: 'Реклама', icon: 'megaphone', color: '#B4436C' },
  { slug: 'kanselyariya', uz: 'Kanselyariya', ru: 'Канцелярия', icon: 'pencil', color: '#4A6FA5', petty: true },
  { slug: 'jihoz', uz: 'Jihoz', ru: 'Оборудование', icon: 'monitor', color: '#5B5F97' },
  { slug: 'tamirlash', uz: "Ta'mirlash", ru: 'Ремонт', icon: 'hammer', color: '#8A6D3B' },
  { slug: 'transport', uz: 'Transport', ru: 'Транспорт', icon: 'car', color: '#3D7A5A', petty: true },
  { slug: 'soliq', uz: 'Soliq', ru: 'Налоги', icon: 'landmark', color: '#6B4E71' },
  { slug: 'mehmondorchilik', uz: 'Mehmondorchilik', ru: 'Гостеприимство', icon: 'coffee', color: '#A0522D', petty: true },
  { slug: 'tadbirlar', uz: 'Tadbirlar', ru: 'Мероприятия', icon: 'party-popper', color: '#C2185B' },
  { slug: 'boshqa', uz: 'Boshqa', ru: 'Прочее', icon: 'circle-ellipsis', color: '#6E7B8B' },
] as const

export const EXPENSE_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected'] as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]

export const createExpenseCategorySchema = z.object({
  slug: slugSchema,
  name: localizedSchema,
  icon: z.string().trim().max(40).default('circle-ellipsis'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'invalidColor')
    .default('#6E7B8B'),
  parentId: objectIdSchema.optional(),
  /** §4.2 note 5 — a Manager may only spend from a petty category. */
  petty: z.boolean().default(false),
  /** `Oylik` is generated from payroll, never entered by hand (§13.2). */
  payrollOnly: z.boolean().default(false),
  monthlyBudget: z.coerce.number().int().min(0).optional(),
})
export const updateExpenseCategorySchema = createExpenseCategorySchema.partial()

/**
 * §13.1 — "exactly four required fields … under 10 seconds to record an
 * expense". Anything beyond amount, category, date and a note is optional, and
 * that constraint is expressed here so no UI can quietly add a fifth.
 */
export const createExpenseSchema = z.object({
  amount: z.coerce.number().int().min(1, 'amountRequired'),
  categoryId: objectIdSchema,
  spentAt: z.coerce.date().default(() => new Date()),
  comment: z.string().trim().max(500).optional(),
  /** A photo of the receipt, stored as a URL once uploaded. */
  receiptUrl: z.string().max(500).optional(),
  vendor: z.string().trim().max(120).optional(),
  /** §13.3 — a recurring expense creates a draft each period rather than a row. */
  recurring: z.enum(['none', 'monthly', 'quarterly', 'yearly']).default('none'),
})
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>

export const updateExpenseSchema = createExpenseSchema.partial()

export const expenseQuerySchema = paginationSchema.extend({
  categoryId: objectIdSchema.optional(),
  status: z.enum(EXPENSE_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minAmount: z.coerce.number().int().optional(),
})

export const expenseDecisionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

/* ── Fines (§12) ──────────────────────────────────────────────────────── */

export const FINE_TARGETS = ['student', 'employee'] as const
export const FINE_STATUSES = ['issued', 'paid', 'cancelled', 'appealed', 'waived'] as const
export type FineStatus = (typeof FINE_STATUSES)[number]

/** §12.1 — what a rule watches for. Nothing fires unless the boss enables it. */
export const FINE_TRIGGERS = [
  'late_payment',
  'absence',
  'late_arrival',
  'missed_lesson',
  'damage',
  'manual',
] as const
export type FineTrigger = (typeof FINE_TRIGGERS)[number]

export const createFineRuleSchema = z.object({
  name: localizedSchema,
  targetType: z.enum(FINE_TARGETS),
  trigger: z.enum(FINE_TRIGGERS),
  /** Fixed sum, or a percentage of the monthly fee when `mode` is `percent`. */
  mode: z.enum(['fixed', 'percent']).default('fixed'),
  amount: z.coerce.number().int().min(0),
  /** e.g. fire only after 3 consecutive absences. */
  threshold: z.coerce.number().int().min(1).default(1),
  /** §12 — every rule can be switched off, and starts off. */
  isActive: z.boolean().default(false),
  gracePeriodDays: z.coerce.number().int().min(0).default(0),
})
export const updateFineRuleSchema = createFineRuleSchema.partial()

export const createFineSchema = z.object({
  targetType: z.enum(FINE_TARGETS),
  targetId: objectIdSchema,
  amount: z.coerce.number().int().min(1, 'amountRequired'),
  /** §12.1 — "free text, required for manual". */
  reason: z.string().trim().min(10, 'reasonTooShort').max(1000),
  ruleId: objectIdSchema.optional(),
  evidenceUrl: z.string().max(500).optional(),
  /** A student fine lands on their next invoice; an employee fine on payroll. */
  appliedTo: z.enum(['invoice', 'payroll']).optional(),
})
export type CreateFineInput = z.infer<typeof createFineSchema>

export const fineQuerySchema = paginationSchema.extend({
  targetType: z.enum(FINE_TARGETS).optional(),
  targetId: objectIdSchema.optional(),
  status: z.enum(FINE_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export const fineDecisionSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

/** §12.4 — deciding an appeal. The outcome is stated, never inferred. */
export const appealDecisionSchema = z.object({
  outcome: z.enum(['upheld', 'waived']),
  reason: z.string().trim().min(3).max(500),
})

/* ── Payroll (§14) ────────────────────────────────────────────────────── */

export const SALARY_SCHEMES = ['fixed', 'percentage', 'per_lesson', 'per_student', 'mixed'] as const
export type SalaryScheme = (typeof SALARY_SCHEMES)[number]

export const PAYROLL_STATUSES = ['draft', 'approved', 'paid'] as const

export const salarySchemeSchema = z.object({
  userId: objectIdSchema,
  scheme: z.enum(SALARY_SCHEMES),
  /** Used by `fixed` and by the base of `mixed`. */
  baseAmount: z.coerce.number().int().min(0).default(0),
  /** Used by `percentage` and `mixed`; overrides the group's `teacherShare`. */
  share: z.coerce.number().min(0).max(1).optional(),
  /** Used by `per_lesson` and `per_student`. */
  rate: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})
export const updateSalarySchemeSchema = salarySchemeSchema.partial().omit({ userId: true })

/** `YYYY-MM`, the same period key invoices use. */
export const payrollPeriodSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'invalidPeriod'),
})

export const payrollQuerySchema = paginationSchema.extend({
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'invalidPeriod')
    .optional(),
  userId: objectIdSchema.optional(),
  status: z.enum(PAYROLL_STATUSES).optional(),
})

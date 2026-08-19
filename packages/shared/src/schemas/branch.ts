/**
 * TZ §5.3 — the branch entity. SuperAdmin-only to create or edit (§4.2).
 */
import { z } from 'zod'
import { localizedSchema, localizedOptionalSchema, slugSchema } from './common.js'
import { UZ_PHONE_REGEX, normalizePhone } from './lead.js'
import { LOCALES } from '../locales.js'

/** Branch phone numbers may be landlines, so this is looser than `phoneSchema`. */
const branchPhoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((value) => UZ_PHONE_REGEX.test(value) || /^\+998\d{7,9}$/.test(value), {
    message: 'invalidPhone',
  })

export const branchSettingsSchema = z.object({
  /** §4.2 note 4 — the ceiling an Admin may discount up to. */
  discountCeilingPercent: z.coerce.number().min(0).max(100).default(20),
  /** §4.2 note 6 — above this, an expense needs SuperAdmin approval. */
  expenseApprovalCeiling: z.coerce.number().min(0).optional(),
  /** §11 — days past the due date before a student counts as `qarzdor`. */
  overdueGraceDays: z.coerce.number().int().min(0).max(31).default(3),
})

export const createBranchSchema = z.object({
  name: localizedSchema,
  slug: slugSchema,
  city: localizedOptionalSchema,
  address: localizedOptionalSchema,
  workingHours: localizedOptionalSchema,
  phones: z.array(branchPhoneSchema).max(5).default([]),
  email: z.string().email('invalidEmail').optional().or(z.literal('')),
  /**
   * §5.2 — "each branch has its own accent colour so the boss can always tell at
   * a glance which branch he is looking at". Stored as a hue offset from the
   * signature gradient rather than a free hex colour, so no branch can be given
   * a colour that breaks contrast against the design system's surfaces.
   */
  accentHue: z.coerce.number().int().min(0).max(359).default(0),
  logo: z.string().max(500).optional(),
  coverPhoto: z.string().max(500).optional(),
  geo: z
    .object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) })
    .optional(),
  timezone: z.string().default('Asia/Tashkent'),
  /** §5.3 — the financial year runs September → August, per the Молия sheet. */
  financialYearStart: z.coerce.number().int().min(1).max(12).default(9),
  defaultLocale: z.enum(LOCALES).default('uz'),
  settings: branchSettingsSchema.partial().optional(),
  openedAt: z.coerce.date().optional(),
})
export type CreateBranchInput = z.input<typeof createBranchSchema>

/** The slug is a public URL (`/uz/filiallar/urganch`), so it is not editable. */
export const updateBranchSchema = createBranchSchema
  .omit({ slug: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })

/**
 * TZ §7.1 — the online registration form. This exact schema is used by
 * react-hook-form on the client and by the validate middleware on the API, so
 * the two can never disagree about what a valid application is.
 */
import { z } from 'zod'

/** Uzbek mobile numbers: +998 followed by 9 digits. Stored normalised as +998XXXXXXXXX. */
export const UZ_PHONE_REGEX = /^\+998\d{9}$/

/**
 * Normalises to `+998XXXXXXXXX`.
 *
 * Deliberately does NOT force a `+998` prefix onto arbitrary input: doing so
 * would turn a foreign number such as `+7 900 123 45 67` into a well-formed
 * Uzbek one and store a phone the applicant does not own. Anything that is not
 * recognisably an Uzbek number is returned as-is so `phoneSchema` rejects it.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  // 998 + 9 national digits
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`
  // bare 9-digit national number
  if (digits.length === 9) return `+998${digits}`
  // 8 + 9 digits, the old domestic trunk format
  if (digits.length === 10 && digits.startsWith('8')) return `+998${digits.slice(1)}`
  return digits.length > 0 ? `+${digits}` : input
}

/**
 * `+998 90 123 45 67` for display while typing.
 *
 * Applies the mask only to input that is plausibly Uzbek. Anything else is
 * returned untouched, so the user sees what they actually typed and gets a
 * validation error rather than a silent rewrite.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const national = digits.startsWith('998') ? digits.slice(3) : digits

  // More digits than an Uzbek number can hold — leave it alone.
  if (national.length > 9) return phone

  const parts = [
    national.slice(0, 2),
    national.slice(2, 5),
    national.slice(5, 7),
    national.slice(7, 9),
  ]
  return `+998 ${parts.filter(Boolean).join(' ')}`.trimEnd()
}

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((value) => UZ_PHONE_REGEX.test(value), { message: 'invalidPhone' })

/** Matches the `Kun` column of the workbook (§7.1, §9.2). */
export const SCHEDULE_PATTERNS = ['har_kun', 'toq', 'juft'] as const
export type SchedulePattern = (typeof SCHEDULE_PATTERNS)[number]

export const TIME_SLOTS = ['morning', 'afternoon', 'evening'] as const
export type TimeSlot = (typeof TIME_SLOTS)[number]

/** "How did you hear about us?" — feeds the marketing report (§7.1, §15.1). */
export const LEAD_SOURCES = ['instagram', 'friend', 'passing_by', 'telegram', 'other'] as const
export type LeadSource = (typeof LEAD_SOURCES)[number]

/** Step 1 — Who */
export const leadStep1Schema = z.object({
  fullName: z.string().trim().min(3, 'nameTooShort').max(120, 'nameTooLong'),
  phone: phoneSchema,
  age: z.coerce.number().int().min(4, 'ageTooLow').max(80, 'ageTooHigh').optional(),
  schoolClass: z.string().trim().max(20).optional(),
})

/** Step 2 — What */
export const leadStep2Schema = z.object({
  branchSlug: z.string().trim().min(1, 'branchRequired'),
  courseSlug: z.string().trim().min(1, 'courseRequired'),
  preferredDays: z.enum(SCHEDULE_PATTERNS).optional(),
  preferredTime: z.enum(TIME_SLOTS).optional(),
})

/** Step 3 — Confirm */
export const leadStep3Schema = z.object({
  source: z.enum(LEAD_SOURCES).optional(),
  comment: z.string().trim().max(1000).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'consentRequired' }) }),
})

/** UTM capture for the marketing-efficiency widget (§15.1). */
export const utmSchema = z
  .object({
    source: z.string().max(120).optional(),
    medium: z.string().max(120).optional(),
    campaign: z.string().max(120).optional(),
    content: z.string().max(120).optional(),
    term: z.string().max(120).optional(),
  })
  .optional()

export const leadSchema = leadStep1Schema
  .merge(leadStep2Schema)
  .merge(leadStep3Schema)
  .extend({
    /** Honeypot — must stay empty; a filled value is a bot (§7.1). */
    website: z.string().max(0).optional(),
    /** Cloudflare Turnstile token, verified server-side. */
    turnstileToken: z.string().optional(),
    /** OTP proving the phone belongs to the applicant. */
    otpCode: z
      .string()
      .regex(/^\d{6}$/, 'invalidOtp')
      .optional(),
    utm: utmSchema,
    locale: z.enum(['uz', 'ru', 'en']).default('uz'),
  })

export type LeadInput = z.input<typeof leadSchema>
export type LeadPayload = z.output<typeof leadSchema>

/**
 * §6.2 §14 — the short inline form on the home page: name, phone, course.
 * The full three-step flow lives on its own page and uses `leadSchema`.
 */
export const quickLeadSchema = z.object({
  fullName: z.string().trim().min(3, 'nameTooShort').max(120, 'nameTooLong'),
  phone: phoneSchema,
  courseSlug: z.string().trim().min(1, 'courseRequired'),
  consent: z.literal(true, { errorMap: () => ({ message: 'consentRequired' }) }),
  website: z.string().max(0).optional(),
  turnstileToken: z.string().optional(),
  utm: utmSchema,
  locale: z.enum(['uz', 'ru', 'en']).default('uz'),
})
export type QuickLeadInput = z.input<typeof quickLeadSchema>

/** §7.1 — OTP request/verify, rate limited to 5 codes per number per hour. */
export const otpRequestSchema = z.object({ phone: phoneSchema })
export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'invalidOtp'),
})

/** §6.1 — the contact page form. */
export const contactSchema = z.object({
  fullName: z.string().trim().min(3, 'nameTooShort').max(120),
  phone: phoneSchema,
  message: z.string().trim().min(10, 'messageTooShort').max(2000),
  website: z.string().max(0).optional(),
  turnstileToken: z.string().optional(),
})
export type ContactInput = z.input<typeof contactSchema>

/** §7.2 — lead pipeline stages, in board order. */
export const LEAD_STATUSES = [
  'yangi',
  'boglanildi',
  'sinov_darsiga_yozildi',
  'sinov_darsida_qatnashdi',
  'oquvchi_boldi',
  'rad_etdi',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

/**
 * TZ §8 — Module 3, authentication.
 *
 * Same rules on both sides: react-hook-form validates with these schemas in the
 * browser, the API's `validateBody` middleware validates with the identical
 * object. Error messages are i18n *keys*, resolved by next-intl on the client —
 * the API never sends a user-facing sentence it cannot translate.
 */
import { z } from 'zod'
import { phoneSchema } from './lead.js'
import { isCommonPassword } from '../common-passwords.js'
import { ROLES } from '../permissions.js'
import { LOCALES } from '../locales.js'

/** §8 — argon2id, minimum 8 characters, rejected if it is a common password. */
export const passwordSchema = z
  .string()
  .min(8, 'passwordTooShort')
  .max(128, 'passwordTooLong')
  .refine((value) => !isCommonPassword(value), { message: 'passwordTooCommon' })

/**
 * Deliberately looser than `passwordSchema`: when *checking* a password we must
 * not leak, through a validation error, that the stored one was short or common.
 * Anything non-empty goes to the service, which answers with the same generic
 * failure either way.
 */
const passwordAttemptSchema = z.string().min(1, 'passwordRequired').max(128)

export const loginSchema = z.object({
  phone: phoneSchema,
  password: passwordAttemptSchema,
  /** Shown in "Faol qurilmalar" (§8, PIC 10) so a user recognises their own sessions. */
  deviceName: z.string().trim().max(80).optional(),
  /** Required only once 2FA is enabled; mandatory for SuperAdmin (§8). */
  totpCode: z
    .string()
    .regex(/^\d{6}$/, 'invalidTotp')
    .optional(),
})
export type LoginInput = z.input<typeof loginSchema>

/** §8 — phone + SMS OTP, for students and parents who forget their password. */
export const otpLoginRequestSchema = z.object({ phone: phoneSchema })
export const otpLoginVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'invalidOtp'),
  deviceName: z.string().trim().max(80).optional(),
})

export const changePasswordSchema = z
  .object({
    currentPassword: passwordAttemptSchema,
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'passwordsDoNotMatch',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'passwordUnchanged',
    path: ['newPassword'],
  })

/** An administrator resetting someone else's password — no current password known. */
export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
  /** Force a change at next login; the default for a password an admin has seen. */
  mustChange: z.boolean().default(true),
})

/** §8 / PIC 10 — optional "Kirish kodi" for the student cabinet. */
export const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'invalidPin'),
})
export const changePinSchema = z.object({
  currentPin: z
    .string()
    .regex(/^\d{4,6}$/, 'invalidPin')
    .optional(),
  pin: z.string().regex(/^\d{4,6}$/, 'invalidPin'),
})

/** §8 — TOTP, mandatory for SuperAdmin. Enabling is a two-step confirm. */
export const totpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'invalidTotp'),
})
export const totpDisableSchema = z.object({
  password: passwordAttemptSchema,
  code: z.string().regex(/^\d{6}$/, 'invalidTotp'),
})

/** §5.2 — the branch switcher. `'ALL'` is the consolidated SuperAdmin scope. */
export const branchSwitchSchema = z.object({
  branchId: z.union([z.string().regex(/^[a-f\d]{24}$/i, 'invalidBranchId'), z.literal('ALL')]),
})

/** §4.1 — one role per branch; SuperAdmin is global and carries no branchId. */
export const roleAssignmentSchema = z
  .object({
    role: z.enum(ROLES),
    branchId: z
      .string()
      .regex(/^[a-f\d]{24}$/i, 'invalidBranchId')
      .optional(),
  })
  .refine((value) => value.role === 'superadmin' || Boolean(value.branchId), {
    message: 'branchRequiredForRole',
    path: ['branchId'],
  })
  .refine((value) => value.role !== 'superadmin' || !value.branchId, {
    message: 'superadminIsGlobal',
    path: ['branchId'],
  })
export type RoleAssignmentInput = z.infer<typeof roleAssignmentSchema>

/** §8 — staff accounts are created by an administrator; there is no self-registration. */
export const createUserSchema = z.object({
  fullName: z.string().trim().min(3, 'nameTooShort').max(120, 'nameTooLong'),
  phone: phoneSchema,
  password: passwordSchema,
  roles: z.array(roleAssignmentSchema).min(1, 'roleRequired'),
  locale: z.enum(LOCALES).default('uz'),
  email: z.string().email('invalidEmail').optional().or(z.literal('')),
  photo: z.string().max(500).optional(),
  /** Encrypted at rest when present (§8, data protection). */
  note: z.string().trim().max(1000).optional(),
})
export type CreateUserInput = z.input<typeof createUserSchema>

export const updateUserSchema = createUserSchema
  .omit({ password: true, roles: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })

export const updateRolesSchema = z.object({
  roles: z.array(roleAssignmentSchema).min(1, 'roleRequired'),
})

/** What `GET /auth/me` returns. Kept here so the web app types against it. */
export type SessionUser = {
  id: string
  fullName: string
  phone: string
  photo?: string
  locale: (typeof LOCALES)[number]
  roles: { role: (typeof ROLES)[number]; branchId?: string; branchName?: string }[]
  /** The role in effect for the active branch — what `can()` is called with. */
  activeRole: (typeof ROLES)[number]
  activeBranchId: string | 'ALL' | null
  twoFactorEnabled: boolean
  mustChangePassword: boolean
  hasPin: boolean
}

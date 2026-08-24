import { z } from 'zod'
import { LOCALES } from './locales.js'
import { DEFAULT_LIMITS } from './permissions.js'

/**
 * TZ §21.1 — "Settings (SuperAdmin): Branches · Courses and prices · Rooms ·
 * Fine rules · Expense categories and budgets · Salary schemes · Discount
 * ceilings · Payment methods and integrations · Notification templates · SMS
 * provider credentials · Public site content · Roles and staff accounts."
 *
 * Most of that list is not settings at all — branches, courses, rooms, fine
 * rules, expense categories and salary schemes are structured collections with
 * their own screens. What genuinely belongs in a key/value store is the rest:
 * numbers and switches that several modules read and one person tunes.
 *
 * The registry is typed so a caller cannot ask for a key that does not exist,
 * and so the editor can render the right control without a hand-maintained
 * second list. `scope: 'branch'` keys may be overridden per branch; `'global'`
 * keys are centre-wide and have no branch column.
 */

export const SETTING_SCOPES = ['global', 'branch'] as const
export type SettingScope = (typeof SETTING_SCOPES)[number]

type Definition<T extends z.ZodTypeAny> = {
  schema: T
  default: z.infer<T>
  scope: SettingScope
  /** How the settings screen renders it. */
  control: 'number' | 'percent' | 'money' | 'boolean' | 'text' | 'secret' | 'json'
  /** Which §21.1 group it appears under. */
  group: 'money' | 'academic' | 'notifications' | 'integrations' | 'content'
}

function define<T extends z.ZodTypeAny>(definition: Definition<T>) {
  return definition
}

export const SETTING_KEYS = {
  /* ── Money ceilings (§4.2 notes 4 and 6) ──────────────────────────────── */
  'money.discountCeilingPercent': define({
    schema: z.number().int().min(0).max(100),
    default: DEFAULT_LIMITS.discountCeilingPercent,
    scope: 'branch',
    control: 'percent',
    group: 'money',
  }),
  'money.expenseApprovalCeiling': define({
    schema: z.number().int().min(0),
    default: 1_000_000,
    scope: 'branch',
    control: 'money',
    group: 'money',
  }),
  /** Note 5 — the per-transaction cap on a Manager's petty-cash expense. */
  'money.pettyCashCeiling': define({
    schema: z.number().int().min(0),
    default: 200_000,
    scope: 'branch',
    control: 'money',
    group: 'money',
  }),
  'money.overdueGraceDays': define({
    schema: z.number().int().min(0).max(31),
    default: DEFAULT_LIMITS.overdueGraceDays,
    scope: 'branch',
    control: 'number',
    group: 'money',
  }),
  'money.defaultTeacherShare': define({
    schema: z.number().min(0).max(1),
    default: DEFAULT_LIMITS.teacherShare,
    scope: 'branch',
    control: 'number',
    group: 'money',
  }),
  /** §11.1 — the day of the month invoices are raised on. */
  'money.invoiceDayOfMonth': define({
    schema: z.number().int().min(1).max(28),
    default: 1,
    scope: 'branch',
    control: 'number',
    group: 'money',
  }),

  /* ── Academic (§10.3, §9.3) ───────────────────────────────────────────── */
  'academic.attendanceEditWindowHours': define({
    schema: z.number().int().min(1).max(720),
    default: DEFAULT_LIMITS.attendanceEditWindowHours,
    scope: 'branch',
    control: 'number',
    group: 'academic',
  }),
  'academic.lowAttendanceThresholdPercent': define({
    schema: z.number().int().min(0).max(100),
    default: DEFAULT_LIMITS.lowAttendanceThresholdPercent,
    scope: 'branch',
    control: 'percent',
    group: 'academic',
  }),
  'academic.absenceStreakAlert': define({
    schema: z.number().int().min(1).max(30),
    default: 3,
    scope: 'branch',
    control: 'number',
    group: 'academic',
  }),
  /**
   * §9.3 — public holidays of Uzbekistan, `MM-DD` so they carry year to year.
   * Lessons falling on one are skipped by `generateLessons` and never billed.
   */
  'academic.holidays': define({
    schema: z.array(z.string().regex(/^\d{2}-\d{2}$/)),
    default: [
      '01-01', // Yangi yil
      '03-08', // Xotin-qizlar kuni
      '03-21', // Navro'z
      '05-09', // Xotira va qadrlash kuni
      '09-01', // Mustaqillik kuni
      '10-01', // Ustoz va murabbiylar kuni
      '12-08', // Konstitutsiya kuni
    ],
    scope: 'global',
    control: 'json',
    group: 'academic',
  }),
  /** §16 — show a group leaderboard by name, or by position only. */
  'academic.anonymiseLeaderboard': define({
    schema: z.boolean(),
    default: false,
    scope: 'global',
    control: 'boolean',
    group: 'academic',
  }),

  /* ── Fines (§12 — nothing fires unless the boss switches it on) ───────── */
  'fines.autoIssueEnabled': define({
    schema: z.boolean(),
    default: false,
    scope: 'global',
    control: 'boolean',
    group: 'academic',
  }),

  /* ── Notifications (§19) ──────────────────────────────────────────────── */
  'notify.smsEnabled': define({
    schema: z.boolean(),
    default: false,
    scope: 'global',
    control: 'boolean',
    group: 'notifications',
  }),
  'notify.telegramEnabled': define({
    schema: z.boolean(),
    default: false,
    scope: 'global',
    control: 'boolean',
    group: 'notifications',
  }),
  /** Quiet hours, so a payment reminder never arrives at 03:00. */
  'notify.quietHours': define({
    schema: z.object({ from: z.string(), to: z.string() }),
    default: { from: '21:00', to: '08:00' },
    scope: 'global',
    control: 'json',
    group: 'notifications',
  }),
  'notify.reminderOffsetDays': define({
    schema: z.array(z.number().int()),
    default: [-3, 0, 3, 7],
    scope: 'global',
    control: 'json',
    group: 'notifications',
  }),

  /* ── Integrations (§31 Q4, Q5 — blank until the client supplies them) ─── */
  'integration.eskizToken': define({
    schema: z.string(),
    default: '',
    scope: 'global',
    control: 'secret',
    group: 'integrations',
  }),
  'integration.eskizSender': define({
    schema: z.string(),
    default: '',
    scope: 'global',
    control: 'text',
    group: 'integrations',
  }),
  'integration.telegramBotToken': define({
    schema: z.string(),
    default: '',
    scope: 'global',
    control: 'secret',
    group: 'integrations',
  }),

  /* ── Content (§6) ─────────────────────────────────────────────────────── */
  'content.showResultsWall': define({
    schema: z.boolean(),
    default: true,
    scope: 'global',
    control: 'boolean',
    group: 'content',
  }),
  'content.defaultLocale': define({
    schema: z.enum(LOCALES),
    default: 'uz' as const,
    scope: 'global',
    control: 'text',
    group: 'content',
  }),
} as const

export type SettingKey = keyof typeof SETTING_KEYS
export const SETTING_KEY_LIST = Object.keys(SETTING_KEYS) as SettingKey[]

export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_KEYS)[K]['schema']>

export function settingDefault<K extends SettingKey>(key: K): SettingValue<K> {
  return SETTING_KEYS[key].default as SettingValue<K>
}

export function isSettingKey(key: string): key is SettingKey {
  return key in SETTING_KEYS
}

/** Validates a value against its key's schema. Throws a `ZodError` on mismatch. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  return SETTING_KEYS[key].schema.parse(value) as SettingValue<K>
}

/** A secret is writable but never readable — the API returns a mask instead. */
export function isSecretSetting(key: SettingKey): boolean {
  return SETTING_KEYS[key].control === 'secret'
}

export const upsertSettingSchema = z.object({
  key: z.string().refine(isSettingKey, 'unknownSettingKey'),
  value: z.unknown(),
  /** Absent for a global key; required for a branch override. */
  branchId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'invalidBranchId')
    .optional(),
})
export type UpsertSettingInput = z.infer<typeof upsertSettingSchema>

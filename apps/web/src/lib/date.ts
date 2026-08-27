import { format, parseISO } from 'date-fns'
import { uz, ru, enGB, type Locale as DateFnsLocale } from 'date-fns/locale'
import type { Locale } from '@leader/shared/locales'

/**
 * G1 — one date display format across the whole CRM: `dd.MM.yyyy`. Before
 * this, three components each duplicated their own `DATE_LOCALE` map and
 * called `toLocaleDateString`, which renders differently per browser/OS
 * (`Intl` has no fixed pattern guarantee) — tables, forms, receipts, exports
 * and reports all read through here instead.
 */
const DATE_FNS_LOCALE: Record<Locale, DateFnsLocale> = { uz, ru, en: enGB }

function toDate(value: Date | string | number): Date {
  return typeof value === 'string' ? parseISO(value) : new Date(value)
}

/** `27.08.2026`. Returns `—` for a missing or invalid value. */
export function formatDate(
  value: Date | string | number | null | undefined,
  locale: Locale = 'uz',
): string {
  if (value === null || value === undefined || value === '') return '—'
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'dd.MM.yyyy', { locale: DATE_FNS_LOCALE[locale] })
}

/** `27.08.2026 14:30`. */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  locale: Locale = 'uz',
): string {
  if (value === null || value === undefined || value === '') return '—'
  const date = toDate(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'dd.MM.yyyy HH:mm', { locale: DATE_FNS_LOCALE[locale] })
}

/** `August 2026`, localized — for a calendar header, not a data column. */
export function formatMonthYear(value: Date | string | number, locale: Locale = 'uz'): string {
  const date = toDate(value)
  return format(date, 'LLLL yyyy', { locale: DATE_FNS_LOCALE[locale] })
}

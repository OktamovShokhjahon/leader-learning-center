/**
 * TZ §26.4 — all monetary values are integers in so'm. No floats anywhere in
 * storage or transport; formatting happens only at the presentation layer.
 */
import type { Locale } from './locales.js'

export type Soum = number

const INTL_LOCALE: Record<Locale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }

export function isValidSoum(value: unknown): value is Soum {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

/** Throws rather than silently rounding — a non-integer sum is a bug, not input. */
export function assertSoum(value: number, label = 'amount'): Soum {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer number of so'm, received ${value}`)
  }
  return value
}

/** The workbook stores `Chek` in thousands (700 = 700 000 so'm) — TZ §2. */
export function fromThousands(value: number): Soum {
  return Math.round(value * 1000)
}

/** Percentage discount on an integer amount, rounded to whole so'm. */
export function applyPercent(amount: Soum, percent: number): Soum {
  return Math.round(amount * (percent / 100))
}

export function sum(amounts: readonly Soum[]): Soum {
  return amounts.reduce<Soum>((total, amount) => total + amount, 0)
}

/** `700 000 so'm` */
export function formatSoum(amount: Soum, locale: Locale = 'uz'): string {
  return `${new Intl.NumberFormat(INTL_LOCALE[locale]).format(amount)} so'm`
}

/** `700 000` — for table cells where the column header already says so'm. */
export function formatNumber(amount: Soum, locale: Locale = 'uz'): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(amount)
}

/** `700 ming` / `1,2 mln` — compact form for stat tiles and course cards. */
export function formatCompactSoum(amount: Soum, locale: Locale = 'uz'): string {
  const units: Record<Locale, { k: string; m: string }> = {
    uz: { k: 'ming', m: 'mln' },
    ru: { k: 'тыс', m: 'млн' },
    en: { k: 'K', m: 'M' },
  }
  const u = units[locale]
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000
    const text = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 1 }).format(
      millions,
    )
    return `${text} ${u.m}`
  }
  if (amount >= 1000) return `${formatNumber(Math.round(amount / 1000), locale)} ${u.k}`
  return formatNumber(amount, locale)
}

/** Parses "700 000", "700000", "700 000 so'm" back to an integer. */
export function parseSoum(input: string): Soum | null {
  const digits = input.replace(/[^\d-]/g, '')
  if (digits === '' || digits === '-') return null
  const parsed = Number(digits)
  return Number.isSafeInteger(parsed) ? parsed : null
}

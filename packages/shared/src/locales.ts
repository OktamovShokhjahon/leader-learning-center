/**
 * TZ §21.2 — three product languages. O'zbek is the default and the only
 * required one on dynamic content; ru/en fall back to uz when empty.
 */
export const LOCALES = ['uz', 'ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'uz'

export const LOCALE_LABELS: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
}

/** Short label for the language switcher. */
export const LOCALE_SHORT: Record<Locale, string> = { uz: 'UZ', ru: 'RU', en: 'EN' }

/**
 * Shape of every translatable field on a dynamic document (course names, news,
 * book titles, teacher bios). `uz` is required; the others are optional.
 */
export type Localized = { uz: string; ru?: string; en?: string }

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** Resolve a localised field, falling back to uz per TZ §21.2. */
export function pick(field: Localized | undefined, locale: Locale): string {
  if (!field) return ''
  const value = field[locale]
  return value && value.trim().length > 0 ? value : field.uz
}

import { defineRouting } from 'next-intl/routing'
import { LOCALES, DEFAULT_LOCALE } from '@leader/shared/locales'

/**
 * TZ §21.2 — locale always in the path (/uz, /ru, /en), uz as default,
 * detection on first visit with a persistent cookie.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeDetection: true,
})

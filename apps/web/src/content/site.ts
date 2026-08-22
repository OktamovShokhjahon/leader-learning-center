/**
 * Site-wide constants.
 *
 * ⚠️ CONTENT STATUS — everything in `src/content/` is a typed placeholder that
 * renders the real page structure while the client supplies real data (TZ §31
 * Q10 certifications, Q15 brand assets and photos, Q3 branch count). Once the
 * Express API exists these modules are replaced by `src/lib/api/*` calls with
 * the same return types; no component changes.
 */
import type { Localized } from '@leader/shared/locales'

export const SITE = {
  name: 'Leader Learning Centre',
  shortName: 'Leader LC',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://leaderonline.uz',
  foundedYear: 2018,
  email: 'info@leaderonline.uz',
  phones: ['+998 62 224 00 00'],
  telegram: 'https://t.me/leaderlc',
  instagram: 'https://instagram.com/leader_learning_centre',
  facebook: 'https://facebook.com/leaderlc',
  youtube: 'https://youtube.com/@leaderlc',
  /** The existing personal-cabinet entry point preserved from the current site. */
  cabinetPath: '/login',
} as const

export type NavItem = { href: string; key: string }

/** TZ §6.1 — routes are Uzbek across all three locales. */
export const MAIN_NAV: NavItem[] = [
  { href: '/courses', key: 'courses' },
  { href: '/teachers', key: 'teachers' },
  { href: '/results', key: 'results' },
  { href: '/branches', key: 'branches' },
  { href: '/about', key: 'about' },
  { href: '/news', key: 'news' },
  { href: '/contact', key: 'contact' },
]

export const FOOTER_NAV: { key: string; items: NavItem[] }[] = [
  {
    key: 'learn',
    items: [
      { href: '/courses', key: 'courses' },
      { href: '/teachers', key: 'teachers' },
      { href: '/results', key: 'results' },
      { href: '/gallery', key: 'gallery' },
    ],
  },
  {
    key: 'centre',
    items: [
      { href: '/about', key: 'about' },
      { href: '/branches', key: 'branches' },
      { href: '/news', key: 'news' },
      { href: '/faq', key: 'faq' },
    ],
  },
  {
    key: 'legal',
    items: [
      { href: '/offer', key: 'offer' },
      { href: '/privacy', key: 'privacy' },
      { href: '/contact', key: 'contact' },
    ],
  },
]

/**
 * TZ §6.2 §2 — trust bar.
 * ⚠️ Must be confirmed as current by the client before publication (§31 Q10).
 */
export const ACCREDITATIONS: { key: string; label: Localized; unconfirmed: true }[] = [
  {
    key: 'cambridge',
    label: {
      uz: 'Cambridge Assessment English — Preparation Centre',
      ru: 'Cambridge Assessment English — Preparation Centre',
      en: 'Cambridge Assessment English — Preparation Centre',
    },
    unconfirmed: true,
  },
  {
    key: 'idp',
    label: { uz: 'IDP IELTS', ru: 'IDP IELTS', en: 'IDP IELTS' },
    unconfirmed: true,
  },
  {
    key: 'britishCouncil',
    label: {
      uz: 'British Council — IELTS Registration Centre',
      ru: 'British Council — IELTS Registration Centre',
      en: 'British Council — IELTS Registration Centre',
    },
    unconfirmed: true,
  },
]

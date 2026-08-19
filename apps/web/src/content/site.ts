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
  cabinetPath: '/kirish',
} as const

export type NavItem = { href: string; key: string }

/** TZ §6.1 — routes are Uzbek across all three locales. */
export const MAIN_NAV: NavItem[] = [
  { href: '/kurslar', key: 'courses' },
  { href: '/oqituvchilar', key: 'teachers' },
  { href: '/natijalar', key: 'results' },
  { href: '/filiallar', key: 'branches' },
  { href: '/biz-haqimizda', key: 'about' },
  { href: '/yangiliklar', key: 'news' },
  { href: '/aloqa', key: 'contact' },
]

export const FOOTER_NAV: { key: string; items: NavItem[] }[] = [
  {
    key: 'learn',
    items: [
      { href: '/kurslar', key: 'courses' },
      { href: '/oqituvchilar', key: 'teachers' },
      { href: '/natijalar', key: 'results' },
      { href: '/galereya', key: 'gallery' },
    ],
  },
  {
    key: 'centre',
    items: [
      { href: '/biz-haqimizda', key: 'about' },
      { href: '/filiallar', key: 'branches' },
      { href: '/yangiliklar', key: 'news' },
      { href: '/faq', key: 'faq' },
    ],
  },
  {
    key: 'legal',
    items: [
      { href: '/oferta', key: 'offer' },
      { href: '/maxfiylik', key: 'privacy' },
      { href: '/aloqa', key: 'contact' },
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

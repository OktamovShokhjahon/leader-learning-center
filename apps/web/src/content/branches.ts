/**
 * Branches — TZ §5. Multi-branch is core, not an add-on: every branch has its
 * own public page (`/uz/filiallar/urganch`), its own accent colour and its own
 * course/price set.
 *
 * ⚠️ PLACEHOLDER DATA. The client has not yet confirmed branch count, addresses
 * or coordinates (§31 Q3, Q15). Every record below carries `unconfirmed: true`
 * and must be replaced before publication.
 */
import type { Localized } from '@leader/shared/locales'

export type Branch = {
  slug: string
  name: Localized
  city: Localized
  address: Localized
  phones: string[]
  geo: { lat: number; lng: number }
  workingHours: Localized
  /**
   * §5.2 — each branch shifts the signature gradient's hue by a fixed offset so
   * the boss recognises the branch by colour instantly.
   */
  accentHue: number
  courseSlugs: string[]
  openedYear: number
  isActive: boolean
  unconfirmed: boolean
}

export const BRANCHES: Branch[] = [
  {
    slug: 'urganch-markaz',
    name: { uz: 'Urganch — Markaziy', ru: 'Ургенч — Центральный', en: 'Urgench — Central' },
    city: { uz: 'Urganch', ru: 'Ургенч', en: 'Urgench' },
    address: {
      uz: 'Urganch shahri, Xorazm viloyati',
      ru: 'г. Ургенч, Хорезмская область',
      en: 'Urgench, Khorezm region',
    },
    phones: ['+998 62 224 00 00'],
    geo: { lat: 41.5506, lng: 60.6317 },
    workingHours: {
      uz: 'Dushanba — Shanba, 08:00 — 20:00',
      ru: 'Понедельник — Суббота, 08:00 — 20:00',
      en: 'Monday — Saturday, 08:00 — 20:00',
    },
    accentHue: 0,
    courseSlugs: [
      'general-english',
      'ielts',
      'kids',
      'razgovor',
      'rus-tili',
      'turk-tili',
      'matematika',
      'milliy-sertifikat',
      'yozgi-maktab',
      'onlayn',
    ],
    openedYear: 2018,
    isActive: true,
    unconfirmed: true,
  },
  {
    slug: 'urganch-2',
    name: { uz: 'Urganch — 2-filial', ru: 'Ургенч — филиал 2', en: 'Urgench — Branch 2' },
    city: { uz: 'Urganch', ru: 'Ургенч', en: 'Urgench' },
    address: {
      uz: 'Urganch shahri, Xorazm viloyati',
      ru: 'г. Ургенч, Хорезмская область',
      en: 'Urgench, Khorezm region',
    },
    phones: ['+998 62 224 00 00'],
    geo: { lat: 41.5395, lng: 60.6255 },
    workingHours: {
      uz: 'Dushanba — Shanba, 08:00 — 20:00',
      ru: 'Понедельник — Суббота, 08:00 — 20:00',
      en: 'Monday — Saturday, 08:00 — 20:00',
    },
    accentHue: 32,
    courseSlugs: ['general-english', 'kids', 'razgovor', 'matematika', 'yozgi-maktab'],
    openedYear: 2022,
    isActive: true,
    unconfirmed: true,
  },
]

export function getBranches(): Branch[] {
  return BRANCHES.filter((branch) => branch.isActive)
}

export function getBranch(slug: string): Branch | undefined {
  return BRANCHES.find((branch) => branch.slug === slug && branch.isActive)
}

/** §5.2 — the branch accent, derived from the signature gradient by hue rotation. */
export function branchAccentStyle(hue: number): React.CSSProperties {
  return { filter: hue === 0 ? undefined : `hue-rotate(${hue}deg)` }
}

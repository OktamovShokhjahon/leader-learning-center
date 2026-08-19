import { Branch } from '../modules/branches/branch.model.js'
import { logger } from '../config/logger.js'

/**
 * Idempotent dev seed.
 *
 * ⚠️ PLACEHOLDER — mirrors `apps/web/src/content/branches.ts`. Both are replaced
 * by real client data (§31 Q3, Q15), after which the website reads branches from
 * `GET /public/branches` and this file becomes the migration's starting point.
 */
const SEED = [
  {
    slug: 'urganch-markaz',
    name: { uz: 'Urganch — Markaziy', ru: 'Ургенч — Центральный', en: 'Urgench — Central' },
    city: { uz: 'Urganch', ru: 'Ургенч', en: 'Urgench' },
    address: {
      uz: 'Urganch shahri, Xorazm viloyati',
      ru: 'г. Ургенч, Хорезмская область',
      en: 'Urgench, Khorezm region',
    },
    workingHours: {
      uz: 'Dushanba — Shanba, 08:00 — 20:00',
      ru: 'Понедельник — Суббота, 08:00 — 20:00',
      en: 'Monday — Saturday, 08:00 — 20:00',
    },
    phones: ['+998 62 224 00 00'],
    geo: { lat: 41.5506, lng: 60.6317 },
    accentHue: 0,
    openedAt: new Date('2018-09-01'),
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
    workingHours: {
      uz: 'Dushanba — Shanba, 08:00 — 20:00',
      ru: 'Понедельник — Суббота, 08:00 — 20:00',
      en: 'Monday — Saturday, 08:00 — 20:00',
    },
    phones: ['+998 62 224 00 00'],
    geo: { lat: 41.5395, lng: 60.6255 },
    accentHue: 32,
    openedAt: new Date('2022-09-01'),
  },
]

export async function seedBranches() {
  let created = 0
  for (const branch of SEED) {
    const result = await Branch.updateOne(
      { slug: branch.slug },
      { $setOnInsert: branch },
      { upsert: true },
    )
    if (result.upsertedCount) created += 1
  }
  if (created > 0) logger.info({ created }, 'seeded branches')
  return created
}

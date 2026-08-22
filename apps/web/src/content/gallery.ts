/**
 * TZ §6.1 — `/gallery`, photo and video albums.
 *
 * The albums and their captions are the centre's own description of its own
 * events, so they ship unglated. What is missing is the photographs themselves
 * (§31 Q15 — a photo session is still to be scheduled): every item renders as a
 * ceramic tile until a real `image` lands on it, which is a designed graphic
 * rather than a broken frame.
 *
 * Dropping in real photos is a one-field change per item — set `image` to the
 * uploaded path and the tile is replaced automatically.
 */
import type { Localized } from '@leader/shared/locales'

export type GalleryItem = {
  id: string
  caption: Localized
  /** Real photograph path once uploaded; the ceramic tile stands in until then. */
  image: string | null
}

export type Album = {
  slug: string
  title: Localized
  description: Localized
  /** ISO date, newest album first. */
  date: string
  items: GalleryItem[]
}

const item = (id: string, uz: string, ru: string, en: string): GalleryItem => ({
  id,
  caption: { uz, ru, en },
  image: null,
})

export const ALBUMS: Album[] = [
  {
    slug: 'darslar',
    title: { uz: 'Darslar', ru: 'Занятия', en: 'Lessons' },
    description: {
      uz: 'Kundalik mashg‘ulotlar: kichik guruhlar, suhbat mashqlari va nazorat ishlari.',
      ru: 'Ежедневные занятия: малые группы, разговорная практика и контрольные работы.',
      en: 'Everyday lessons: small groups, speaking practice and control tests.',
    },
    date: '2026-08-01',
    items: [
      item('l1', 'General English guruhi', 'Группа General English', 'A General English group'),
      item('l2', 'Suhbat klubi', 'Разговорный клуб', 'The speaking club'),
      item('l3', 'Kids darsi', 'Занятие Kids', 'A Kids lesson'),
      item('l4', 'Matematika mashg‘uloti', 'Занятие по математике', 'A mathematics session'),
      item('l5', 'IELTS Writing tahlili', 'Разбор IELTS Writing', 'IELTS Writing review'),
      item('l6', 'Kutubxona burchagi', 'Библиотечный уголок', 'The library corner'),
    ],
  },
  {
    slug: 'tadbirlar',
    title: { uz: 'Tadbirlar', ru: 'Мероприятия', en: 'Events' },
    description: {
      uz: 'Ochiq darslar, bahs-munozara kechalari va til klublari.',
      ru: 'Открытые уроки, дискуссионные вечера и языковые клубы.',
      en: 'Open lessons, debate evenings and language clubs.',
    },
    date: '2026-06-20',
    items: [
      item('e1', 'Ochiq dars', 'Открытый урок', 'An open lesson'),
      item('e2', 'Bahs kechasi', 'Вечер дебатов', 'Debate evening'),
      item('e3', 'Speaking marafoni', 'Speaking-марафон', 'Speaking marathon'),
      item('e4', 'Ota-onalar uchrashuvi', 'Встреча с родителями', 'Parents’ meeting'),
    ],
  },
  {
    slug: 'bitiruv',
    title: { uz: 'Bitiruv marosimlari', ru: 'Выпускные', en: 'Graduations' },
    description: {
      uz: 'Kurs yakunida sertifikat topshirish marosimlari.',
      ru: 'Церемонии вручения сертификатов по окончании курса.',
      en: 'Certificate ceremonies at the end of a course.',
    },
    date: '2026-05-30',
    items: [
      item('g1', 'Sertifikat topshirish', 'Вручение сертификатов', 'Handing out certificates'),
      item('g2', 'Bitiruvchilar', 'Выпускники', 'The graduates'),
      item('g3', 'Yodgorlik surati', 'Общее фото', 'The group photograph'),
    ],
  },
]

export function getAlbums(): Album[] {
  return [...ALBUMS].sort((a, b) => b.date.localeCompare(a.date))
}

export function getAlbum(slug: string): Album | undefined {
  return ALBUMS.find((album) => album.slug === slug)
}

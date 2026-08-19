/**
 * Teachers, student results and testimonials.
 *
 * ⚠️ PLACEHOLDER DATA. Teacher names, certificates, student band scores and
 * testimonials must all come from the client before publication (§31 Q15 — a
 * photo session is needed). Publishing invented exam results would be a
 * misrepresentation, so every record is flagged `unconfirmed`.
 *
 * §6.2 §6 — the results wall is the strongest conversion element on the page
 * and must be trivial for an admin to add to; the shape here is what the CRM
 * editor will write.
 */
import type { Localized } from '@leader/shared/locales'

export type Teacher = {
  slug: string
  fullName: string
  role: Localized
  bio: Localized
  subjects: string[]
  certificates: string[]
  experienceYears: number
  photo: string | null
  branchSlugs: string[]
  order: number
  unconfirmed: boolean
}

export const TEACHERS: Teacher[] = [
  {
    slug: 'teacher-1',
    fullName: 'F.I.Sh.',
    role: { uz: 'IELTS o‘qituvchisi', ru: 'Преподаватель IELTS', en: 'IELTS Teacher' },
    bio: {
      uz: 'Bio matni mijoz tomonidan taqdim etiladi.',
      ru: 'Текст биографии предоставляется клиентом.',
      en: 'Biography text to be supplied by the client.',
    },
    subjects: ['ielts', 'general-english'],
    certificates: [],
    experienceYears: 0,
    photo: null,
    branchSlugs: ['urganch-markaz'],
    order: 1,
    unconfirmed: true,
  },
  {
    slug: 'teacher-2',
    fullName: 'F.I.Sh.',
    role: { uz: 'Kids o‘qituvchisi', ru: 'Преподаватель Kids', en: 'Kids Teacher' },
    bio: {
      uz: 'Bio matni mijoz tomonidan taqdim etiladi.',
      ru: 'Текст биографии предоставляется клиентом.',
      en: 'Biography text to be supplied by the client.',
    },
    subjects: ['kids'],
    certificates: [],
    experienceYears: 0,
    photo: null,
    branchSlugs: ['urganch-markaz'],
    order: 2,
    unconfirmed: true,
  },
  {
    slug: 'teacher-3',
    fullName: 'F.I.Sh.',
    role: { uz: 'Matematika o‘qituvchisi', ru: 'Преподаватель математики', en: 'Maths Teacher' },
    bio: {
      uz: 'Bio matni mijoz tomonidan taqdim etiladi.',
      ru: 'Текст биографии предоставляется клиентом.',
      en: 'Biography text to be supplied by the client.',
    },
    subjects: ['matematika'],
    certificates: [],
    experienceYears: 0,
    photo: null,
    branchSlugs: ['urganch-markaz', 'urganch-2'],
    order: 3,
    unconfirmed: true,
  },
  {
    slug: 'teacher-4',
    fullName: 'F.I.Sh.',
    role: { uz: 'Rus tili o‘qituvchisi', ru: 'Преподаватель русского', en: 'Russian Teacher' },
    bio: {
      uz: 'Bio matni mijoz tomonidan taqdim etiladi.',
      ru: 'Текст биографии предоставляется клиентом.',
      en: 'Biography text to be supplied by the client.',
    },
    subjects: ['rus-tili'],
    certificates: [],
    experienceYears: 0,
    photo: null,
    branchSlugs: ['urganch-markaz'],
    order: 4,
    unconfirmed: true,
  },
]

export type Result = {
  id: string
  studentName: string
  courseSlug: string
  /** e.g. "IELTS 7.5" or "CEFR C1" — free text so the admin is not boxed in. */
  achievement: string
  year: number
  quote: Localized | null
  photo: string | null
  unconfirmed: boolean
}

/** ⚠️ Empty on purpose — real band scores only, supplied by the client. */
export const RESULTS: Result[] = []

export type Testimonial = {
  id: string
  authorName: string
  role: Localized
  body: Localized
  /** Video reviews play through the protected player (§17, §18). */
  videoId: string | null
  unconfirmed: boolean
}

/** ⚠️ Empty on purpose — real reviews only. */
export const TESTIMONIALS: Testimonial[] = []

export function getTeachers(): Teacher[] {
  return [...TEACHERS].sort((a, b) => a.order - b.order)
}

export function getTeacher(slug: string): Teacher | undefined {
  return TEACHERS.find((teacher) => teacher.slug === slug)
}

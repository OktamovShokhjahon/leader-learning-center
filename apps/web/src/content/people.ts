/**
 * Teachers, student results and testimonials.
 *
 * ⚠️ Everything here is SAMPLE DATA and is gated by `SAMPLE_CONTENT`, because
 * every record is a claim about an identifiable person — a teacher's
 * credentials, a student's exam band, a named review. See `content/sample.ts`.
 * Set `NEXT_PUBLIC_SAMPLE_CONTENT=false` and each section falls back to its
 * empty state until the centre supplies the real records.
 *
 * §6.2 §6 — the results wall is the strongest conversion element on the page and
 * must be trivial for an admin to add to; the shapes here are exactly what the
 * CRM editor will write.
 */
import type { Localized } from '@leader/shared/locales'
import { withSample } from './sample'

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
}

const SAMPLE_TEACHERS: Teacher[] = [
  {
    slug: 'aziza-yusupova',
    fullName: 'Aziza Yusupova',
    role: { uz: 'IELTS o‘qituvchisi', ru: 'Преподаватель IELTS', en: 'IELTS Teacher' },
    bio: {
      uz: 'IELTS 8.0. Yozma va Speaking modullariga ixtisoslashgan. Har hafta o‘quvchilar bilan alohida Writing tahlilini o‘tkazadi.',
      ru: 'IELTS 8.0. Специализируется на модулях Writing и Speaking. Каждую неделю проводит индивидуальный разбор Writing.',
      en: 'IELTS 8.0. Specialises in the Writing and Speaking modules, and runs an individual Writing review with every student each week.',
    },
    subjects: ['ielts', 'general-english'],
    certificates: ['IELTS 8.0', 'CELTA'],
    experienceYears: 7,
    photo: null,
    branchSlugs: ['urganch-markaz'],
    order: 1,
  },
  {
    slug: 'sardor-otaboyev',
    fullName: 'Sardor Otaboyev',
    role: { uz: 'General English', ru: 'General English', en: 'General English' },
    bio: {
      uz: 'CEFR bo‘yicha A1 dan C1 gacha guruhlarni olib boradi. Darslarini suhbatga qurgan, grammatikani kontekst ichida beradi.',
      ru: 'Ведёт группы от A1 до C1 по шкале CEFR. Строит занятия вокруг речи, грамматику даёт в контексте.',
      en: 'Teaches A1 to C1 on the CEFR scale. Builds lessons around speaking and introduces grammar in context.',
    },
    subjects: ['general-english', 'razgovor'],
    certificates: ['CEFR C2', 'TKT'],
    experienceYears: 5,
    photo: null,
    branchSlugs: ['urganch-markaz', 'urganch-2'],
    order: 2,
  },
  {
    slug: 'nilufar-qodirova',
    fullName: 'Nilufar Qodirova',
    role: { uz: 'Kids o‘qituvchisi', ru: 'Преподаватель Kids', en: 'Kids Teacher' },
    bio: {
      uz: '7–12 yoshli bolalar bilan ishlaydi. Qo‘shiq, harakatli o‘yin va vizual kartochkalar orqali o‘rgatadi.',
      ru: 'Работает с детьми 7–12 лет. Учит через песни, подвижные игры и визуальные карточки.',
      en: 'Works with children aged 7 to 12, teaching through songs, movement games and visual flashcards.',
    },
    subjects: ['kids'],
    certificates: ['TKT: Young Learners'],
    experienceYears: 4,
    photo: null,
    branchSlugs: ['urganch-markaz', 'urganch-2'],
    order: 3,
  },
  {
    slug: 'jasur-ruzmetov',
    fullName: 'Jasur Ro‘zmetov',
    role: { uz: 'Matematika o‘qituvchisi', ru: 'Преподаватель математики', en: 'Mathematics Teacher' },
    bio: {
      uz: '5–11-sinf dasturi va imtihon masalalari. Har mavzudan keyin nazorat ishi oladi, natijalarni reyting jadvalida ko‘rsatadi.',
      ru: 'Программа 5–11 классов и экзаменационные задачи. После каждой темы — контрольная, результаты в таблице рейтинга.',
      en: 'The grade 5–11 curriculum and exam problems. A control test after every topic, with results shown on the ranking table.',
    },
    subjects: ['matematika', 'milliy-sertifikat'],
    certificates: [],
    experienceYears: 9,
    photo: null,
    branchSlugs: ['urganch-markaz'],
    order: 4,
  },
  {
    slug: 'malika-safarova',
    fullName: 'Malika Safarova',
    role: { uz: 'Rus tili o‘qituvchisi', ru: 'Преподаватель русского', en: 'Russian Teacher' },
    bio: {
      uz: 'Noldan B2 gacha. Yozma savodxonlik va suhbat amaliyotini teng olib boradi.',
      ru: 'С нуля до B2. Одинаково развивает письменную грамотность и разговорную практику.',
      en: 'From zero to B2, giving equal weight to written literacy and conversation practice.',
    },
    subjects: ['rus-tili'],
    certificates: [],
    experienceYears: 6,
    photo: null,
    branchSlugs: ['urganch-markaz'],
    order: 5,
  },
  {
    slug: 'bekzod-matyoqubov',
    fullName: 'Bekzod Matyoqubov',
    role: { uz: 'Turk tili o‘qituvchisi', ru: 'Преподаватель турецкого', en: 'Turkish Teacher' },
    bio: {
      uz: 'TÖMER formatida dars beradi. Turkiyada o‘qishni rejalashtirganlar uchun alohida modul olib boradi.',
      ru: 'Преподаёт в формате TÖMER. Ведёт отдельный модуль для планирующих учёбу в Турции.',
      en: 'Teaches in the TÖMER format, and runs a separate module for students planning to study in Türkiye.',
    },
    subjects: ['turk-tili'],
    certificates: ['TÖMER C1'],
    experienceYears: 3,
    photo: null,
    branchSlugs: ['urganch-markaz'],
    order: 6,
  },
]

export const TEACHERS: Teacher[] = withSample(SAMPLE_TEACHERS)

export type Result = {
  id: string
  studentName: string
  courseSlug: string
  /** Free text — "IELTS 7.5", "CEFR C1" — so the admin is not boxed in. */
  achievement: string
  year: number
  quote: Localized | null
  photo: string | null
}

const SAMPLE_RESULTS: Result[] = [
  {
    id: 'r1',
    studentName: 'Dilnoza R.',
    courseSlug: 'ielts',
    achievement: 'IELTS 7.5',
    year: 2026,
    quote: {
      uz: 'Writing bo‘yicha har hafta izoh olganim natijani ikki bandga ko‘tardi.',
      ru: 'Еженедельный разбор Writing поднял мой результат на два балла.',
      en: 'Weekly Writing feedback moved my score up by two bands.',
    },
    photo: null,
  },
  { id: 'r2', studentName: 'Aziz T.', courseSlug: 'ielts', achievement: 'IELTS 7.0', year: 2026, quote: null, photo: null },
  { id: 'r3', studentName: 'Shohruh N.', courseSlug: 'ielts', achievement: 'IELTS 6.5', year: 2026, quote: null, photo: null },
  {
    id: 'r4',
    studentName: 'Madina Y.',
    courseSlug: 'general-english',
    achievement: 'CEFR C1',
    year: 2026,
    quote: {
      uz: 'Ikki yil ichida A2 dan C1 ga chiqdim. Kichik guruh juda yordam berdi.',
      ru: 'За два года прошла путь от A2 до C1. Очень помогла малая группа.',
      en: 'I went from A2 to C1 in two years. The small group made the difference.',
    },
    photo: null,
  },
  { id: 'r5', studentName: 'Islom B.', courseSlug: 'general-english', achievement: 'CEFR B2', year: 2025, quote: null, photo: null },
  { id: 'r6', studentName: 'Zilola M.', courseSlug: 'general-english', achievement: 'CEFR B2', year: 2025, quote: null, photo: null },
  { id: 'r7', studentName: 'Javohir A.', courseSlug: 'milliy-sertifikat', achievement: 'Milliy sertifikat B2', year: 2026, quote: null, photo: null },
  { id: 'r8', studentName: 'Sevara Q.', courseSlug: 'milliy-sertifikat', achievement: 'Milliy sertifikat C1', year: 2026, quote: null, photo: null },
  { id: 'r9', studentName: 'Ruslan X.', courseSlug: 'matematika', achievement: 'Matematika 89/100', year: 2026, quote: null, photo: null },
  { id: 'r10', studentName: 'Gulnora S.', courseSlug: 'rus-tili', achievement: 'Rus tili B2', year: 2025, quote: null, photo: null },
  { id: 'r11', studentName: 'Otabek J.', courseSlug: 'turk-tili', achievement: 'TÖMER B1', year: 2025, quote: null, photo: null },
  { id: 'r12', studentName: 'Kamola I.', courseSlug: 'ielts', achievement: 'IELTS 6.5', year: 2025, quote: null, photo: null },
]

export const RESULTS: Result[] = withSample(SAMPLE_RESULTS)

export type Testimonial = {
  id: string
  authorName: string
  role: Localized
  body: Localized
  /** Video reviews play through the protected player (§17, §18). */
  videoId: string | null
}

const SAMPLE_TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    authorName: 'Dilnoza R.',
    role: { uz: 'IELTS bitiruvchisi', ru: 'Выпускница IELTS', en: 'IELTS graduate' },
    body: {
      uz: 'Mock testlar haqiqiy imtihon sharoitida o‘tkazilgani uchun imtihon kuni hech qanday kutilmagan narsa bo‘lmadi.',
      ru: 'Пробные тесты проходили в реальных экзаменационных условиях, поэтому в день экзамена не было ничего неожиданного.',
      en: 'The mock tests ran under real exam conditions, so nothing on the day itself was a surprise.',
    },
    videoId: null,
  },
  {
    id: 't2',
    authorName: 'Nodira A.',
    role: { uz: 'Ota-ona', ru: 'Родитель', en: 'Parent' },
    body: {
      uz: 'Farzandim darsga kelmasa, menga darhol xabar keladi. Davomat kalendari doim ochiq — bu men uchun eng muhimi.',
      ru: 'Если ребёнок не приходит на занятие, мне сразу приходит уведомление. Календарь посещаемости всегда открыт — для меня это главное.',
      en: 'If my child misses a lesson I am notified straight away. The attendance calendar is always open, and that matters most to me.',
    },
    videoId: null,
  },
  {
    id: 't3',
    authorName: 'Javohir A.',
    role: { uz: 'Milliy sertifikat', ru: 'Национальный сертификат', en: 'National certificate' },
    body: {
      uz: 'Vaqt boshqaruvi bo‘yicha mashqlar imtihonda hal qiluvchi bo‘ldi. Bo‘limlar bo‘yicha alohida ishlaganimiz juda foydali edi.',
      ru: 'Упражнения на тайм-менеджмент оказались решающими на экзамене. Отработка по разделам была очень полезна.',
      en: 'The time-management drills were decisive in the exam. Working through the sections separately helped a great deal.',
    },
    videoId: null,
  },
]

export const TESTIMONIALS: Testimonial[] = withSample(SAMPLE_TESTIMONIALS)

export function getTeachers(): Teacher[] {
  return [...TEACHERS].sort((a, b) => a.order - b.order)
}

export function getTeacher(slug: string): Teacher | undefined {
  return TEACHERS.find((teacher) => teacher.slug === slug)
}

export function getResults(): Result[] {
  return [...RESULTS].sort((a, b) => b.year - a.year)
}

/** Course slugs that actually have a result, for the wall's filter row. */
export function getResultCourseSlugs(): string[] {
  return [...new Set(RESULTS.map((result) => result.courseSlug))]
}

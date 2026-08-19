/**
 * Course catalogue — TZ §2 lists the real product set from the workbook sheets:
 * ENGLISH, KIDS, MT, RAZGOVOR, RUS TILI, TURK TILI, SUMMER, ONLINE, MATEMATIKA.
 *
 * ⚠️ Prices and durations are placeholders pending the client's confirmation of
 * `Chek` units (§31 Q2) and per-branch pricing (§5.3). Money is stored as an
 * integer number of so'm per TZ §26.4 — never a float, never "700".
 */
import type { Localized } from '@leader/shared/locales'

export type Course = {
  slug: string
  /** Workbook sheet this course maps to, for the Phase 9 importer. */
  workbookSheet: string
  name: Localized
  tagline: Localized
  description: Localized
  level: Localized
  ageRange: Localized
  durationMonths: number
  lessonsPerWeek: number
  /** Monthly fee in whole so'm. */
  priceMonthly: number
  groupSize: number
  /** Index into the gradient set in `courseGradient()`. */
  accent: number
  highlights: Localized[]
  order: number
  isPublic: boolean
}

export const COURSES: Course[] = [
  {
    slug: 'general-english',
    workbookSheet: 'ENGLISH',
    name: { uz: 'General English', ru: 'General English', en: 'General English' },
    tagline: {
      uz: 'A1 dan C1 gacha — bosqichma-bosqich, CEFR bo‘yicha',
      ru: 'От A1 до C1 — шаг за шагом, по шкале CEFR',
      en: 'A1 to C1 — step by step, on the CEFR scale',
    },
    description: {
      uz: 'Tinglash, gapirish, o‘qish va yozish ko‘nikmalari bir vaqtda rivojlantiriladi. Har bosqich oxirida daraja testi topshiriladi va natija shaxsiy kabinetda ko‘rinadi.',
      ru: 'Аудирование, говорение, чтение и письмо развиваются одновременно. В конце каждого уровня — тест, результат виден в личном кабинете.',
      en: 'Listening, speaking, reading and writing developed together. Each level ends with a placement test whose result appears in the personal cabinet.',
    },
    level: { uz: 'A1 — C1', ru: 'A1 — C1', en: 'A1 — C1' },
    ageRange: { uz: '14+ yosh', ru: '14+ лет', en: 'Ages 14+' },
    durationMonths: 8,
    lessonsPerWeek: 3,
    priceMonthly: 700000,
    groupSize: 12,
    accent: 0,
    highlights: [
      {
        uz: 'CEFR bo‘yicha daraja testi',
        ru: 'Тест уровня по CEFR',
        en: 'CEFR placement test',
      },
      { uz: 'Kichik guruhlar', ru: 'Малые группы', en: 'Small groups' },
      { uz: 'Har oy nazorat ishi', ru: 'Ежемесячная контрольная', en: 'Monthly control test' },
    ],
    order: 1,
    isPublic: true,
  },
  {
    slug: 'ielts',
    workbookSheet: 'ENGLISH',
    name: { uz: 'IELTS tayyorgarlik', ru: 'Подготовка к IELTS', en: 'IELTS Preparation' },
    tagline: {
      uz: 'Imtihon formatida mock testlar bilan',
      ru: 'С пробными тестами в формате экзамена',
      en: 'With full mock tests in exam format',
    },
    description: {
      uz: 'To‘rt modul bo‘yicha intensiv tayyorgarlik. Har hafta Writing tekshiruvi va Speaking suhbati, oyiga bir marta to‘liq mock test.',
      ru: 'Интенсивная подготовка по четырём модулям. Еженедельная проверка Writing и собеседование Speaking, раз в месяц — полный mock-тест.',
      en: 'Intensive preparation across all four modules. Weekly Writing feedback and Speaking interview, a full mock test once a month.',
    },
    level: { uz: 'B1+', ru: 'B1+', en: 'B1+' },
    ageRange: { uz: '16+ yosh', ru: '16+ лет', en: 'Ages 16+' },
    durationMonths: 6,
    lessonsPerWeek: 3,
    priceMonthly: 900000,
    groupSize: 10,
    accent: 1,
    highlights: [
      { uz: 'Oylik mock test', ru: 'Ежемесячный mock-тест', en: 'Monthly mock test' },
      {
        uz: 'Writing bo‘yicha shaxsiy izoh',
        ru: 'Персональный разбор Writing',
        en: 'Individual Writing feedback',
      },
      { uz: 'Speaking klub', ru: 'Speaking-клуб', en: 'Speaking club' },
    ],
    order: 2,
    isPublic: true,
  },
  {
    slug: 'kids',
    workbookSheet: 'KIDS',
    name: { uz: 'Kids English', ru: 'Английский для детей', en: 'Kids English' },
    tagline: {
      uz: 'O‘yin orqali — 7 yoshdan boshlab',
      ru: 'Через игру — с 7 лет',
      en: 'Through play — from age 7',
    },
    description: {
      uz: 'Bolalar uchun maxsus dastur: qo‘shiq, o‘yin va vizual materiallar asosida. Ota-ona davomat va natijalarni shaxsiy kabinetdan kuzatib boradi.',
      ru: 'Специальная программа для детей: песни, игры и визуальные материалы. Родитель следит за посещаемостью и результатами в личном кабинете.',
      en: 'A dedicated childrens programme built on songs, games and visual material. Parents follow attendance and results from the personal cabinet.',
    },
    level: { uz: 'Boshlang‘ich', ru: 'Начальный', en: 'Beginner' },
    ageRange: { uz: '7 — 12 yosh', ru: '7 — 12 лет', en: 'Ages 7 — 12' },
    durationMonths: 9,
    lessonsPerWeek: 2,
    priceMonthly: 500000,
    groupSize: 10,
    accent: 2,
    highlights: [
      {
        uz: 'Ota-ona uchun davomat shaffofligi',
        ru: 'Прозрачная посещаемость для родителей',
        en: 'Attendance transparency for parents',
      },
      { uz: 'O‘yin asosida', ru: 'Игровой формат', en: 'Play-based' },
      { uz: 'Kichik guruh', ru: 'Малая группа', en: 'Small group' },
    ],
    order: 3,
    isPublic: true,
  },
  {
    slug: 'razgovor',
    workbookSheet: 'РАЗГОВОР',
    name: { uz: 'Suhbat klubi', ru: 'Разговорный клуб', en: 'Speaking Club' },
    tagline: {
      uz: 'Faqat gapirish — grammatikasiz',
      ru: 'Только речь — без грамматики',
      en: 'Speaking only — no grammar drills',
    },
    description: {
      uz: 'Har darsda yangi mavzu, munozara va rolli o‘yinlar. Til to‘sig‘ini yengish uchun eng tez yo‘l.',
      ru: 'Новая тема каждое занятие, дискуссии и ролевые игры. Самый быстрый способ преодолеть языковой барьер.',
      en: 'A new topic every session, discussion and role-play. The fastest way past the speaking barrier.',
    },
    level: { uz: 'A2+', ru: 'A2+', en: 'A2+' },
    ageRange: { uz: '14+ yosh', ru: '14+ лет', en: 'Ages 14+' },
    durationMonths: 3,
    lessonsPerWeek: 2,
    priceMonthly: 450000,
    groupSize: 8,
    accent: 3,
    highlights: [
      { uz: 'Har darsda yangi mavzu', ru: 'Новая тема каждый раз', en: 'New topic every session' },
      { uz: '8 kishilik guruh', ru: 'Группа из 8 человек', en: 'Groups of 8' },
      { uz: 'Rolli o‘yinlar', ru: 'Ролевые игры', en: 'Role-play' },
    ],
    order: 4,
    isPublic: true,
  },
  {
    slug: 'rus-tili',
    workbookSheet: 'RUS TILI',
    name: { uz: 'Rus tili', ru: 'Русский язык', en: 'Russian Language' },
    tagline: {
      uz: 'Noldan suhbat darajasigacha',
      ru: 'С нуля до разговорного уровня',
      en: 'From zero to conversational',
    },
    description: {
      uz: 'Grammatika, lug‘at va suhbat amaliyoti. Ish va o‘qish uchun kerak bo‘ladigan rus tili.',
      ru: 'Грамматика, лексика и разговорная практика. Русский язык для работы и учёбы.',
      en: 'Grammar, vocabulary and conversation practice. The Russian you need for work and study.',
    },
    level: { uz: 'A1 — B2', ru: 'A1 — B2', en: 'A1 — B2' },
    ageRange: { uz: '12+ yosh', ru: '12+ лет', en: 'Ages 12+' },
    durationMonths: 8,
    lessonsPerWeek: 3,
    priceMonthly: 600000,
    groupSize: 12,
    accent: 4,
    highlights: [
      { uz: 'Suhbat amaliyoti', ru: 'Разговорная практика', en: 'Conversation practice' },
      { uz: 'Yozma savodxonlik', ru: 'Письменная грамотность', en: 'Written literacy' },
      { uz: 'Bosqichma-bosqich', ru: 'Пошагово', en: 'Step by step' },
    ],
    order: 5,
    isPublic: true,
  },
  {
    slug: 'turk-tili',
    workbookSheet: 'TURK TILI',
    name: { uz: 'Turk tili', ru: 'Турецкий язык', en: 'Turkish Language' },
    tagline: {
      uz: 'O‘qish va ish uchun turk tili',
      ru: 'Турецкий для учёбы и работы',
      en: 'Turkish for study and work',
    },
    description: {
      uz: 'O‘zbek tiliga yaqinligi tufayli tez o‘zlashtiriladi. Turkiyada o‘qishni rejalashtirganlar uchun alohida modul.',
      ru: 'Благодаря близости к узбекскому осваивается быстро. Отдельный модуль для планирующих учёбу в Турции.',
      en: 'Quick to pick up thanks to its closeness to Uzbek. A separate module for those planning to study in Türkiye.',
    },
    level: { uz: 'A1 — B1', ru: 'A1 — B1', en: 'A1 — B1' },
    ageRange: { uz: '14+ yosh', ru: '14+ лет', en: 'Ages 14+' },
    durationMonths: 6,
    lessonsPerWeek: 3,
    priceMonthly: 600000,
    groupSize: 12,
    accent: 5,
    highlights: [
      { uz: 'Tez o‘zlashtirish', ru: 'Быстрое освоение', en: 'Fast progress' },
      { uz: 'TÖMER formatida', ru: 'В формате TÖMER', en: 'TÖMER format' },
      { uz: 'Suhbat mashqlari', ru: 'Разговорные упражнения', en: 'Speaking drills' },
    ],
    order: 6,
    isPublic: true,
  },
  {
    slug: 'matematika',
    workbookSheet: 'MATEMATIKA',
    name: { uz: 'Matematika', ru: 'Математика', en: 'Mathematics' },
    tagline: {
      uz: 'Maktab dasturi va imtihonga tayyorgarlik',
      ru: 'Школьная программа и подготовка к экзамену',
      en: 'School curriculum and exam preparation',
    },
    description: {
      uz: 'Maktab dasturidagi bo‘shliqlarni to‘ldirish va imtihon masalalarini yechish. Har mavzu oxirida nazorat ishi.',
      ru: 'Закрытие пробелов школьной программы и решение экзаменационных задач. Контрольная в конце каждой темы.',
      en: 'Closing gaps in the school curriculum and working through exam problems. A control test at the end of each topic.',
    },
    level: { uz: '5 — 11 sinf', ru: '5 — 11 класс', en: 'Grades 5 — 11' },
    ageRange: { uz: '11 — 18 yosh', ru: '11 — 18 лет', en: 'Ages 11 — 18' },
    durationMonths: 9,
    lessonsPerWeek: 3,
    priceMonthly: 650000,
    groupSize: 12,
    accent: 6,
    highlights: [
      { uz: 'Har mavzuda nazorat', ru: 'Контроль по каждой теме', en: 'Test on every topic' },
      { uz: 'Reyting jadvali', ru: 'Таблица рейтинга', en: 'Ranking table' },
      { uz: 'Imtihon masalalari', ru: 'Экзаменационные задачи', en: 'Exam problems' },
    ],
    order: 7,
    isPublic: true,
  },
  {
    slug: 'milliy-sertifikat',
    workbookSheet: 'MT',
    name: { uz: 'Milliy sertifikat', ru: 'Национальный сертификат', en: 'National Certificate' },
    tagline: {
      uz: 'Milliy sertifikat imtihoniga maqsadli tayyorgarlik',
      ru: 'Целевая подготовка к экзамену на национальный сертификат',
      en: 'Focused preparation for the national certificate exam',
    },
    description: {
      uz: 'Imtihon formatiga qaratilgan intensiv kurs: bo‘limlar bo‘yicha mashq, vaqt boshqaruvi va sinov imtihonlari.',
      ru: 'Интенсивный курс под формат экзамена: отработка по разделам, тайм-менеджмент и пробные экзамены.',
      en: 'An intensive course built around the exam format: section drills, time management and trial exams.',
    },
    level: { uz: 'B1 — C1', ru: 'B1 — C1', en: 'B1 — C1' },
    ageRange: { uz: '16+ yosh', ru: '16+ лет', en: 'Ages 16+' },
    durationMonths: 4,
    lessonsPerWeek: 3,
    priceMonthly: 800000,
    groupSize: 10,
    accent: 7,
    highlights: [
      { uz: 'Sinov imtihonlari', ru: 'Пробные экзамены', en: 'Trial exams' },
      { uz: 'Vaqt boshqaruvi', ru: 'Тайм-менеджмент', en: 'Time management' },
      { uz: 'Bo‘limlar bo‘yicha mashq', ru: 'Отработка по разделам', en: 'Section drills' },
    ],
    order: 8,
    isPublic: true,
  },
  {
    slug: 'yozgi-maktab',
    workbookSheet: 'SUMMER',
    name: { uz: 'Yozgi maktab', ru: 'Летняя школа', en: 'Summer School' },
    tagline: {
      uz: 'Yozda bo‘sh qolmang — intensiv 2 oy',
      ru: 'Не теряйте лето — интенсив на 2 месяца',
      en: 'Do not lose the summer — two intensive months',
    },
    description: {
      uz: 'Iyun–avgust oylarida kunlik darslar, o‘yinlar va loyihalar. Yangi o‘quv yiliga tayyor holda kirish.',
      ru: 'Ежедневные занятия, игры и проекты с июня по август. Вход в новый учебный год подготовленным.',
      en: 'Daily lessons, games and projects from June to August. Start the new school year ready.',
    },
    level: { uz: 'Barcha darajalar', ru: 'Все уровни', en: 'All levels' },
    ageRange: { uz: '7 — 16 yosh', ru: '7 — 16 лет', en: 'Ages 7 — 16' },
    durationMonths: 2,
    lessonsPerWeek: 5,
    priceMonthly: 550000,
    groupSize: 14,
    accent: 8,
    highlights: [
      { uz: 'Har kuni dars', ru: 'Занятия каждый день', en: 'Lessons every day' },
      { uz: 'Loyiha ishlari', ru: 'Проектная работа', en: 'Project work' },
      { uz: 'Tadbirlar', ru: 'Мероприятия', en: 'Events' },
    ],
    order: 9,
    isPublic: true,
  },
  {
    slug: 'onlayn',
    workbookSheet: 'ONLINE',
    name: { uz: 'Onlayn kurslar', ru: 'Онлайн-курсы', en: 'Online Courses' },
    tagline: {
      uz: 'Xorazmning istalgan nuqtasidan',
      ru: 'Из любой точки Хорезма',
      en: 'From anywhere in Khorezm',
    },
    description: {
      uz: 'Jonli onlayn darslar, yozib olingan materiallar va shaxsiy kabinetdagi kutubxona. Davomat va to‘lovlar xuddi oflayn kabi kuzatiladi.',
      ru: 'Живые онлайн-занятия, записанные материалы и библиотека в личном кабинете. Посещаемость и оплаты отслеживаются как в офлайне.',
      en: 'Live online lessons, recorded material and the library in the personal cabinet. Attendance and payments tracked exactly as offline.',
    },
    level: { uz: 'Barcha darajalar', ru: 'Все уровни', en: 'All levels' },
    ageRange: { uz: '12+ yosh', ru: '12+ лет', en: 'Ages 12+' },
    durationMonths: 6,
    lessonsPerWeek: 3,
    priceMonthly: 450000,
    groupSize: 15,
    accent: 9,
    highlights: [
      { uz: 'Jonli darslar', ru: 'Живые занятия', en: 'Live lessons' },
      { uz: 'Yozib olingan darslar', ru: 'Записи занятий', en: 'Recorded lessons' },
      { uz: 'Onlayn kutubxona', ru: 'Онлайн-библиотека', en: 'Online library' },
    ],
    order: 10,
    isPublic: true,
  },
]

/**
 * Ten course accents derived from the signature gradient by rotating the hue,
 * the same device used for branch accent colours in §5.2.
 */
const COURSE_GRADIENTS = [
  'from-navy-600 via-glaze-600 to-aqua-500',
  'from-navy-700 via-navy-500 to-glaze-500',
  'from-glaze-600 via-aqua-500 to-aqua-300',
  'from-clay-500 via-clay-400 to-glaze-500',
  'from-navy-800 via-glaze-700 to-glaze-500',
  'from-glaze-700 via-glaze-500 to-aqua-400',
  'from-navy-600 via-navy-400 to-aqua-400',
  'from-clay-600 via-clay-500 to-navy-500',
  'from-aqua-500 via-glaze-500 to-navy-600',
  'from-navy-900 via-navy-600 to-glaze-600',
] as const

export function courseGradient(accent: number): string {
  return COURSE_GRADIENTS[accent % COURSE_GRADIENTS.length] ?? COURSE_GRADIENTS[0]
}

export function getCourses(): Course[] {
  return COURSES.filter((course) => course.isPublic).sort((a, b) => a.order - b.order)
}

export function getCourse(slug: string): Course | undefined {
  return COURSES.find((course) => course.slug === slug && course.isPublic)
}

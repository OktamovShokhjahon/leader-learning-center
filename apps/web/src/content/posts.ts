/**
 * TZ §6.1 / §22 — the `posts` collection powering `/news` and `/news/[slug]`.
 * The blog exists mainly for SEO: it is the only part of the site that grows new
 * indexable URLs without a developer.
 *
 * These are the centre's own announcements rather than claims about named
 * people, so they are not gated by `SAMPLE_CONTENT` — they are drafts to edit,
 * not records to delete. Every one describes something the site itself already
 * does, so none of it asserts anything the centre has not committed to.
 *
 * Replaced in Phase 6 by `GET /public/posts` with the identical shape.
 */
import type { Localized } from '@leader/shared/locales'

export type Post = {
  slug: string
  title: Localized
  excerpt: Localized
  body: Localized[]
  cover: string | null
  publishedAt: string
  tags: string[]
  isPublished: boolean
}

export const POSTS: Post[] = [
  {
    slug: 'yangi-oquv-yili-2026',
    title: {
      uz: 'Yangi o‘quv yili: sentabr guruhlariga yozilish ochildi',
      ru: 'Новый учебный год: запись в сентябрьские группы открыта',
      en: 'New academic year: September groups are open for enrolment',
    },
    excerpt: {
      uz: 'Ingliz tili, matematika, rus va turk tillari bo‘yicha yangi guruhlar sentabrdan boshlanadi. Har bir guruh daraja testi bilan shakllanadi.',
      ru: 'Новые группы по английскому, математике, русскому и турецкому языкам стартуют с сентября. Каждая группа формируется по результатам теста уровня.',
      en: 'New groups in English, mathematics, Russian and Turkish start in September. Every group is formed on the results of a placement test.',
    },
    body: [
      {
        uz: 'Sentabr oyidan boshlab barcha yo‘nalishlar bo‘yicha yangi guruhlar ochiladi. Guruhlar daraja testi natijalari asosida shakllantiriladi — shuning uchun bir guruhdagi o‘quvchilarning bilim darajasi bir-biriga yaqin bo‘ladi va dars sur’ati hech kimga tez yoki sekin tuyulmaydi.',
        ru: 'С сентября открываются новые группы по всем направлениям. Группы формируются по результатам теста уровня — поэтому уровень учеников внутри группы близок, и темп занятий не кажется никому слишком быстрым или слишком медленным.',
        en: 'New groups open across every subject from September. Groups are formed on placement-test results, so students within a group are close in level and the pace never feels too fast or too slow for anyone.',
      },
      {
        uz: 'Yozilish uchun saytdagi qisqa shaklni to‘ldirish kifoya. Menejer 24 soat ichida bog‘lanadi, bepul sinov darsiga yozadi va daraja testi vaqtini kelishadi. Sinov darsi hech qanday majburiyat yuklamaydi.',
        ru: 'Для записи достаточно заполнить короткую форму на сайте. Менеджер свяжется в течение 24 часов, запишет на бесплатный пробный урок и согласует время теста уровня. Пробный урок ни к чему не обязывает.',
        en: 'To enrol, fill in the short form on this site. A manager gets in touch within 24 hours, books a free trial lesson and agrees a time for the placement test. The trial lesson carries no obligation.',
      },
      {
        uz: 'O‘qish boshlangach har bir o‘quvchi va ota-ona uchun shaxsiy kabinet ochiladi: davomat kalendari, nazorat ishlari natijalari, to‘lovlar tarixi va kutubxona bir joyda bo‘ladi.',
        ru: 'После начала обучения для каждого ученика и родителя открывается личный кабинет: календарь посещаемости, результаты контрольных, история оплат и библиотека — в одном месте.',
        en: 'Once studies begin, every student and parent gets a personal cabinet: the attendance calendar, control-test results, payment history and the library, all in one place.',
      },
    ],
    cover: null,
    publishedAt: '2026-08-15',
    tags: ['enrolment'],
    isPublished: true,
  },
  {
    slug: 'ota-onalar-uchun-kabinet',
    title: {
      uz: 'Ota-onalar uchun kabinet: davomat endi to‘liq shaffof',
      ru: 'Кабинет для родителей: посещаемость теперь полностью прозрачна',
      en: 'The parent cabinet: attendance is now fully transparent',
    },
    excerpt: {
      uz: 'Farzandingiz darsga kelmasa, sizga xabar boradi. Davomat kalendari, nazorat natijalari va to‘lovlar — bitta ekranda.',
      ru: 'Если ребёнок не пришёл на занятие, вы получите уведомление. Календарь посещаемости, результаты и оплаты — на одном экране.',
      en: 'If your child misses a lesson, you are notified. The attendance calendar, results and payments are on one screen.',
    },
    body: [
      {
        uz: 'Ko‘p ota-onalar uchun eng katta savol oddiy: farzandim darsga bordimi? Endi bu savolga javob olish uchun hech kimga qo‘ng‘iroq qilish kerak emas. Ota-ona kabinetida oylik davomat kalendari ochiq turadi, qoldirilgan kunlar qizil doira bilan belgilanadi.',
        ru: 'Для многих родителей главный вопрос простой: был ли ребёнок на занятии? Теперь, чтобы получить ответ, не нужно никому звонить. В кабинете родителя открыт месячный календарь посещаемости, пропуски отмечены красным кругом.',
        en: 'For most parents the main question is simple: did my child go to the lesson? Answering it no longer means phoning anyone. The parent cabinet keeps a monthly attendance calendar open, with missed days marked by a red circle.',
      },
      {
        uz: 'Qizil doirani bossangiz, o‘sha kungi dars haqidagi ma’lumot ochiladi: fan, vaqt va o‘qituvchi. Sababli qoldirilgan darslar alohida belgilanadi.',
        ru: 'Нажав на красный круг, вы увидите информацию о занятии: предмет, время и преподаватель. Уважительные пропуски отмечаются отдельно.',
        en: 'Tapping a red circle opens the details of that lesson: subject, time and teacher. Excused absences are marked separately.',
      },
      {
        uz: 'Ketma-ket uch marta sababsiz qoldirilsa, tizim ota-onaga avtomatik xabar yuboradi va menejerga qo‘ng‘iroq qilish vazifasini qo‘yadi. Bu — muammoni kech emas, o‘z vaqtida ko‘rish uchun.',
        ru: 'При трёх пропусках подряд без уважительной причины система автоматически уведомляет родителя и ставит менеджеру задачу позвонить. Это нужно, чтобы увидеть проблему вовремя, а не поздно.',
        en: 'After three consecutive unexcused absences the system notifies the parent automatically and creates a task for a manager to call. The point is to see a problem early rather than late.',
      },
    ],
    cover: null,
    publishedAt: '2026-07-28',
    tags: ['cabinet', 'parents'],
    isPublished: true,
  },
  {
    slug: 'imtihon-formatidagi-mock-testlar',
    title: {
      uz: 'Imtihon formatidagi mock testlar har oy o‘tkaziladi',
      ru: 'Пробные тесты в формате экзамена проходят каждый месяц',
      en: 'Exam-format mock tests now run every month',
    },
    excerpt: {
      uz: 'To‘liq vaqt chegarasi, haqiqiy imtihon tartibi va bo‘limlar bo‘yicha alohida tahlil. Natija imtihon kuni kutilmagan bo‘lmasligi uchun.',
      ru: 'Полное ограничение по времени, реальный порядок экзамена и разбор по разделам. Чтобы результат в день экзамена не стал неожиданностью.',
      en: 'Full time limits, the real exam procedure, and a section-by-section review — so the result on exam day is never a surprise.',
    },
    body: [
      {
        uz: 'IELTS va Milliy sertifikat guruhlarida oyiga bir marta to‘liq mock test o‘tkaziladi. Test haqiqiy imtihon tartibida boradi: bir xil vaqt chegarasi, bir xil ketma-ketlik, telefonlarsiz.',
        ru: 'В группах IELTS и национального сертификата раз в месяц проводится полный пробный тест. Он идёт по регламенту настоящего экзамена: то же ограничение времени, та же последовательность, без телефонов.',
        en: 'IELTS and national-certificate groups sit a full mock test once a month. It runs to the real exam procedure: the same time limits, the same order of sections, no phones.',
      },
      {
        uz: 'Testdan keyin har bir o‘quvchi bo‘limlar bo‘yicha alohida tahlil oladi. Writing va Speaking bo‘yicha izoh shaxsiy beriladi, Listening va Reading esa xatolar turi bo‘yicha guruhlanadi.',
        ru: 'После теста каждый ученик получает разбор по разделам. По Writing и Speaking комментарий даётся индивидуально, по Listening и Reading ошибки группируются по типам.',
        en: 'Afterwards every student gets a section-by-section review. Writing and Speaking feedback is individual; Listening and Reading errors are grouped by type.',
      },
      {
        uz: 'Barcha natijalar shaxsiy kabinetdagi reyting bo‘limida saqlanadi, shuning uchun o‘quvchi o‘z dinamikasini oydan oyga ko‘rib boradi.',
        ru: 'Все результаты сохраняются в разделе рейтинга личного кабинета, поэтому ученик видит свою динамику из месяца в месяц.',
        en: 'Every result is stored in the ranking section of the personal cabinet, so a student can watch their own trend month by month.',
      },
    ],
    cover: null,
    publishedAt: '2026-06-10',
    tags: ['ielts', 'exams'],
    isPublished: true,
  },
  {
    slug: 'yozgi-maktab-natijalari',
    title: {
      uz: 'Yozgi maktab yakunlandi: ikki oyda kunlik darslar',
      ru: 'Летняя школа завершена: два месяца ежедневных занятий',
      en: 'Summer school has finished: two months of daily lessons',
    },
    excerpt: {
      uz: 'Iyun va iyul oylarida yozgi maktab guruhi kunlik darslar, loyiha ishlari va tadbirlar bilan o‘tdi.',
      ru: 'В июне и июле группа летней школы занималась ежедневно, с проектной работой и мероприятиями.',
      en: 'Through June and July the summer-school group met daily, with project work and events.',
    },
    body: [
      {
        uz: 'Yozgi maktab guruhi ikki oy davomida haftasiga besh kundan shug‘ullandi. Dastur odatdagi darsdan farq qiladi: ko‘proq amaliyot, kamroq nazariya, va har hafta bitta kichik loyiha.',
        ru: 'Группа летней школы занималась пять дней в неделю в течение двух месяцев. Программа отличается от обычной: больше практики, меньше теории и один небольшой проект каждую неделю.',
        en: 'The summer-school group met five days a week for two months. The programme differs from the regular one: more practice, less theory, and one small project each week.',
      },
      {
        uz: 'Yozgi maktabning maqsadi — yangi o‘quv yiliga tayyor holda kirish. Ko‘pchilik uchun bu yozda bilimni yo‘qotmaslikning eng oddiy usuli bo‘ldi.',
        ru: 'Цель летней школы — войти в новый учебный год подготовленным. Для большинства это оказался самый простой способ не растерять знания за лето.',
        en: 'The aim of summer school is to start the new academic year ready. For most students it is simply the easiest way not to lose ground over the summer.',
      },
    ],
    cover: null,
    publishedAt: '2026-08-05',
    tags: ['summer'],
    isPublished: true,
  },
]

export function getPosts(): Post[] {
  return POSTS.filter((post) => post.isPublished).sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  )
}

export function getPost(slug: string): Post | undefined {
  return POSTS.find((post) => post.slug === slug && post.isPublished)
}

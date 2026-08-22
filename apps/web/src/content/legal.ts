/**
 * TZ §6.1 — the public offer and privacy policy. §11.4 makes both a hard
 * prerequisite for switching online payment on.
 *
 * ⚠️ These are DRAFTS for the centre's lawyer to review and sign off, not legal
 * advice and not a substitute for it. They are written from what the system
 * actually does — which data it collects, why, and for how long — so the review
 * starts from something accurate rather than from a blank page.
 *
 * Two points the lawyer must decide on before publication:
 *   · the refund terms in the offer (§11.2 allows refunds; the policy is the
 *     centre's to set),
 *   · the retention period for personal data of minors (§27 requires a
 *     documented policy; three years is a placeholder).
 */
import type { Localized } from '@leader/shared/locales'

export type LegalSection = { heading: Localized; body: Localized[] }

const s = (
  heading: [string, string, string],
  ...body: [string, string, string][]
): LegalSection => ({
  heading: { uz: heading[0], ru: heading[1], en: heading[2] },
  body: body.map(([uz, ru, en]) => ({ uz, ru, en })),
})

export const OFFER: LegalSection[] = [
  s(
    ['1. Umumiy qoidalar', '1. Общие положения', '1. General provisions'],
    [
      'Ushbu hujjat Leader Learning Centre (keyingi o‘rinlarda — O‘quv markazi) tomonidan taqdim etiladigan ta’lim xizmatlari bo‘yicha ommaviy oferta hisoblanadi. Saytda ariza qoldirish yoki to‘lovni amalga oshirish ushbu oferta shartlarini to‘liq qabul qilishni anglatadi.',
      'Настоящий документ является публичной офертой на образовательные услуги, оказываемые Leader Learning Centre (далее — Учебный центр). Оставление заявки на сайте или внесение оплаты означает полное принятие условий настоящей оферты.',
      'This document is a public offer for the educational services provided by Leader Learning Centre (the Centre). Submitting an application on this site or making a payment constitutes full acceptance of these terms.',
    ],
  ),
  s(
    ['2. Xizmat predmeti', '2. Предмет услуг', '2. Scope of services'],
    [
      'O‘quv markazi guruh shaklidagi til va matematika kurslarini tashkil etadi. Har bir kursning davomiyligi, haftalik darslar soni, guruh hajmi va oylik to‘lov miqdori saytdagi tegishli kurs sahifasida ko‘rsatiladi.',
      'Учебный центр организует групповые курсы языков и математики. Длительность каждого курса, количество занятий в неделю, размер группы и ежемесячная стоимость указаны на соответствующей странице курса на сайте.',
      'The Centre runs group courses in languages and mathematics. The duration, the number of lessons per week, the group size and the monthly fee for each course are stated on that course’s page on this site.',
    ],
    [
      'O‘qish guruhga qabul qilingandan so‘ng boshlanadi. Guruh daraja testi natijalari asosida shakllantiriladi.',
      'Обучение начинается после зачисления в группу. Группа формируется по результатам теста уровня.',
      'Study begins once a student is enrolled in a group. Groups are formed on the results of a placement test.',
    ],
  ),
  s(
    ['3. To‘lov tartibi', '3. Порядок оплаты', '3. Payment'],
    [
      'To‘lov oylik tarzda, joriy oy uchun amalga oshiriladi. To‘lovni naqd pul, plastik karta, bank o‘tkazmasi, shuningdek Payme, Click va Uzum orqali amalga oshirish mumkin.',
      'Оплата производится ежемесячно, за текущий месяц. Оплатить можно наличными, картой, банковским переводом, а также через Payme, Click и Uzum.',
      'Fees are paid monthly, for the current month. Payment may be made in cash, by card, by bank transfer, or through Payme, Click and Uzum.',
    ],
    [
      'Har bir to‘lov uchun kvitansiya beriladi va shaxsiy kabinetdagi to‘lovlar tarixida saqlanadi. To‘lov muddati o‘tgan taqdirda o‘quvchi qarzdor sifatida belgilanadi va unga eslatma yuboriladi.',
      'На каждую оплату выдаётся квитанция, которая сохраняется в истории оплат личного кабинета. При просрочке ученик отмечается как должник и получает напоминание.',
      'A receipt is issued for every payment and stored in the payment history of the personal cabinet. If a payment is late the student is marked as a debtor and a reminder is sent.',
    ],
  ),
  s(
    [
      '4. Bekor qilish va qaytarish',
      '4. Отмена и возврат',
      '4. Cancellation and refunds',
    ],
    [
      'O‘quvchi istalgan vaqtda o‘qishni to‘xtatishi mumkin. Foydalanilmagan davr uchun to‘lovni qaytarish tartibi O‘quv markazi bilan alohida kelishiladi.',
      'Ученик может прекратить обучение в любое время. Порядок возврата оплаты за неиспользованный период согласовывается с Учебным центром отдельно.',
      'A student may stop attending at any time. Any refund for an unused period is agreed separately with the Centre.',
    ],
    [
      'O‘quv markazi tomonidan bekor qilingan darslar to‘langan oyni sarflamaydi va qayta rejalashtiriladi.',
      'Занятия, отменённые Учебным центром, не расходуют оплаченный месяц и переносятся.',
      'Lessons cancelled by the Centre do not consume a paid month and are rescheduled.',
    ],
  ),
  s(
    ['5. Tomonlarning majburiyatlari', '5. Обязанности сторон', '5. Obligations'],
    [
      'O‘quv markazi dars jadvaliga rioya qilish, malakali o‘qituvchi bilan ta’minlash va davomat hamda natijalarni shaxsiy kabinetda ochiq ko‘rsatish majburiyatini oladi.',
      'Учебный центр обязуется соблюдать расписание, обеспечить квалифицированного преподавателя и открыто отражать посещаемость и результаты в личном кабинете.',
      'The Centre undertakes to keep to the timetable, to provide a qualified teacher, and to show attendance and results openly in the personal cabinet.',
    ],
    [
      'O‘quvchi darslarga muntazam qatnashish, ichki tartib qoidalariga rioya qilish va to‘lovni o‘z vaqtida amalga oshirish majburiyatini oladi.',
      'Ученик обязуется регулярно посещать занятия, соблюдать внутренние правила и своевременно вносить оплату.',
      'The student undertakes to attend regularly, to follow the Centre’s internal rules, and to pay on time.',
    ],
  ),
]

export const PRIVACY: LegalSection[] = [
  s(
    ['1. Qanday ma’lumot yig‘amiz', '1. Какие данные мы собираем', '1. What we collect'],
    [
      'Ariza qoldirganingizda ism va familiyangiz, telefon raqamingiz, yoshingiz yoki sinfingiz, tanlagan kursingiz va filialingiz yig‘iladi. O‘qish boshlangandan so‘ng bunga davomat, nazorat ishlari natijalari va to‘lovlar tarixi qo‘shiladi.',
      'При оставлении заявки собираются имя и фамилия, номер телефона, возраст или класс, выбранный курс и филиал. После начала обучения добавляются посещаемость, результаты контрольных и история оплат.',
      'When you submit an application we collect your name, phone number, age or school class, and the course and branch you chose. Once study begins we add attendance, control-test results and payment history.',
    ],
    [
      'Voyaga yetmagan o‘quvchilar uchun ota-onaning ismi va telefon raqami yig‘iladi — bu qonuniy aloqa uchun zarur.',
      'Для несовершеннолетних учеников собираются имя и телефон родителя — это необходимо для законного контакта.',
      'For students who are minors we collect a parent’s name and phone number, which is required for lawful contact.',
    ],
  ),
  s(
    ['2. Nima uchun ishlatamiz', '2. Зачем мы их используем', '2. Why we use it'],
    [
      'Ma’lumotlar faqat o‘quv jarayonini tashkil etish uchun ishlatiladi: guruhga qabul qilish, davomatni yuritish, to‘lovlarni hisoblash va siz bilan bog‘lanish.',
      'Данные используются только для организации учебного процесса: зачисление в группу, ведение посещаемости, расчёт оплат и связь с вами.',
      'Your data is used only to run the course: enrolling you in a group, recording attendance, calculating fees, and contacting you.',
    ],
    [
      'To‘lov va xavfsizlik bilan bog‘liq xabarlarni o‘chirib bo‘lmaydi. Reklama xarakteridagi xabarlardan istalgan vaqtda voz kechishingiz mumkin.',
      'Сообщения, связанные с оплатой и безопасностью, отключить нельзя. От рекламных сообщений можно отказаться в любое время.',
      'Messages about payment and safety cannot be switched off. You can opt out of marketing messages at any time.',
    ],
  ),
  s(
    ['3. Kim ko‘ra oladi', '3. Кто имеет доступ', '3. Who can see it'],
    [
      'Ma’lumotlaringizni faqat sizning filialingiz xodimlari va O‘quv markazi rahbariyati ko‘radi. Har bir xodim faqat o‘z vazifasi uchun zarur bo‘lgan ma’lumotni ko‘radi: o‘qituvchi davomatni ko‘radi, lekin to‘lov summalarini ko‘rmaydi.',
      'Ваши данные видят только сотрудники вашего филиала и руководство Учебного центра. Каждый сотрудник видит только то, что нужно для его работы: преподаватель видит посещаемость, но не видит суммы оплат.',
      'Only staff at your branch and the Centre’s management can see your data. Each member of staff sees only what their job requires: a teacher sees attendance but not payment amounts.',
    ],
    [
      'Ma’lumotlar uchinchi shaxslarga sotilmaydi va berilmaydi. Istisno — to‘lov provayderlari va SMS xizmati, ular faqat o‘z vazifasini bajarish uchun zarur bo‘lgan minimal ma’lumotni oladi.',
      'Данные не продаются и не передаются третьим лицам. Исключение — платёжные провайдеры и SMS-сервис, которые получают только минимально необходимые для их работы данные.',
      'Data is never sold or passed to third parties. The exception is payment providers and the SMS service, which receive only the minimum needed to do their job.',
    ],
  ),
  s(
    ['4. Qancha vaqt saqlanadi', '4. Сколько хранится', '4. How long we keep it'],
    [
      'O‘quv va moliyaviy yozuvlar buxgalteriya talablari bo‘yicha saqlanadi. O‘qishni tugatganingizdan so‘ng shaxsiy ma’lumotlaringizni o‘chirishni so‘rashingiz mumkin — moliyaviy hujjatlar qonun talab qilgan muddat davomida saqlanib qoladi.',
      'Учебные и финансовые записи хранятся в соответствии с требованиями бухгалтерского учёта. После завершения обучения вы можете попросить удалить ваши персональные данные — финансовые документы сохраняются в течение срока, установленного законом.',
      'Study and financial records are kept in line with accounting requirements. After finishing a course you may ask us to delete your personal data; financial documents are retained for the period the law requires.',
    ],
  ),
  s(
    ['5. Sizning huquqlaringiz', '5. Ваши права', '5. Your rights'],
    [
      'Siz o‘zingiz haqingizdagi ma’lumotni ko‘rish, noto‘g‘ri ma’lumotni tuzatish va o‘chirishni so‘rash huquqiga egasiz. Buning uchun O‘quv markazi bilan quyidagi sahifadagi kontaktlar orqali bog‘laning.',
      'Вы вправе ознакомиться со своими данными, исправить неточные и запросить удаление. Для этого свяжитесь с Учебным центром по контактам, указанным на странице контактов.',
      'You have the right to see the data we hold about you, to correct anything inaccurate, and to ask for it to be deleted. Contact the Centre using the details on the contact page.',
    ],
  ),
]

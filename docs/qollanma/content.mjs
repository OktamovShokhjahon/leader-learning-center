/**
 * Leader LC — foydalanuvchi qo‘llanmasi (o‘zbek tilida).
 *
 * Matn shu yerda, chizish `build.mjs` da. Ikkalasini ajratganimizning sababi:
 * qo‘llanmani yangilash uchun PDF kutubxonasini bilish shart emas — bu faylda
 * matnni tahrirlab, qaytadan yig‘ish kifoya.
 *
 * Yozuvda `o‘` va `g‘` uchun U+2018 belgisi ishlatiladi — loyihaning qolgan
 * qismi ham shunday yozadi va Arial shriftida bu belgi bor.
 */

export const META = {
  title: 'Leader Learning Centre',
  subtitle: 'CRM va veb-sayt — to‘liq foydalanuvchi qo‘llanmasi',
  version: 'Versiya 1.0',
  note:
    'Ushbu qo‘llanma tizimning barcha bo‘limlarini va har bir rol nima qila olishini ' +
    'batafsil tushuntiradi. Har bo‘lim oxirida amaliy misollar bor.',
}

/**
 * Har bir bo‘lim: sarlavha + bloklar.
 * Blok turlari: p (matn), h2, h3, ul (ro‘yxat), steps (raqamli qadamlar),
 * table (jadval), note (eslatma), warn (ogohlantirish).
 */
export const SECTIONS = [
  /* ─────────────────────────────────────────────────────────────────────── */
  {
    title: '1. Tizim haqida umumiy ma’lumot',
    blocks: [
      {
        t: 'p',
        v:
          'Leader Learning Centre tizimi ikki qismdan iborat: ommaviy veb-sayt va ichki ' +
          'boshqaruv paneli (CRM). Veb-saytni hamma ko‘radi — kurslar, o‘qituvchilar, ' +
          'filiallar va ariza qoldirish shakli shu yerda. Panelga esa faqat markaz ' +
          'xodimlari, o‘quvchilar va ota-onalar o‘z login va paroli bilan kiradi.',
      },
      { t: 'h3', v: 'Tizimga kirish' },
      {
        t: 'steps',
        v: [
          'Brauzerda saytni oching va yuqori o‘ng burchakdagi «Shaxsiy kabinet» tugmasini bosing.',
          'Telefon raqamingizni +998 formatida kiriting (masalan: +998 90 123 45 67).',
          'Parolingizni kiriting va «Kirish» tugmasini bosing.',
          'Tizim sizni rolingizga mos bo‘limga olib o‘tadi.',
        ],
      },
      {
        t: 'warn',
        v:
          'Parolni o‘zingiz o‘zgartira olmaysiz. Parol markaz ma’muriyati tomonidan ' +
          'beriladi. Parolni unutsangiz yoki uni birov bilib qolgan deb o‘ylasangiz, ' +
          'darhol SuperAdmin yoki menejerga murojaat qiling — ular yangi parol beradi.',
      },
      { t: 'h3', v: 'Til' },
      {
        t: 'p',
        v:
          'Sayt va panel uch tilda ishlaydi: o‘zbek, rus va ingliz. Tilni yuqoridagi ' +
          'til tugmasi orqali istalgan vaqtda almashtirish mumkin. Tanlangan til ' +
          'brauzerda saqlanadi.',
      },
      { t: 'h3', v: 'Filial tanlash' },
      {
        t: 'p',
        v:
          'Markazda bir nechta filial bor. Panel yuqorisidagi filial tugmasi hozir qaysi ' +
          'filial bilan ishlayotganingizni ko‘rsatadi. Bu juda muhim: ko‘rayotgan ' +
          'ro‘yxatlaringiz ham, yaratayotgan yozuvlaringiz ham shu filialga tegishli bo‘ladi.',
      },
      {
        t: 'note',
        v:
          '«Barcha filiallar» rejimi faqat SuperAdmin uchun va faqat hisobot ko‘rish ' +
          'uchun. Bu rejimda yangi o‘quvchi, guruh, to‘lov yoki harajat qo‘sha olmaysiz — ' +
          'chunki tizim yozuvni qaysi filialga bog‘lashni bilmaydi. Avval aniq bir ' +
          'filialni tanlang.',
      },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  {
    title: '2. Rollar va ularning huquqlari',
    blocks: [
      {
        t: 'p',
        v:
          'Tizimda beshta rol bor. Har bir hisob bitta filialda bitta rolga ega bo‘ladi; ' +
          'SuperAdmin esa barcha filiallar uchun umumiy.',
      },
      {
        t: 'table',
        head: ['Rol', 'Kim', 'Nimaga javob beradi'],
        rows: [
          ['SuperAdmin', 'Markaz egasi / direktor', 'Hamma narsa: moliya, xodimlar, sozlamalar, filiallar'],
          ['Menejer', 'Qabul / call-markaz', 'Murojaatlar, o‘quvchilar, guruhlar, to‘lovlar'],
          ['O‘qituvchi', 'Dars beruvchi', 'O‘z guruhlari, davomat, testlar'],
          ['O‘quvchi', 'Talaba', 'O‘z davomati, to‘lovlari, testlari'],
          ['Ota-ona', 'Voyaga yetmagan o‘quvchi vakili', 'Farzandining davomati va to‘lovlari'],
        ],
      },
      {
        t: 'note',
        v:
          'Ilgari «Administrator» degan rol bor edi — u olib tashlandi. Uning vazifalarini ' +
          'SuperAdmin va Menejer bo‘lishib oldi.',
      },
      { t: 'h3', v: 'Kim nima qila oladi — qisqacha jadval' },
      {
        t: 'table',
        head: ['Amal', 'SuperAdmin', 'Menejer', 'O‘qituvchi'],
        rows: [
          ['Filial ochish va tahrirlash', 'Ha', 'Yo‘q', 'Yo‘q'],
          ['Hisob (akkaunt) ochish', 'Har qanday rol', 'O‘qituvchi, o‘quvchi, ota-ona', 'Yo‘q'],
          ['O‘quvchi qo‘shish va tahrirlash', 'Ha', 'Ha', 'Yo‘q'],
          ['Guruh ochish va narx belgilash', 'Ha', 'Ha', 'Yo‘q'],
          ['Davomat belgilash', 'Ha', 'Ha', 'Ha'],
          ['48 soatdan keyin davomatni tuzatish', 'Ha', 'Yo‘q', 'Yo‘q'],
          ['To‘lov qabul qilish', 'Ha', 'Ha', 'Yo‘q'],
          ['To‘lovni tasdiqlash', 'Ha', 'Ha', 'Yo‘q'],
          ['To‘lovni qaytarish (refund)', 'Ha', 'Yo‘q', 'Yo‘q'],
          ['Murojaatlar bilan ishlash', 'Ha', 'Ha', 'Yo‘q'],
          ['Harajat kiritish', 'Ha', 'Faqat mayda turkumlar', 'Yo‘q'],
          ['Jarima solish', 'Ha', 'Yo‘q', 'Yo‘q'],
          ['Kurs va xona boshqarish', 'Ha', 'Yo‘q', 'Yo‘q'],
          ['Test moduli yuklash', 'Ha', 'Yo‘q', 'O‘z kursi uchun'],
          ['Moliya, oylik, audit', 'Ha', 'Yo‘q', 'Yo‘q'],
        ],
      },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  {
    title: '3. SuperAdmin qo‘llanmasi',
    blocks: [
      {
        t: 'p',
        v:
          'SuperAdmin — markazning eng keng huquqli hisobi. Barcha filiallarni ko‘radi, ' +
          'moliyaviy ma’lumotlarga kira oladi va tizim sozlamalarini o‘zgartiradi. ' +
          'Quyida SuperAdmin uchun mavjud har bir bo‘lim tushuntiriladi.',
      },

      { t: 'h3', v: '3.1. Moliya (bosh sahifa)' },
      {
        t: 'p',
        v:
          'Kirganingizdan so‘ng «Moliya» bo‘limi ochiladi. Bu yerda markazning pul ' +
          'holati bir qarashda ko‘rinadi:',
      },
      {
        t: 'ul',
        v: [
          'Yig‘ilgan summa — shu oy haqiqatda kassaga tushgan pul.',
          'Yig‘ish darajasi — chiqarilgan hisob-fakturalarning necha foizi to‘langan.',
          'Debitorlik — hali to‘lanmagan summa, kechikish muddati bo‘yicha guruhlangan.',
          'O‘rtacha chek — bitta o‘quvchidan tushgan o‘rtacha summa.',
          'Oylik dinamika — oxirgi 6 oy.',
          'Kurslar va filiallar kesimida taqqoslash.',
        ],
      },
      {
        t: 'note',
        v:
          '«Summalarni yashirish» tugmasi barcha raqamlarni xiralashtiradi. Ekranni ' +
          'boshqa odamga ko‘rsatishingiz kerak bo‘lganda foydali.',
      },

      { t: 'h3', v: '3.2. Filiallar' },
      {
        t: 'steps',
        v: [
          'Yuqoridagi menyudan «Filiallar» bo‘limini oching.',
          'Yangi filial ochish uchun «Yangi filial» tugmasini bosing.',
          'Nomni uchta tilda kiriting (o‘zbekchasi majburiy, qolganlari bo‘sh qolsa o‘zbekchaga tayanadi).',
          'Manzil (slug) — saytdagi havolada ko‘rinadi va keyin o‘zgartirib bo‘lmaydi. Masalan: urganch-markaz.',
          'Shahar, manzil, ish vaqti va telefonlarni to‘ldiring.',
          '«Yaratish» tugmasini bosing.',
        ],
      },
      {
        t: 'p',
        v:
          'Filialni o‘chirib bo‘lmaydi — faqat arxivlash mumkin. Arxivlangan filialning ' +
          'barcha ma’lumotlari saqlanib qoladi, lekin u yangi yozuvlar uchun tanlanmaydi.',
      },

      { t: 'h3', v: '3.3. Kurslar va xonalar' },
      {
        t: 'p',
        v:
          'Guruh ochishdan oldin kurs va xona mavjud bo‘lishi kerak. Bu bo‘lim faqat ' +
          'SuperAdmin uchun ochiq.',
      },
      { t: 'h3', v: 'Kurs qo‘shish' },
      {
        t: 'steps',
        v: [
          '«Kurslar» bo‘limini oching va «Yangi kurs» tugmasini bosing.',
          'Kurs nomini uch tilda kiriting.',
          'Manzil (slug) yozing — masalan: general-english.',
          'Davomiyligini oylarda va standart narxni belgilang.',
          '«Saytda ko‘rinadi» belgisini qo‘ysangiz, kurs ommaviy saytdagi ro‘yxatga chiqadi.',
          '«Yaratish» tugmasini bosing.',
        ],
      },
      {
        t: 'warn',
        v:
          'Standart narx — bu faqat namuna. Haqiqiy narx har bir guruhda alohida ' +
          'belgilanadi, chunki filiallarda narx har xil bo‘lishi mumkin.',
      },
      {
        t: 'p',
        v:
          'Faol guruhlari bor kursni o‘chirib bo‘lmaydi — tizim buni rad etadi va nechta ' +
          'guruh borligini aytadi. Avval guruhlarni arxivlang.',
      },
      { t: 'h3', v: 'Xona qo‘shish' },
      {
        t: 'p',
        v:
          'Xonalar shu sahifaning pastki qismida. Nom, sig‘im va jihozlarni kiritasiz. ' +
          'Xonalar filialga tegishli — qaysi filial tanlangan bo‘lsa, xona o‘shanga ' +
          'qo‘shiladi. Dars jadvalida band bo‘lgan xonani o‘chirib bo‘lmaydi.',
      },

      { t: 'h3', v: '3.4. Hisoblar (xodimlar va foydalanuvchilar)' },
      {
        t: 'p',
        v:
          'Bu bo‘limda tizimning barcha foydalanuvchilari ko‘rinadi va SuperAdmin ' +
          'istalgan rolda yangi hisob ocha oladi.',
      },
      {
        t: 'steps',
        v: [
          '«Hisoblar» bo‘limini oching.',
          '«Yangi hisob» tugmasini bosing.',
          'To‘liq ism, telefon raqam va parol kiriting. Parol kamida 8 belgidan iborat bo‘lsin.',
          'Rolni tanlang va qaysi filialda ishlashini ko‘rsating.',
          'Bir kishi bir nechta filialda turli rolda ishlashi mumkin — «Rol qo‘shish» tugmasi orqali qo‘shing.',
          '«Yangi hisob» tugmasini bosib saqlang.',
        ],
      },
      {
        t: 'warn',
        v:
          'Parolni yozib oling va egasiga xavfsiz usulda yetkazing. Foydalanuvchi ' +
          'parolni o‘zi almashtira olmaydi, shuning uchun parolni yo‘qotmang.',
      },
      { t: 'h3', v: 'Mavjud hisobni boshqarish' },
      {
        t: 'p',
        v:
          'Har bir qatordagi «Boshqarish» tugmasi uchta alohida amalni ochadi. Ular ' +
          'ataylab alohida — chunki oqibatlari har xil:',
      },
      {
        t: 'ul',
        v: [
          'Ma’lumotlarni saqlash — ism, email, til. Hech qanday qo‘shimcha ta’siri yo‘q.',
          'Rollarni saqlash — rol o‘zgarsa, hisob barcha qurilmalardan chiqariladi.',
          'Parolni o‘rnatish — yangi parol beriladi, barcha seanslar tugatiladi.',
          'Hisobni o‘chirish — kirish yopiladi, lekin yozuv saqlanadi.',
        ],
      },
      {
        t: 'note',
        v:
          'Hisob hech qachon butunlay o‘chirilmaydi. O‘qituvchining ismi yillar davomida ' +
          'darslarda, to‘lovlarda va audit jurnalida qoladi — yozuvni o‘chirish ularning ' +
          'hammasini buzgan bo‘lardi.',
      },

      { t: 'h3', v: '3.5. Oyliklar' },
      {
        t: 'p',
        v:
          'Bu bo‘limda ikkita ichki bo‘lim bor: «Hisob-kitob» va «Sxemalar».',
      },
      { t: 'h3', v: 'Maosh sxemasini belgilash' },
      {
        t: 'p',
        v: 'Har bir xodim uchun maosh qanday hisoblanishini bir marta belgilaysiz:',
      },
      {
        t: 'table',
        head: ['Sxema', 'Qanday hisoblanadi', 'Kimga mos'],
        rows: [
          ['Qat’iy', 'Belgilangan oylik summa', 'Menejer, farrosh, qorovul'],
          ['Foizli', 'Yig‘ilgan pul × ulush (masalan 0.6)', 'O‘qituvchilar'],
          ['Dars uchun', 'O‘tilgan darslar soni × stavka', 'O‘rinbosar o‘qituvchilar'],
          ['O‘quvchi uchun', 'Faol o‘quvchilar soni × stavka', 'Ba’zi o‘qituvchilar'],
          ['Aralash', 'Qat’iy summa + foiz', 'Katta xodimlar'],
        ],
      },
      {
        t: 'warn',
        v:
          'Foizli sxema haqiqatda YIG‘ILGAN puldan hisoblanadi, chiqarilgan hisob-' +
          'fakturadan emas. Ya’ni o‘quvchi to‘lamagan bo‘lsa, o‘qituvchi ham o‘sha ' +
          'summadan ulush olmaydi. Bu ataylab shunday: aks holda markaz to‘lanmagan ' +
          'pulni o‘z cho‘ntagidan qoplagan bo‘lardi.',
      },
      { t: 'h3', v: 'Oylik hisob-kitobini o‘tkazish' },
      {
        t: 'steps',
        v: [
          '«Oyliklar» bo‘limini oching, «Hisob-kitob» yorlig‘ida turing.',
          'Yuqoridan kerakli oyni tanlang.',
          '«Hisoblash» tugmasini bosing. Tizim har bir xodim uchun qoralama hisob-varaqa tayyorlaydi.',
          'Har bir qatorni bosib ochsangiz, summa qayerdan kelganini ko‘rasiz: qancha pul yig‘ilgan, qanday ulush qo‘llanilgan, nechta to‘lov hisobga olingan.',
          'Hammasi to‘g‘ri bo‘lsa «Tasdiqlash» tugmasini bosing.',
          'Pul berilgandan keyin «To‘landi» tugmasini bosing.',
        ],
      },
      {
        t: 'note',
        v:
          'Tasdiqlangan hisob-varaqa qaytadan hisoblanmaydi. Shuningdek, tasdiqlash ' +
          'paytida avtomatik ravishda «Oylik» turkumida harajat yozuvi yaratiladi — ' +
          'shuning uchun oyliklarni qo‘lda harajat sifatida kiritish shart emas va mumkin emas.',
      },

      { t: 'h3', v: '3.6. Sozlamalar' },
      {
        t: 'p',
        v:
          'Bu yerda tizimning butun ishlashiga ta’sir qiladigan raqamlar va kalitlar ' +
          'turadi. Ular beshta guruhga bo‘lingan: Pul, O‘quv, Xabarnomalar, ' +
          'Integratsiyalar, Kontent.',
      },
      {
        t: 'table',
        head: ['Sozlama', 'Nimaga ta’sir qiladi', 'Standart'],
        rows: [
          ['Chegirma chegarasi', 'Bitta o‘quvchiga berilishi mumkin bo‘lgan eng katta chegirma', '20%'],
          ['Harajat tasdiq chegarasi', 'Bu summadan yuqori harajat boshliq tasdig‘iga boradi', '1 000 000'],
          ['Menejer harajat chegarasi', 'Menejer bir marta sarflay oladigan eng katta summa', '200 000'],
          ['Kechikish imtiyoz kunlari', 'Necha kundan keyin qarzdor deb belgilanadi', '3 kun'],
          ['O‘qituvchi ulushi', 'Foizli sxemadagi standart ulush', '0.6'],
          ['Davomat tuzatish oynasi', 'Necha soat ichida davomatni erkin tuzatish mumkin', '48 soat'],
          ['Past davomat chegarasi', 'Bundan past bo‘lsa o‘quvchi belgilanadi', '70%'],
          ['Bayram kunlari', 'Bu kunlarda dars yaratilmaydi va hisoblanmaydi', 'O‘zbekiston bayramlari'],
        ],
      },
      {
        t: 'p',
        v:
          'Har bir sozlama yonida «Standart» yoki «O‘zgartirilgan» belgisi turadi. ' +
          '«Standart» — hech kim tegmagan, tizim bilan kelgan qiymat. ' +
          '«O‘zgartirilgan» — kimdir ataylab boshqacha qilib qo‘ygan. ' +
          '«Tiklash» tugmasi standart qiymatga qaytaradi.',
      },
      {
        t: 'note',
        v:
          'Yuqoridagi «Qamrov» qatoridan filial tanlasangiz, ba’zi sozlamalarni faqat ' +
          'shu filial uchun boshqacha qilib qo‘yish mumkin. Masalan, bitta filialda ' +
          'chegirma chegarasi 25% bo‘lib, qolganlarida 20% qolishi mumkin.',
      },

      { t: 'h3', v: '3.7. Audit jurnali' },
      {
        t: 'p',
        v:
          'Tizimda qilingan har bir muhim amal shu yerga yoziladi: kim, nima qildi, ' +
          'qachon, va nima o‘zgardi. To‘lovlar, jarimalar, harajatlar, rol o‘zgarishlari, ' +
          'parol tiklashlar, sozlamalar — hammasi.',
      },
      {
        t: 'ul',
        v: [
          'Qidiruv maydoni ism, amal nomi yoki manzil bo‘yicha qidiradi.',
          'Sana oralig‘ini tanlash mumkin.',
          'Amal turi bo‘yicha filtrlash mumkin (auth, payment, fine, expense va h.k.).',
          '«Rad etilgan» filtri — kimdir huquqi bo‘lmagan joyga kirmoqchi bo‘lgan hollar.',
          'Qatorni bosing — nima o‘zgargani (eski va yangi qiymat) ochiladi.',
        ],
      },
      {
        t: 'warn',
        v:
          'Audit jurnalini hech kim o‘chira olmaydi — SuperAdmin ham. Bu ataylab ' +
          'shunday qilingan: jurnalning butun ma’nosi to‘liq bo‘lishida.',
      },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  {
    title: '4. Menejer qo‘llanmasi',
    blocks: [
      {
        t: 'p',
        v:
          'Menejer — markazning kundalik ishini olib boradigan asosiy xodim. ' +
          'Murojaatlarni qabul qiladi, o‘quvchilarni ro‘yxatga oladi, guruhlarni ' +
          'shakllantiradi, to‘lovlarni oladi va qarzdorlar bilan ishlaydi.',
      },

      { t: 'h3', v: '4.1. Kunlik ish tartibi' },
      {
        t: 'steps',
        v: [
          'Ertalab «Boshqaruv paneli» sahifasini oching — bugungi vazifalar ko‘rinadi.',
          '«Murojaatlar» bo‘limiga o‘ting va yangi arizalarni ko‘rib chiqing.',
          'Yangi arizachilarga qo‘ng‘iroq qiling, holatini yangilang.',
          '«Qarzdorlar» ro‘yxatini oching va kechikkanlarga qo‘ng‘iroq qiling.',
          'Kun davomida kelgan to‘lovlarni «To‘lov qabul qilish» orqali kiriting.',
        ],
      },

      { t: 'h3', v: '4.2. Murojaatlar (arizalar) bilan ishlash' },
      {
        t: 'p',
        v:
          'Saytdan kelgan har bir ariza shu bo‘limga tushadi. Ekran oltita ustundan ' +
          'iborat — bu arizaning bosqichlari:',
      },
      {
        t: 'table',
        head: ['Bosqich', 'Ma’nosi'],
        rows: [
          ['Yangi', 'Ariza endi keldi, hali hech kim bog‘lanmagan'],
          ['Bog‘lanildi', 'Qo‘ng‘iroq qilindi, gaplashildi'],
          ['Sinov darsiga yozildi', 'Sinov darsi uchun sana belgilandi'],
          ['Sinov darsida qatnashdi', 'Kelib, darsni ko‘rdi'],
          ['O‘quvchi bo‘ldi', 'Ro‘yxatdan o‘tdi va o‘qishni boshladi'],
          ['Rad etdi', 'O‘qishni istamadi'],
        ],
      },
      { t: 'h3', v: 'Ariza ustida ishlash' },
      {
        t: 'steps',
        v: [
          'Kartochkani bosing — arizachining ma’lumotlari ochiladi.',
          '«Qo‘ng‘iroq» yoki «Telegram» tugmasi orqali bog‘laning.',
          'Holatni yangilang va «Saqlash» tugmasini bosing.',
          'Sinov darsi kelishilgan bo‘lsa, sanani belgilab «Sinov darsiga yozish» tugmasini bosing.',
          'Arizachi rozi bo‘lsa, «O‘quvchiga aylantirish» tugmasini bosing.',
        ],
      },
      {
        t: 'warn',
        v:
          'Rad etilgan arizada sababni ko‘rsatish majburiy. Sababsiz saqlash mumkin ' +
          'emas — chunki keyinchalik «nega odamlar ketyapti» degan savolga faqat shu ' +
          'sabablar javob beradi.',
      },
      { t: 'h3', v: 'Arizani o‘quvchiga aylantirish' },
      {
        t: 'steps',
        v: [
          'Kartochkani oching va «O‘quvchiga aylantirish» tugmasini bosing.',
          'Agar guruh allaqachon tanlangan bo‘lsa, uni ko‘rsating — o‘quvchi darhol guruhga yoziladi.',
          'Oylik to‘lov summasini tekshiring (guruh narxi avtomatik qo‘yiladi).',
          'O‘quvchiga shaxsiy kabinet kerak bo‘lsa, «Kabinet uchun login ochish» belgisini qo‘ying va parol kiriting.',
          '«O‘quvchiga aylantirish» tugmasini bosing.',
        ],
      },
      {
        t: 'note',
        v:
          'Tugmani ikki marta bossangiz ham ikkita o‘quvchi yaratilmaydi — tizim buni ' +
          'tekshiradi. Shu telefon raqamli o‘quvchi allaqachon bo‘lsa, yangisi ' +
          'yaratilmay, mavjudiga bog‘lanadi.',
      },

      { t: 'h3', v: '4.3. O‘quvchilar' },
      {
        t: 'steps',
        v: [
          '«O‘quvchilar» bo‘limini oching.',
          'Yangi o‘quvchi uchun «Yangi o‘quvchi» tugmasini bosing.',
          'Ism, telefon, ota-ona ismi va telefoni kabi maydonlarni to‘ldiring.',
          'Holatni tanlang va oylik to‘lovni belgilang.',
          '«Yaratish» tugmasini bosing.',
        ],
      },
      { t: 'h3', v: 'O‘quvchi holatlari' },
      {
        t: 'table',
        head: ['Holat', 'Ma’nosi'],
        rows: [
          ['Faol', 'Normal o‘qiyapti'],
          ['Kutilmoqda', 'Ro‘yxatdan o‘tdi, birinchi to‘lov hali kelmagan'],
          ['Qarzdor', 'To‘lov muddati o‘tib ketgan'],
          ['To‘langan', 'Joriy oy yopilgan'],
          ['Tugatgan', 'Kursni tamomlagan'],
          ['Muzlatilgan', 'Vaqtincha to‘xtatgan — hisob-faktura chiqarilmaydi'],
          ['Ketgan', 'Tashlab ketgan — sabab ko‘rsatilishi shart'],
        ],
      },
      { t: 'h3', v: 'Muzlatish va ko‘chirish' },
      {
        t: 'p',
        v:
          'O‘quvchi kartochkasining pastki qismida ikkita alohida amal bor. ' +
          '«Muzlatish» — o‘quvchi vaqtincha kelmaydi (kasal, ta’til), unga hisob-faktura ' +
          'chiqarilmaydi. «Ko‘chirish» — boshqa guruhga yoki boshqa filialga o‘tkazish.',
      },
      {
        t: 'warn',
        v:
          'Filialga ko‘chirganda: to‘lanmagan hisob-fakturalar o‘quvchi bilan birga ' +
          'ketadi, to‘langanlari esa eski filialda qoladi. Bu ataylab shunday — ' +
          'allaqachon olingan pul o‘sha filialning daromadi bo‘lib qolishi kerak.',
      },

      { t: 'h3', v: '4.4. Guruhlar' },
      {
        t: 'steps',
        v: [
          '«Guruhlar» bo‘limini oching va «Yangi guruh» tugmasini bosing.',
          'Guruh nomini yozing (masalan: GE-A2 ertalab).',
          'Kurs va o‘qituvchini tanlang. Kurs tanlanganda narx avtomatik to‘ldiriladi.',
          'Xona tanlang (ixtiyoriy).',
          'Kunlar tartibini tanlang: har kuni, toq kunlar yoki juft kunlar. Kunlar avtomatik belgilanadi.',
          'Dars boshlanish va tugash vaqtini kiriting.',
          'Boshlanish sanasini belgilang va «Yaratish» tugmasini bosing.',
        ],
      },
      {
        t: 'note',
        v:
          'Guruh yaratilganda butun davr uchun darslar avtomatik yaratiladi. Bayram ' +
          'kunlari o‘tkazib yuboriladi.',
      },
      {
        t: 'warn',
        v:
          'Agar tanlagan vaqt va xona band bo‘lsa, tizim saqlashga yo‘l qo‘ymaydi va ' +
          'qaysi guruh band qilganini aytadi. Boshqa vaqt yoki xona tanlang.',
      },
      {
        t: 'p',
        v:
          'Guruhni o‘chirib bo‘lmaydi, faqat arxivlash mumkin. Arxivlashdan oldin ' +
          'ichidagi o‘quvchilarni boshqa guruhga ko‘chiring — aks holda tizim rad etadi.',
      },

      { t: 'h3', v: '4.5. Davomat' },
      {
        t: 'steps',
        v: [
          '«Guruhlar» bo‘limidan kerakli guruhni oching.',
          'Yuqoridan sanani tanlang (standart holda bugun).',
          'Barcha o‘quvchilar boshida «Keldi» deb belgilangan bo‘ladi.',
          'Kelmagan o‘quvchi qatorini bosing — holat almashadi: Keldi > Kelmadi > Kechikdi > Sababli.',
          '«Saqlash» tugmasini bosing.',
        ],
      },
      {
        t: 'note',
        v:
          'Hamma kelgan bo‘lsa, hech narsani o‘zgartirmasdan to‘g‘ridan-to‘g‘ri ' +
          '«Saqlash» tugmasini bosing — bitta bosishda tugaydi.',
      },
      {
        t: 'warn',
        v:
          'Davomatni faqat 48 soat ichida tuzatish mumkin. Undan keyin faqat SuperAdmin ' +
          'o‘zgartira oladi va bu audit jurnaliga yoziladi.',
      },

      { t: 'h3', v: '4.6. To‘lov qabul qilish' },
      {
        t: 'steps',
        v: [
          '«To‘lov qabul qilish» bo‘limini oching.',
          'O‘quvchi ismini yoki telefon raqamining oxirgi raqamlarini yozishni boshlang.',
          'Ro‘yxatdan kerakli o‘quvchini bosing.',
          'Summa avtomatik to‘ldiriladi (qarz miqdori). Kerak bo‘lsa o‘zgartiring.',
          'To‘lov usulini tanlang: naqd, plastik, bank, Payme, Click yoki Uzum.',
          '«Tasdiqlash» tugmasini bosing. Chek raqami chiqadi.',
        ],
      },
      {
        t: 'note',
        v:
          'Tugmani tasodifan ikki marta bossangiz, pul ikki marta yozilmaydi — tizim ' +
          'buni taniydi va birinchi to‘lovni ko‘rsatadi.',
      },

      { t: 'h3', v: '4.7. Qarzdorlar' },
      {
        t: 'p',
        v:
          'Ikkita yorliq bor: «Barcha qarzdorlar» va «Kurs puli to‘lamaganlar». ' +
          'Birinchisi — muddati o‘tgan hisob-fakturasi borlar. Ikkinchisi — joriy davr ' +
          'uchun umuman hech narsa to‘lamaganlar.',
      },
      {
        t: 'p',
        v:
          'Kechikish muddati bo‘yicha filtrlash mumkin: 1–3 kun, 4–10 kun, 10 kundan ortiq. ' +
          'Har bir qatorda telefon va Telegram havolasi bor — to‘g‘ridan-to‘g‘ri bosib ' +
          'bog‘lanishingiz mumkin.',
      },

      { t: 'h3', v: '4.8. Harajatlar' },
      {
        t: 'steps',
        v: [
          '«Harajatlar» bo‘limini oching.',
          '«+ Harajat» tugmasini bosing.',
          'Summani kiriting.',
          'Turkumni katta tugmalardan tanlang.',
          'Sana bugungi kun bo‘lib turadi — kerak bo‘lsa o‘zgartiring.',
          'Izoh yozing (ixtiyoriy) va «Saqlash» tugmasini bosing.',
        ],
      },
      {
        t: 'warn',
        v:
          'Menejer faqat mayda turkumlarga harajat kirita oladi (kanselyariya, ' +
          'transport, mehmondorchilik) va bitta harajat uchun chegara bor. Katta ' +
          'harajatlarni SuperAdmin kiritadi.',
      },
      {
        t: 'note',
        v:
          'Belgilangan chegaradan yuqori summa darhol yozilmaydi — u «Tasdiq kutmoqda» ' +
          'holatiga tushadi va SuperAdmin tasdiqlashini kutadi.',
      },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  {
    title: '5. O‘qituvchi qo‘llanmasi',
    blocks: [
      {
        t: 'p',
        v:
          'O‘qituvchi tizimda faqat o‘z guruhlarini ko‘radi. Bu cheklov serverda ' +
          'qo‘yilgan — boshqa guruhlarni ko‘rishning yo‘li yo‘q.',
      },

      { t: 'h3', v: '5.1. Mening guruhlarim' },
      {
        t: 'p',
        v:
          '«Guruhlar» bo‘limida faqat siz dars beradigan guruhlar chiqadi. Har bir ' +
          'kartochkada kurs nomi, dars kunlari va vaqti, o‘quvchilar soni ko‘rinadi.',
      },

      { t: 'h3', v: '5.2. Davomat belgilash' },
      {
        t: 'steps',
        v: [
          'Guruh kartochkasini bosing.',
          'Bugungi dars avtomatik ochiladi.',
          'Hamma kelgan bo‘lsa — «Saqlash» tugmasini bosing, tamom.',
          'Kelmaganlar bo‘lsa, ularning qatorini bosib holatini o‘zgartiring, keyin saqlang.',
        ],
      },
      {
        t: 'warn',
        v:
          'Davomatni 48 soat ichida kiritishingiz kerak. Kechikkan bo‘lsangiz, ' +
          'SuperAdminga murojaat qiling.',
      },

      { t: 'h3', v: '5.3. Qarzdorlik belgisi' },
      {
        t: 'p',
        v:
          'O‘z guruhingizdagi o‘quvchilarda qarzdorlik belgisi ko‘rinadi, lekin summa ' +
          'ko‘rinmaydi. Bu ataylab: sizga o‘quvchi bilan gaplashish uchun belgi kerak, ' +
          'lekin pul miqdori sizning ishingiz emas.',
      },

      { t: 'h3', v: '5.4. Test modullari' },
      {
        t: 'p',
        v:
          'Siz o‘zingiz dars beradigan kurslar uchun onlayn test modullarini yuklashingiz ' +
          'mumkin. Boshqa kurslar uchun emas.',
      },
      {
        t: 'steps',
        v: [
          '«Testlar» bo‘limini oching.',
          'Moodle formatidagi .txt faylni yoki Excel jadvalini oynaga tashlang.',
          'Tizim savollarni o‘qib chiqadi va xatolarni ko‘rsatadi.',
          'Xatolar bo‘lsa faylni tuzatib qaytadan yuklang.',
          'Kurs, modul nomi, tartib raqami va o‘tish balini belgilang.',
          '«Yuklash va e’lon qilish» tugmasini bosing.',
        ],
      },
      {
        t: 'note',
        v:
          'Modullar ketma-ket ochiladi: o‘quvchi birinchi modulni o‘tmaguncha ' +
          'ikkinchisi ochilmaydi. O‘tish bali standart holda 60%.',
      },

      { t: 'h3', v: '5.5. O‘z maoshim' },
      {
        t: 'p',
        v:
          'Siz faqat o‘z hisob-varaqangizni ko‘rasiz — boshqa xodimlarnikini emas. ' +
          'Unda qancha yig‘ilgani, qanday ulush qo‘llanilgani va agar jarima bo‘lsa, ' +
          'qancha ushlab qolingani ko‘rinadi.',
      },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  {
    title: '6. O‘quvchi va ota-ona qo‘llanmasi',
    blocks: [
      {
        t: 'p',
        v:
          'O‘quvchi va ota-ona shaxsiy kabinetga kiradi. Bu yerda faqat ko‘rish mumkin — ' +
          'hech narsani o‘zgartirib bo‘lmaydi.',
      },

      { t: 'h3', v: '6.1. Davomat kalendari' },
      {
        t: 'p',
        v:
          'Kabinetning asosiy qismi — oylik kalendar. Kelmagan kunlar qizil doira bilan ' +
          'belgilanadi. Qizil doirani bossangiz, o‘sha kungi dars haqida ma’lumot ' +
          'chiqadi: fan, vaqt va o‘qituvchi.',
      },
      {
        t: 'ul',
        v: [
          'Davomat foizi — necha foiz darsga qatnashgan.',
          'Kelmagan kunlar soni — shu oyda.',
          'Oyni almashtirish uchun yon tugmalardan foydalaning.',
        ],
      },

      { t: 'h3', v: '6.2. To‘lovlar' },
      {
        t: 'p',
        v:
          'Kabinetning pastki qismida hisob-fakturalar va to‘lovlar tarixi ko‘rinadi. ' +
          'Har bir hisob-fakturada davr, summa va holat yozilgan.',
      },

      { t: 'h3', v: '6.3. Onlayn testlar' },
      {
        t: 'steps',
        v: [
          'Kabinetda «Onlayn modullar» bo‘limini toping.',
          'Ochiq modulni bosing va «Boshlash» tugmasini bosing.',
          'Har bir savolga bitta javob tanlang va «Keyingi» tugmasini bosing.',
          'Oxirida «Tugatish» tugmasini bosing.',
          'Natija darhol ko‘rinadi: to‘g‘ri javoblar yashil, xatolar qizil rangda.',
        ],
      },
      {
        t: 'note',
        v:
          'O‘tish balidan yuqori natija olsangiz, keyingi modul ochiladi. O‘ta olmasangiz ' +
          'qayta urinib ko‘rishingiz mumkin.',
      },

      { t: 'h3', v: '6.4. Faol qurilmalar' },
      {
        t: 'p',
        v:
          '«Hisobim» bo‘limida hisobingizga kirgan barcha qurilmalar ro‘yxati bor. ' +
          'Tanimagan qurilmani ko‘rsangiz, «Tugatish» tugmasini bosib uni chiqarib ' +
          'yuboring va darhol markazga xabar bering.',
      },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  {
    title: '7. Ko‘p uchraydigan savollar',
    blocks: [
      { t: 'h3', v: 'Parolimni unutdim, nima qilay?' },
      {
        t: 'p',
        v:
          'Markaz ma’muriyatiga (SuperAdmin yoki menejerga) murojaat qiling. Ular ' +
          '«Hisoblar» bo‘limidan sizga yangi parol beradi. Tizimda parolni o‘zi ' +
          'tiklash imkoniyati yo‘q.',
      },

      { t: 'h3', v: 'Nega yangi o‘quvchi qo‘sha olmayapman?' },
      {
        t: 'p',
        v:
          'Ehtimol «Barcha filiallar» rejimidasiz. Yuqoridagi filial tugmasini bosib ' +
          'aniq bir filialni tanlang, keyin qaytadan urinib ko‘ring.',
      },

      { t: 'h3', v: 'Guruh yaratmoqchiman, lekin xato chiqyapti' },
      {
        t: 'p',
        v:
          'Ko‘pincha sabab — tanlangan vaqtda xona yoki o‘qituvchi band. Xato xabarida ' +
          'qaysi guruh band qilgani yozilgan bo‘ladi. Boshqa vaqt, xona yoki o‘qituvchi tanlang.',
      },

      { t: 'h3', v: 'Kursni o‘chira olmayapman' },
      {
        t: 'p',
        v:
          'Kursda faol guruhlar bor. Avval o‘sha guruhlarni arxivlang, keyin kursni ' +
          'o‘chiring. Xato xabarida nechta guruh borligi yozilgan.',
      },

      { t: 'h3', v: 'Harajat kiritdim, lekin ro‘yxatda «Tasdiq kutmoqda» deb turibdi' },
      {
        t: 'p',
        v:
          'Summa belgilangan chegaradan yuqori bo‘lgan. SuperAdmin tasdiqlagandan keyin ' +
          'u hisobga olinadi. Chegarani «Sozlamalar» bo‘limidan o‘zgartirish mumkin.',
      },

      { t: 'h3', v: 'O‘qituvchining maoshi kutganimdan kam chiqdi' },
      {
        t: 'p',
        v:
          'Foizli sxemada maosh haqiqatda yig‘ilgan puldan hisoblanadi. Agar guruhdagi ' +
          'o‘quvchilar to‘lamagan bo‘lsa, summa kam bo‘ladi. Hisob-varaqani bosib ' +
          'ochsangiz, qaysi to‘lovlar hisobga olinganini ko‘rasiz.',
      },

      { t: 'h3', v: 'Jarimani bekor qilmoqchiman' },
      {
        t: 'p',
        v:
          'Jarima hech qachon o‘chirilmaydi — faqat bekor qilinadi va sabab yoziladi. ' +
          'Agar jarima allaqachon hisob-fakturaga yoki oylikka tushgan bo‘lsa, uni ' +
          'bekor qilib bo‘lmaydi — bunday holda to‘lovni qaytarish kerak.',
      },

      { t: 'h3', v: 'Bir odam ikkita filialda ishlaydi, qanday qilay?' },
      {
        t: 'p',
        v:
          '«Hisoblar» bo‘limida uning kartochkasini oching, «Rol qo‘shish» tugmasini ' +
          'bosing va ikkinchi filial uchun rolni qo‘shing. Bitta hisob bir nechta ' +
          'filialda turli rolga ega bo‘lishi mumkin.',
      },
    ],
  },

  /* ─────────────────────────────────────────────────────────────────────── */
  {
    title: '8. Namunaviy ma’lumotlar bilan sinash',
    blocks: [
      {
        t: 'p',
        v:
          'Tizimni real ma’lumotlarsiz sinab ko‘rish uchun namunaviy ma’lumotlar ' +
          'to‘plami bor. Uni bir marta ishga tushirsangiz, barcha bo‘limlar to‘ladi va ' +
          'har bir imkoniyatni sinab ko‘rish mumkin bo‘ladi.',
      },
      { t: 'h3', v: 'Ishga tushirish' },
      { t: 'code', v: 'npm run seed' },
      {
        t: 'p',
        v: 'Buyruq quyidagilarni yaratadi:',
      },
      {
        t: 'ul',
        v: [
          '2 ta filial, 4 ta kurs, 2 ta xona, 4 ta guruh va ularning dars jadvali',
          '16 ta o‘quvchi — faol, muzlatilgan va boshqa holatlarda',
          'Hisob-fakturalar: bir qismi to‘langan, bir qismi qisman, bir qismi qarzdor',
          '12 ta harajat turkumi va bir nechta harajat — biri tasdiq kutmoqda',
          '2 ta jarima qoidasi va 3 ta jarima — biri shikoyat qilingan',
          '6 ta murojaat — oltita bosqichning har birida bittadan',
          'Maosh sxemalari va tayyor oylik hisob-kitobi',
          'Onlayn test modullari va davomat yozuvlari',
        ],
      },
      {
        t: 'note',
        v:
          'Buyruqni ikki marta ishga tushirsangiz, hech narsa takrorlanmaydi — tizim ' +
          'mavjud ma’lumotlarga tegmaydi.',
      },
      { t: 'h3', v: 'Namunaviy hisoblar' },
      {
        t: 'table',
        head: ['Rol', 'Telefon', 'Parol'],
        rows: [
          ['Menejer', '+998 90 000 01 02', 'DemoParol2026!'],
          ['O‘qituvchi', '+998 90 000 01 03', 'DemoParol2026!'],
          ['O‘qituvchi', '+998 90 000 01 04', 'DemoParol2026!'],
          ['O‘quvchi', '+998 90 100 00 00', 'DemoParol2026!'],
          ['O‘quvchi', '+998 90 100 00 01', 'DemoParol2026!'],
        ],
      },
      {
        t: 'warn',
        v:
          'Bu hisoblar faqat sinov uchun. Haqiqiy ishga tushirishdan oldin ularni ' +
          'o‘chiring va parollarni almashtiring. SuperAdmin hisobi alohida — u ' +
          'SEED_SUPERADMIN_PHONE va SEED_SUPERADMIN_PASSWORD sozlamalaridan olinadi.',
      },
      { t: 'h3', v: 'Sinash tartibi' },
      {
        t: 'p',
        v: 'Barcha imkoniyatlarni ketma-ket sinab ko‘rish uchun quyidagi tartibni tavsiya qilamiz:',
      },
      {
        t: 'steps',
        v: [
          'SuperAdmin sifatida kiring. «Moliya» sahifasida raqamlar borligini tekshiring.',
          'Filial tugmasidan bitta filialni tanlang.',
          '«Kurslar» bo‘limida yangi kurs qo‘shib ko‘ring, keyin uni tahrirlang.',
          '«Guruhlar» bo‘limida yangi guruh yarating — band vaqtni tanlab, xato xabarini ham ko‘ring.',
          '«O‘quvchilar» bo‘limida yangi o‘quvchi qo‘shing va uni guruhga ko‘chiring.',
          '«To‘lov qabul qilish» orqali to‘lov kiriting.',
          '«Qarzdorlar» ro‘yxatini oching.',
          '«Harajatlar» bo‘limida katta summali harajat kiriting — u tasdiq kutishini ko‘ring, keyin tasdiqlang.',
          '«Jarimalar» bo‘limida jarima soling, keyin uni bekor qiling.',
          '«Oyliklar» bo‘limida hisob-kitobni ishga tushiring va bitta qatorni ochib ko‘ring.',
          '«Sozlamalar» bo‘limida chegirma chegarasini o‘zgartiring va «Tiklash» tugmasini sinang.',
          '«Audit» bo‘limini oching — yuqoridagi barcha amallaringiz shu yerda bo‘lishi kerak.',
          'Chiqing va menejer sifatida kiring — qaysi bo‘limlar yo‘qolganini ko‘ring.',
          'O‘qituvchi sifatida kiring — faqat o‘z guruhlari ko‘rinishini tekshiring.',
          'O‘quvchi sifatida kiring — kalendar va testlarni sinab ko‘ring.',
        ],
      },
    ],
  },
]

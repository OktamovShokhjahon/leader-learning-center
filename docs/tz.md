# LEADER LC — CRM + Public Website
## Technical Mission (Техническое задание / Texnik topshiriq)

| | |
|---|---|
| **Document version** | 1.0 (draft for client sign-off) |
| **Date** | 19.08.2026 |
| **Client** | Leader Learning Centre (leaderonline.uz), Urganch, Xorazm |
| **Contact** | Umarbek Ulug'bekovich |
| **Contractor** | *(to be filled)* |
| **Stack** | Next.js 15 (public site + panels) · Express.js 5 · MongoDB 8 · Redis |
| **Languages of the product** | O'zbek (default) · Русский · English |
| **Sources this TZ is based on** | `BIG_PROJECT.pdf` (student cabinet spec), `НАМУНА.xlsx` (real accounting workbook), Telegram messages from the client dated 18.08.2026, current site `leaderonline.uz` |

---

## Table of contents

1. [Purpose and scope](#1-purpose-and-scope)
2. [Glossary](#2-glossary)
3. [What is explicitly excluded](#3-what-is-explicitly-excluded)
4. [Roles and permissions](#4-roles-and-permissions)
5. [Multi-branch architecture](#5-multi-branch-architecture)
6. [Module 1 — Public website (landing)](#6-module-1--public-website-landing)
7. [Module 2 — Online registration and lead funnel](#7-module-2--online-registration-and-lead-funnel)
8. [Module 3 — Authentication and security](#8-module-3--authentication-and-security)
9. [Module 4 — Students, groups, schedule](#9-module-4--students-groups-schedule)
10. [Module 5 — Attendance](#10-module-5--attendance)
11. [Module 6 — Payments, debtors, invoices](#11-module-6--payments-debtors-invoices)
12. [Module 7 — Fines (jarima)](#12-module-7--fines-jarima)
13. [Module 8 — Expenses (harajat)](#13-module-8--expenses-harajat)
14. [Module 9 — Salaries and payroll](#14-module-9--salaries-and-payroll)
15. [Module 10 — Finance dashboard (SuperAdmin only)](#15-module-10--finance-dashboard-superadmin-only)
16. [Module 11 — Exams, scores, ranking](#16-module-11--exams-scores-ranking)
17. [Module 12 — Library, Audio, Video (protected content)](#17-module-12--library-audio-video-protected-content)
18. [Module 13 — Content protection: no download, no screenshot](#18-module-13--content-protection-no-download-no-screenshot)
19. [Module 14 — Notifications](#19-module-14--notifications)
20. [Module 15 — Reports and statistics](#20-module-15--reports-and-statistics)
21. [Module 16 — Settings, i18n, audit log](#21-module-16--settings-i18n-audit-log)
22. [Data model (MongoDB collections)](#22-data-model-mongodb-collections)
23. [REST API surface](#23-rest-api-surface)
24. [Frontend architecture and packages](#24-frontend-architecture-and-packages)
25. [Design direction and UI system](#25-design-direction-and-ui-system)
26. [Backend architecture and packages](#26-backend-architecture-and-packages)
27. [Non-functional requirements](#27-non-functional-requirements)
28. [Infrastructure and deployment](#28-infrastructure-and-deployment)
29. [Delivery phases and estimates](#29-delivery-phases-and-estimates)
30. [Acceptance criteria](#30-acceptance-criteria)
31. [Open questions for the client](#31-open-questions-for-the-client)

---

## 1. Purpose and scope

Leader Learning Centre currently runs its operations on Excel workbooks (see `НАМУНА.xlsx`: one sheet per course — `SUMMER`, `MT`, `KIDS`, `ENGLISH`, `РАЗГОВОР`, `RUS TILI`, `TURK TILI`, `ONLINE`, plus `Статистика` and `Молия`) and a public site (`leaderonline.uz`) that is visually outdated and does not convert visitors into applications.

The project replaces both with one product:

**A. Public website** — a completely new, multilingual (uz / ru / en) marketing site with online registration. It must contain everything the current site contains **plus** substantially more.

**B. CRM** — a role-based internal system covering the entire student lifecycle: lead → trial lesson → enrolment → attendance → monthly payment → debt control → fines → exam results → graduation; and the entire money lifecycle: revenue → expenses → salaries → profit.

**Guiding principle stated by the client: the CRM must be very easy to control.** Wherever there is a conflict between "more features" and "an administrator with no IT background can do this in two clicks", the second wins. Every day-to-day action (mark attendance, accept a payment, add an expense, issue a fine) must be reachable in **at most 2 clicks from the dashboard** and completable in **under 15 seconds**.

### 1.1 Key business rules extracted from the client's materials

| Source | Rule |
|---|---|
| Telegram, 18.08 18:04 | Fines (`jarima`) must be part of the system |
| Telegram, 18.08 18:08 | Videos must not be downloadable |
| Telegram, 18.08 18:08 | PDF files must not be downloadable and must not be screenshot-able |
| Telegram, 18.08 18:11 | Expenses section required — powerful but simple, inside the admin panel |
| Verbal | Multiple branches; the boss switches branch from his panel |
| Verbal | Finance is visible to **SuperAdmin only** |
| Verbal | Admin must see who is a **debtor (`qarzdor`)** and who has not paid the **course fee (`kurs puli`)** |
| Verbal | Website in 3 languages |
| Verbal | Coins and Shop from the PDF are **not** required now |
| `НАМУНА.xlsx` → `Статистика` | Teacher share coefficient `0.6`; per-course plan vs. actual; average cheque; applicant count |
| `НАМУНА.xlsx` → `Молия` | Financial year runs **September → August**; three tracked streams: Ойлик (salaries), Харажат (expenses), Выручка (revenue); Instagram spend tracked separately |

---

## 2. Glossary

| Term | Meaning in this document |
|---|---|
| **Branch (filial)** | A physical location of the learning centre. All operational data belongs to exactly one branch. |
| **Course** | A product: `ENGLISH`, `KIDS`, `MT`, `RAZGOVOR`, `RUS TILI`, `TURK TILI`, `SUMMER`, `ONLINE`, `MATEMATIKA`. |
| **Group** | A concrete class: course + teacher + room + schedule + student list. |
| **Chek** | The monthly fee for one student, in thousands of UZS in the current workbook (e.g. `700` = 700 000 so'm). Stored in the system as full so'm. |
| **Kurs puli** | Monthly course fee owed by a student. |
| **Qarzdor** | Debtor — a student whose invoice is past its due date and unpaid. |
| **Jarima** | Fine — a monetary penalty applied to a student or an employee. |
| **Harajat** | Expense — any outgoing money that is not salary. |
| **Ойлик** | Salary. |
| **Lead / Ariza** | An online application from the website, not yet a student. |
| **Trial lesson** | Free demonstration lesson given to a lead before enrolment. |

---

## 3. What is explicitly excluded

These appear in `BIG_PROJECT.pdf` but are **out of scope for v1** at the client's request:

- ❌ **MY COINS** — score → coin exchange (PIC 8)
- ❌ **SHOP** — buying merchandise with coins (PIC 7)

The database schema must nevertheless keep the `Score` entity (Module 11) clean and extensible so that a coin/shop layer can be added later without migration.

Also out of scope for v1, to be confirmed:
- Moodle rewrite. The existing Moodle stays where it is; the CRM only links to it with SSO (Section 17.5). **Existing Moodle materials must not be deleted or lost** — this is an explicit requirement from the PDF.

---

## 4. Roles and permissions

Six roles. A single user account may hold **one role per branch** (e.g. a person can be Teacher in Branch A and Admin in Branch B), except SuperAdmin which is global.

### 4.1 Role definitions

| # | Role | Scope | Who |
|---|---|---|---|
| 1 | **SuperAdmin (Boss)** | All branches | Owner / director |
| 2 | **Admin (Branch director)** | One branch | Branch manager |
| 3 | **Manager (Reception / Call-centre)** | One branch | Front desk, works with leads and payments |
| 4 | **Teacher** | Own groups | Teaching staff |
| 5 | **Student** | Own data | Learner |
| 6 | **Parent** | Linked children | Parent of a minor student |

### 4.2 Permission matrix

Legend: ✅ full · 🟡 limited (see note) · ❌ none

| Capability | SuperAdmin | Admin | Manager | Teacher | Student | Parent |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **Branches** | | | | | | |
| Create / edit / archive branches | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Switch active branch | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View data of all branches at once (consolidated) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Staff** | | | | | | |
| Create Admin / Manager accounts | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Teacher accounts | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Students & groups** | | | | | | |
| Create / edit students | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create / edit groups, assign teachers | ✅ | ✅ | 🟡¹ | ❌ | ❌ | ❌ |
| Move student between groups / branches | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Attendance** | | | | | | |
| Mark attendance | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit attendance older than 48 h | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View own attendance | — | — | — | — | ✅ | ✅ |
| **Payments** | | | | | | |
| Accept a payment, print receipt | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| See debtor list (`qarzdor`) of the branch | ✅ | ✅ | ✅ | 🟡² | ❌ | ❌ |
| Cancel / refund a payment | ✅ | 🟡³ | ❌ | ❌ | ❌ | ❌ |
| Change a student's fee (`chek`) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Give a discount | ✅ | 🟡⁴ | ❌ | ❌ | ❌ | ❌ |
| **Fines** | | | | | | |
| Configure fine rules | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Issue a fine manually | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cancel a fine | ✅ | 🟡³ | ❌ | ❌ | ❌ | ❌ |
| See own fines | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Expenses** | | | | | | |
| Add an expense for own branch | ✅ | ✅ | 🟡⁵ | ❌ | ❌ | ❌ |
| Approve an expense | ✅ | 🟡⁶ | ❌ | ❌ | ❌ | ❌ |
| See branch expense total | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Finance** | | | | | | |
| Revenue / profit / P&L | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Salary amounts of any employee | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Own salary | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cross-branch financial comparison | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Content** | | | | | | |
| Upload / edit Library, Audio, Video | ✅ | ✅ | ❌ | 🟡⁷ | ❌ | ❌ |
| Consume content | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Site** | | | | | | |
| Edit landing content, news, teachers, prices | ✅ | 🟡⁸ | ❌ | ❌ | ❌ | ❌ |
| **System** | | | | | | |
| View audit log | ✅ | 🟡⁹ | ❌ | ❌ | ❌ | ❌ |

**Notes**
1. Manager may create a group but cannot set its price.
2. Teacher sees only a debt flag on students in their own groups — no amounts.
3. Only within the current calendar month; older records need SuperAdmin.
4. Up to a percentage limit configured by SuperAdmin (default 20 %).
5. Manager can only add expenses from a whitelist of petty categories (stationery, water, transport), limited by a per-transaction ceiling.
6. Admin approves up to a ceiling set by SuperAdmin; above it, SuperAdmin approval is required.
7. Teacher may upload to their own group's material folder only, subject to admin moderation.
8. Admin edits only their own branch's page fragment (address, phone, photos, staff).
9. Admin sees only actions performed inside their branch.

### 4.3 Enforcement

- Permissions live in a single `permissions.ts` map shared between the Next.js app and the Express API (published as an internal npm workspace package so the two can never drift).
- The **API is the source of truth**. Hiding a button in the UI is a convenience, never a security control. Every controller runs `can(user, action, resource)` before touching the database.
- Any endpoint returning money data (`/finance/*`, `payroll`, `profit`, `revenue`) is additionally guarded by a hard `requireRole('superadmin')` middleware placed at the router level, so a mistake in a single controller cannot leak it.

---

## 5. Multi-branch architecture

This is a **core** requirement, not an add-on. It must be built in from the first migration, not retrofitted.

### 5.1 Data scoping

- Every operational document carries `branchId: ObjectId` (indexed, required): `students`, `groups`, `lessons`, `attendance`, `invoices`, `payments`, `fines`, `expenses`, `leads`, `rooms`, `payrolls`.
- A **Mongoose plugin** automatically injects `branchId` into every query based on `AsyncLocalStorage` request context. Forgetting the filter in a controller must be impossible by construction.
- SuperAdmin may set the context to `ALL` for consolidated reports; this is the only way to bypass the filter, and it is logged.

### 5.2 Branch switcher (Boss panel)

- A persistent control in the top bar of the SuperAdmin panel: a searchable dropdown listing all branches plus an **"All branches (consolidated)"** option.
- Selection is stored in the JWT-adjacent session record server-side (not only in a cookie) so that API calls cannot be spoofed to another branch by editing local storage.
- Switching branches:
  - re-fetches all dashboard widgets via TanStack Query key invalidation,
  - preserves the current page where the route exists in the target branch,
  - shows a coloured strip (each branch has its own accent colour) so the boss can always tell at a glance which branch he is looking at.
- Keyboard shortcut `⌘/Ctrl + B` opens the branch switcher. `⌘/Ctrl + K` opens a global command palette (search student by name or phone across the active scope).

### 5.3 Branch entity

```
Branch {
  name, slug, city, address, phone[], email,
  accentColor, logo, coverPhoto,
  geo: { lat, lng },
  workingHours,
  currency: 'UZS',
  timezone: 'Asia/Tashkent',
  financialYearStart: 9,     // September, per Молия sheet
  isActive, openedAt,
  settings: { fineRules, discountCeiling, expenseApprovalCeiling, salaryRules }
}
```

- Each branch gets its **own page on the public site** (`/uz/filiallar/urganch`) with address, map, photos, staff and the courses actually offered there.
- Courses and prices may differ per branch: price is stored on `GroupPricing`, not globally on `Course`.
- A student can be transferred between branches; the transfer moves future invoices, keeps history, and is recorded in the audit log.

---

## 6. Module 1 — Public website (landing)

The current site is a bare React SPA with almost no indexable content. The new site is server-rendered, fast, multilingual and content-managed from the CRM.

### 6.1 Required pages

| Route | Page | Notes |
|---|---|---|
| `/[locale]` | Home | Full landing, sections below |
| `/[locale]/kurslar` | Courses index | Cards from the `Course` collection |
| `/[locale]/kurslar/[slug]` | Course detail | Programme, levels, duration, price, schedule, teachers, FAQ, apply CTA |
| `/[locale]/filiallar` | Branches | Map + cards |
| `/[locale]/filiallar/[slug]` | Branch detail | Address, photos, staff, courses, contacts |
| `/[locale]/oqituvchilar` | Teachers | Photo, certificates, experience, subjects |
| `/[locale]/natijalar` | Results | IELTS / CEFR score wall, student stories |
| `/[locale]/biz-haqimizda` | About | History since 2018, mission, partnerships |
| `/[locale]/yangiliklar` | News / blog | Index + `[slug]` detail, for SEO |
| `/[locale]/galereya` | Gallery | Photo + video albums |
| `/[locale]/aloqa` | Contact | Form, map, phones, social links |
| `/[locale]/royxatdan-otish` | Online registration | Module 2 |
| `/[locale]/faq` | FAQ | Accordion, schema.org FAQPage |
| `/[locale]/oferta`, `/maxfiylik` | Public offer, privacy policy | Legally required for online payment |
| `/kirish` | Login | Entry to all panels |

### 6.2 Home page sections (in order)

1. **Hero** — headline, sub-headline, two CTAs ("Ro'yxatdan o'tish" / "Bepul sinov darsi"), ambient animated background (Section 25.4), branch/phone quick contact.
2. **Trust bar** — Cambridge Assessment English Preparation Centre, IDP IELTS, British Council IELTS Registration Centre logos. *(Client to confirm these statuses are still current before publication.)*
3. **Numbers** — years since 2018, graduates, average IELTS band, number of branches. Count-up animation on scroll.
4. **Courses** — grid of course cards with gradient covers, level, duration, price, "Batafsil".
5. **Why Leader** — 4–6 differentiators with icons: qualified teachers, small groups, personal cabinet, attendance transparency for parents, exam-format mock tests, certificates.
6. **Results wall** — real students with their band scores/certificates, filterable by course. Strongest conversion element; must be easy for the admin to add to.
7. **Teachers** — carousel of teacher cards, each opening a detail sheet.
8. **How it works** — 4 steps: leave an application → free trial lesson → level test → start studying. This is a genuine sequence, so numbering is meaningful here.
9. **Personal cabinet promo** — screenshots of the student cabinet (attendance calendar, library, ranking), "Shaxsiy kabinet" button — this preserves the current site's `SHAXSIY KABINET` entry point described in `BIG_PROJECT.pdf` PIC 1.
10. **Testimonials** — text + video reviews (video hosted on our protected player, Section 17).
11. **Branches** — map with pins, address cards.
12. **News** — 3 latest posts.
13. **FAQ** — accordion.
14. **Registration form** — inline, short version (name, phone, course), full flow on its own page.
15. **Footer** — navigation, contacts, socials (Instagram, Telegram, Facebook, YouTube), language switcher, legal links.

### 6.3 SEO and performance requirements

- Server-side rendering / static generation with ISR (`revalidate: 300`) for all public pages.
- Per-locale `<title>`, `<meta description>`, Open Graph, `hreflang` alternates for `uz` / `ru` / `en`.
- `sitemap.xml` and `robots.txt` generated dynamically, including all courses, branches, news posts, in all three locales.
- JSON-LD: `EducationalOrganization`, `Course`, `FAQPage`, `BreadcrumbList`, `LocalBusiness` per branch.
- **Lighthouse targets: Performance ≥ 90 mobile, Accessibility ≥ 95, SEO 100.**
- All images through `next/image` with AVIF/WebP; hero LCP element preloaded.
- Yandex.Metrica + Google Analytics 4 + Meta Pixel + Telegram/Instagram click tracking; all events on the registration funnel are tracked (`form_start`, `form_step_2`, `lead_submitted`).

---

## 7. Module 2 — Online registration and lead funnel

### 7.1 Public form (multi-step, 3 steps)

**Step 1 — Who** — full name, phone (+998 mask, verified by SMS code), age or school class.
**Step 2 — What** — branch (auto-suggested by geolocation), course, preferred days (`har kun` / `toq` / `juft` — matching the `Kun` column of the workbook), preferred time slot.
**Step 3 — Confirm** — comment, "How did you hear about us?" (Instagram / friend / passing by / Telegram / other → feeds the marketing report), consent checkbox with link to the privacy policy.

Requirements:
- Validation with `zod` on both client and server; identical schema shared.
- Phone verification by SMS OTP (Eskiz.uz) with a 60-second resend cooldown and rate limiting (max 5 codes per number per hour) — this alone kills most spam.
- Honeypot field + Cloudflare Turnstile.
- Duplicate detection: if the phone already exists as a lead or student, the record is merged, not duplicated, and the manager sees "returning applicant".
- On submit: creates `Lead` → notifies the branch's managers in-app and via Telegram bot → sends the applicant an SMS confirmation → optionally adds the applicant to a Telegram channel invite.
- Success screen shows the branch address, a map link, and a "add to calendar" link for the trial lesson if a slot was chosen.

### 7.2 Lead pipeline (CRM)

Kanban board with drag-and-drop columns:

`Yangi` → `Bog'lanildi` → `Sinov darsiga yozildi` → `Sinov darsida qatnashdi` → `O'quvchi bo'ldi` ✅ / `Rad etdi` ❌

Each lead card: name, phone (click-to-call, click-to-Telegram), course, source, created date, assigned manager, next-action date, colour-coded urgency (red if untouched > 24 h).

Lead detail drawer: full history of calls and comments, status change log, ability to schedule a callback (creates a task + reminder), conversion button that opens the "Create student" form pre-filled.

**Conversion metrics** (Manager and above): leads by source, conversion rate per stage, average time to first contact, per-manager comparison, monthly funnel chart. This directly answers the `Кол-во абит` / `План` / `Выполнение` columns of the `Статистика` sheet.

---

## 8. Module 3 — Authentication and security

- **Login by phone + password**, or phone + SMS OTP for students/parents who forget passwords.
- Passwords hashed with **argon2id**. Minimum 8 characters, blocked against a common-password list.
- **JWT access token** (15 min, in memory) + **refresh token** (30 days, `httpOnly` `Secure` `SameSite=Strict` cookie, rotated on each use, reuse detection revokes the whole family).
- Sessions list per user ("Faol qurilmalar" — matching PIC 10 of the PDF) with the ability to terminate a session remotely. Terminating a session invalidates its refresh family immediately.
- **Optional PIN code** for the student cabinet ("Kirish kodi", PIC 10).
- 2FA (TOTP) **mandatory for SuperAdmin**, optional for Admin.
- Brute-force protection: `express-rate-limit` + progressive lockout (5 failures → 1 min, 10 → 15 min, tied to phone + IP).
- Staff accounts are created by an administrator; there is **no public staff self-registration**.
- All authentication events (login, failure, password change, session kill, role change) go to the audit log with IP and user-agent.
- **Data protection:** personal data of minors is involved. Store only what is needed; the student's `passportSeries` field is optional and encrypted at rest; parent phone numbers are required for legal contact.

---

## 9. Module 4 — Students, groups, schedule

### 9.1 Student card

Derived from the workbook columns (`F.I`, `Telefon`, `Status`, `Kelgan sanasi`, `Sinf`, `Yosh`, `Fan`, `O'qituvchi`, `Kun`, `Vaqti`, `Chek`):

- **Identity:** photo, full name, birth date, gender, school + class (`Sinf`) or age (`Yosh`), address.
- **Contacts:** student phone, parent name + phone, Telegram username.
- **Study:** branch, groups (a student may be in several — the workbook shows `matem/ingliz` combinations), start date (`Kelgan sanasi`), level, status.
- **Money:** monthly fee (`Chek`), discount, balance, debt, payment history, fines.
- **Documents:** contract, uploaded files.
- **Tabs:** Overview · Attendance · Payments · Exams · Fines · Comments · History.

**Student statuses** (mapped from the workbook's `Status` column):

| System status | Workbook equivalent | Meaning |
|---|---|---|
| `active` | (paid, studying) | Studying normally |
| `pending` | `Ожидает` | Enrolled, first payment not yet due/received |
| `overdue` | `Просрочено` | Debtor — payment past due |
| `paid` | `Оплачено` | Current month settled |
| `completed` | `Курс завершен` | Finished the course |
| `frozen` | — | Temporarily paused (holiday, illness) — no invoices generated |
| `dropped` | — | Left; requires a reason from a dropdown (price, moved away, dissatisfied, other) for the churn report |

### 9.2 Groups

```
Group {
  branchId, courseId, name,
  teacherId, assistantTeacherId?,
  roomId,
  schedule: { pattern: 'har_kun' | 'toq' | 'juft' | 'custom',
              days: [1..7], startTime, endTime },
  startDate, endDate, capacity,
  price,                        // per branch, overrides course default
  teacherShare: 0.6,            // from the Статистика sheet
  status: 'planned'|'active'|'finished'
}
```

- Group detail: student list with per-student debt badge, attendance grid, average score, quick actions (mark attendance, message all parents).
- Capacity warning when a group is full; waiting list.
- Group archive keeps all history; archived groups are excluded from all default views.

### 9.3 Schedule

- **Week grid** by room and by teacher, drag-and-drop rescheduling with **conflict detection** (room double-booking, teacher double-booking, student in two groups at the same hour) — the system blocks the save and names the conflict.
- Calendar views: day / week / month; filters by teacher, room, course, group.
- Public holidays calendar of Uzbekistan pre-loaded; lessons on holidays are auto-skipped (and therefore not billed) unless the admin overrides.
- Lesson generation: creating a group generates `Lesson` documents for the whole period, which attendance and teacher payroll attach to.

---

## 10. Module 5 — Attendance

Implements PIC 2 of `BIG_PROJECT.pdf`.

### 10.1 Marking (Teacher / Manager / Admin)

- Open group → today's lesson is at the top → one tap per student cycles `present → absent → late → excused`.
- Default state is **present** so a full-attendance lesson is one tap total ("Save").
- Marking closes automatically 48 hours after the lesson; later edits require Admin and are logged.
- Optional: mark a reason for absence, and whether the parent was informed.
- Bulk actions: "all present", "cancel lesson" (with reason — cancelled lessons do not consume a paid month).

### 10.2 Student / parent view

- Monthly calendar, absences marked as **red circles** exactly as in PIC 2.
- Tapping a red circle opens the info table: **course · time · teacher** — matching the PDF.
- Statistics strip: attendance %, total absences this month, longest streak.
- **Students and parents can never edit attendance data** (explicit PDF requirement).

### 10.3 Automation

- 3 consecutive absences → automatic notification to the parent (SMS + push) and a task for the manager to call.
- Attendance % below a configurable threshold (default 70 %) → student flagged on the admin dashboard.
- If enabled in settings, an absence can trigger a **fine** (Module 7) — off by default.

---

## 11. Module 6 — Payments, debtors, invoices

This module replaces the `1-oy … 8-oy` payment columns of the workbook.

### 11.1 Invoice generation

- Each active enrolment generates one `Invoice` per billing period.
- Billing period = calendar month by default; the group may instead use a **module cycle** (the workbook shows courses sold as 1-month modules).
- Generation runs on a scheduled job on day *N* of each month (configurable, default: the student's own enrolment day-of-month) and creates:
  ```
  Invoice { studentId, groupId, branchId, period: '2026-09',
            amount, discount, finalAmount,
            dueDate, status, paidAmount, paidAt, items[] }
  ```
- `status`: `pending` → `partial` → `paid` / `overdue` / `cancelled`.
- **Overdue rule:** `status = overdue` when `now > dueDate && paidAmount < finalAmount`. The number of grace days is a branch setting (default 3).
- Frozen and completed students generate no invoices.

### 11.2 Accepting a payment

The most-used screen in the whole CRM. Requirements:

- Search a student by name or by the **last 4 digits of a phone** — results appear as you type, showing photo, group and debt.
- One click "Accept payment" → modal pre-filled with the outstanding amount → choose method → confirm. **Under 15 seconds, no page reload.**
- **Payment methods:** `naqd` (cash), `plastik` (card terminal), `bank` (transfer), `Payme`, `Click`, `Uzum`. *(The workbook uses single-letter marks `к` / `б` in the monthly columns — the client must confirm what these stand for so they can be mapped correctly; see Section 31.)*
- Partial payments allowed; the balance stays visible as debt.
- Advance payments allowed; surplus goes to the student's `balance` and is auto-applied to the next invoice.
- Every payment produces a **printable receipt** (A5 and 58 mm thermal-printer layout) with branch logo, student name, period, amount in figures and words, cashier name, and a QR code linking to the receipt online.
- Payments are **immutable**. A mistake is corrected by a `refund` or `correction` document that references the original — never by editing or deleting. This is what makes the money history trustworthy.

### 11.3 Debtor control — `qarzdor` (explicit client requirement)

A dedicated **"Qarzdorlar"** page, available to Admin and Manager:

- Table: student · group · teacher · phone · parent phone · period · amount due · **days overdue** · last payment date · last contact date.
- Sorting and filtering by group, teacher, course, days overdue, amount.
- Colour bands: 🟡 1–3 days · 🟠 4–10 days · 🔴 more than 10 days.
- Row actions: call (tel:), write on Telegram, send an SMS reminder from a template, log a contact attempt, promise-to-pay date (moves the row to a "promised" state with its own reminder).
- **Bulk SMS** to all selected debtors from a template with variables `{name}`, `{amount}`, `{period}`, `{branch}`.
- Export to Excel and PDF.
- Separate tab **"Kurs puli to'lamaganlar"** — students who have not paid at all for the current period (as opposed to partially paid), which is the exact question the client asked for.
- Dashboard widget: total debt of the branch, number of debtors, change vs. last month.

> **Important:** Admin and Manager see debt **per student**. They do **not** see branch revenue, profit or margins — those are SuperAdmin-only (Module 10).

### 11.4 Online payment (Payme / Click / Uzum)

- Student or parent can pay from the personal cabinet.
- Integration through each provider's merchant API with webhook confirmation; the invoice is settled only on a verified webhook, never on a client-side redirect.
- All callbacks verified by signature; idempotency keys prevent double crediting.
- Failed and pending transactions are visible to the admin with the provider's transaction id.

### 11.5 Automatic reminders

| Trigger | Channel | Recipient |
|---|---|---|
| 3 days before due date | SMS + push | Student + parent |
| On due date | SMS + push | Student + parent |
| 3 days overdue | SMS + push + manager task | Student + parent + manager |
| 7 days overdue | Call task, and optional automatic fine | Manager |

All templates are editable per language in Settings.

---

## 12. Module 7 — Fines (jarima)

> Client: *"жарималарни хам инобатга ол"*

The fine engine covers **both** students and employees, because a learning centre uses both. Each rule can be switched off; nothing fires automatically unless the SuperAdmin enables it.

### 12.1 Fine object

```
Fine {
  branchId,
  targetType: 'student' | 'employee',
  targetId,
  ruleId?,                    // null for manual fines
  reason,                     // free text, required for manual
  amount,                     // fixed sum or computed
  currency: 'UZS',
  issuedBy, issuedAt,
  status: 'pending' | 'applied' | 'paid' | 'cancelled' | 'appealed',
  appliedTo: 'invoice' | 'payroll',
  relatedDocId,               // the invoice or payroll it was attached to
  cancelledBy?, cancelReason?,
  attachments[]               // photo, memo
}
```

### 12.2 Student fines

| Rule | Default | Configurable |
|---|---|---|
| Late payment | Off | Fixed sum, or % of the overdue amount, after *N* days overdue, optionally capped |
| Repeated unexcused absence | Off | Sum, threshold in lessons |
| Damage to property | Manual only | Sum entered by the admin, photo attachment |
| Loss of a book / material | Manual only | Sum |
| Behaviour violation | Manual only | Sum or warning (0 sum) |

- A student fine is attached to the **next invoice** as a separate line item — it never silently merges into the course fee. The student sees `Kurs puli 700 000` and `Jarima 20 000` as two lines.
- The student cabinet shows a "Jarimalar" section with reason, amount, date, and status.

### 12.3 Employee fines

| Rule | Default | Configurable |
|---|---|---|
| Late arrival to a lesson | Off | Sum per occurrence, grace period in minutes |
| Missed lesson without notice | Off | Sum, or *k* × lesson rate |
| Attendance journal not filled within 48 h | Off | Sum per lesson |
| Dress code / internal rules | Manual only | Sum |
| Documented complaint | Manual only | Sum |

- An employee fine is attached to the **next payroll** as a deduction line and is visible to that employee in their own salary breakdown.
- Only SuperAdmin configures the rules; Admin may issue a fine within a ceiling.

### 12.4 Process guarantees

- Every fine requires a **reason**; manual fines require free text of at least 10 characters.
- The target person is **notified** (push + SMS) when a fine is applied, with the reason.
- **Appeal:** the target can press "Norozilik bildirish" once per fine with a comment; this moves it to `appealed` and creates a task for the Admin/SuperAdmin, who confirms or cancels. Cancellation requires a reason.
- Fines are reversible only by cancellation (never deleted), and cancellations are logged.
- **Reports:** fines by type, by month, by branch, by employee, total collected. Fine income appears in the finance module as a separate revenue line, not mixed into course revenue.

---

## 13. Module 8 — Expenses (harajat)

> Client: *"харажат кисми хам булсин супер ва простой админдда"* — powerful, but simple, in the admin panel.

This maps directly onto the `Харажат 2026-2027` column of the `Молия` sheet.

### 13.1 The "simple" part — quick add

A single floating **"+ Harajat"** button available from anywhere in the admin panel. The modal has exactly four required fields:

1. **Amount** (numeric keypad on mobile, thousand separators as you type)
2. **Category** (large icon tiles, not a dropdown)
3. **Date** (defaults to today)
4. **Comment** (optional) + **photo of the receipt** (optional, camera capture on mobile)

Nothing else. Save closes the modal and shows a toast with an Undo action for 10 seconds. Target: **under 10 seconds to record an expense**.

### 13.2 Categories (editable, with icons and colours)

Seeded from the client's real spending: `Arenda` (rent) · `Oylik` (salaries — auto-generated from payroll, not entered manually) · `Kommunal` (electricity, water, gas, internet) · `Reklama / Instagram` (tracked separately, as in the `Молия` sheet) · `Kanselyariya` (stationery, printing) · `Jihoz` (equipment) · `Ta'mirlash` (repairs) · `Transport` · `Soliq` (taxes) · `Mehmondorchilik` · `Tadbirlar` (events, graduation) · `Boshqa`.

Each category supports sub-categories one level deep.

### 13.3 The "powerful" part

- **Recurring expenses** — rent, internet, salaries: define once with a period (monthly / quarterly), and the system creates a draft expense on the due date and reminds the admin to confirm it.
- **Approval workflow** — expenses above the branch ceiling enter `pending_approval` and appear in the SuperAdmin's approvals queue with the receipt photo. Push notification on submission.
- **Attachments** — multiple photos or PDFs per expense, stored in object storage, viewable in a lightbox.
- **Supplier directory** — optional counterparty per expense, enabling "how much did we pay this supplier this year".
- **Budgets** — a monthly planned amount per category; the expense list shows plan vs. actual with a progress bar and warns at 80 % and 100 % of budget.
- **Filters** — period, category, branch, author, amount range, approval status, "has receipt".
- **Views** — table, category-grouped summary, and a monthly comparison chart.
- **Export** — Excel (`exceljs`) reproducing the `Молия` sheet layout so the accountant's existing habits survive, and PDF for printing.
- **Cross-branch** — SuperAdmin can view expenses of all branches at once, grouped by branch, with a per-branch comparison chart.

### 13.4 Visibility

- Admin sees and adds expenses **of their own branch**, and sees the branch expense total.
- Admin does **not** see revenue or profit — so an expense total alone tells them nothing about margins.
- SuperAdmin sees everything, across all branches.

---

## 14. Module 9 — Salaries and payroll

### 14.1 Salary schemes

| Scheme | Formula | Typical for |
|---|---|---|
| **Fixed** | Fixed monthly sum | Admin, cleaner, guard |
| **Percentage** | `Σ(collected fees of the teacher's groups) × share` — the `Статистика` sheet uses **0.6** | Teachers |
| **Per lesson** | `lessons conducted × rate` | Substitute teachers |
| **Per student** | `active students × rate` | Some teachers |
| **Mixed** | Fixed base + percentage or KPI bonus | Senior staff |

The share is stored per group (`teacherShare`, default 0.6) and can be overridden per employee.

### 14.2 Payroll run

- Monthly payroll document per employee:
  ```
  Payroll { branchId, employeeId, period,
            base, lessonsCount, collectedBase,
            bonuses[], fines[],       // from Module 7
            advances[],               // avans paid mid-month
            gross, deductions, net,
            status: 'draft'|'approved'|'paid', paidAt }
  ```
- The run is **calculated automatically** and opened as a draft for SuperAdmin review; each line is expandable to show which groups and which collected payments produced the number.
- Percentage schemes calculate on **money actually collected**, not on money invoiced — this is the correct incentive and matches how the centre already works.
- Approved payroll automatically creates an `Expense` in the `Oylik` category, so the `Молия` sheet's three streams (Ойлик / Харажат / Выручка) reconcile without double entry.
- Each employee sees **only their own** payslip: base, lessons, bonuses, fines with reasons, net.

---

## 15. Module 10 — Finance dashboard (SuperAdmin only)

> Client requirement: **finance of the learning centre must be seen by SuperAdmin only.**

Route group `/boss/finance/*`, guarded at the router level. Not merely hidden — a request from an Admin token returns `403` and is written to the audit log.

### 15.1 Dashboard widgets

- **Revenue** — this month, vs. last month, vs. same month last year; by branch; by course.
- **Expenses** — this month by category; recurring vs. one-off.
- **Salary load** — total payroll, payroll as % of revenue.
- **Profit** — revenue − expenses − payroll, with a monthly trend line.
- **Receivables** — total outstanding debt, ageing buckets (1–7 / 8–30 / 30+ days).
- **Collection rate** — collected ÷ invoiced for the period. The single most important operational number.
- **Average cheque** (`Средняя` in the `Статистика` sheet) — per course and per branch.
- **Plan vs. fact** — planned student count and revenue per course against actual, reproducing the `План` / `Выполнение` columns.
- **Marketing efficiency** — Instagram/ads spend vs. leads vs. converted students → cost per lead and cost per student.
- **Branch comparison** — a table ranking branches by revenue, profit, students, debt, collection rate.

### 15.2 Reports

- P&L by month for the financial year **September → August** (as in `Молия`).
- Cash-flow report by day/week/month.
- Course profitability: revenue − teacher share − attributable expenses.
- Teacher profitability: money collected in their groups vs. their salary.
- Student lifetime value and average months of retention.
- Churn report with reasons.
- Every report: period picker, branch filter, chart + table, export to Excel and PDF.

### 15.3 Presentation

Charts via `recharts`. All monetary figures use `Intl.NumberFormat('uz-UZ')` with a so'm suffix. A global "hide amounts" toggle (blurs all sums) for when the boss opens the panel in public.

---

## 16. Module 11 — Exams, scores, ranking

Implements PIC 5 of `BIG_PROJECT.pdf` — **without** the coin exchange.

- Admin (or teacher, with admin moderation) creates a **control test** for a group: title, date, themes, maximum score per theme.
- Results are entered per student, per theme. Bulk entry: a spreadsheet-like grid for the whole group, with paste-from-Excel support.
- **1 correct answer = 1 score** (explicit rule in the PDF).
- A theme can be marked `absent`, which contributes `0` — exactly as PIC 5 shows.
- Student cabinet → **Ranking**: total score in the header, a table of `Theme · Correct · Score`, plus history across tests and a trend chart.
- Group leaderboard, optionally anonymised (setting), and a branch-level leaderboard per course.
- Students can never modify score data (explicit PDF requirement).
- Certificates: on course completion the system generates a PDF certificate from a template with the student's name, course, period, and a verification QR code pointing to a public verification page.

---

## 17. Module 12 — Library, Audio, Video (protected content)

### 17.1 Library (PIC 3)

- Sections configurable by the admin (the PDF shows `Bestsellers`, `IELTS`); each section is a horizontal shelf of book covers.
- Book: cover, title, author, description, level, tags, language, file (PDF).
- **Reading happens in an in-app reader only** (Section 18). No file URL is ever exposed.
- Admin can add, replace, reorder, rename sections, change covers and hide books.

### 17.2 Audio (PIC 4, 4.1)

- Sections e.g. `Podcasts (advanced level)`, `Russian literature`.
- Track: cover, theme, level, episode number, duration, transcript (optional).
- Player exactly as PIC 4.1: theme/level/episode header, seek bar with elapsed/total, shuffle, previous, play/pause, next, playlist.
- Background playback and playlist queue; playback position remembered per user.

### 17.3 Video (PIC 6, 6.1)

- Sections e.g. `Movies (advanced level)`, `Grammar lessons`.
- Player with theme/level/episode header, seek bar, volume, subtitles, quality selector, fullscreen.
- **Adaptive streaming (HLS) with encrypted segments** — see Section 18.

### 17.4 Access control

- Content can be scoped to: everyone, specific courses, specific groups, or specific levels. A KIDS student does not see IELTS materials unless allowed.
- View statistics per material: unique viewers, total plays, average completion — useful for the admin to know what is actually used.

### 17.5 Moodle

- The existing Moodle stays. The cabinet shows a `MOODLE` tile that opens it through **SSO (LTI 1.3 or a signed-token auto-login)**, so the student does not log in twice.
- **The materials already uploaded to Moodle must not disappear or be deleted** (explicit PDF requirement). Migration, if ever wanted, is a separate project with a written backup plan.

---

## 18. Module 13 — Content protection: no download, no screenshot

> Client: *"видеоларни скачать килиб булмасин"*, *"пдф файлларни хам скачать ва скриншот килиб билмасин"*

**An honest engineering statement, which must be read and accepted by the client before development starts:**

On a web browser and on a phone, **screenshots cannot be made technically impossible**. Any content that a user's eyes can see can, in the last resort, be photographed with a second phone. Full DRM (Widevine L1 / FairPlay) raises the cost of copying but does not reduce it to zero either, and it is expensive to license.

What this project will therefore deliver is **strong deterrence plus traceability**: copying becomes inconvenient, low-quality, and — most importantly — **traceable back to the account that did it**. In practice this stops essentially all casual sharing, which is the real business problem.

### 18.1 Video protection

| Layer | Implementation |
|---|---|
| No direct file | Videos are transcoded to **HLS** (`ffmpeg`) and served as segments; the original MP4 is never reachable over HTTP |
| Encryption | **AES-128 encrypted segments**; the decryption key is served by our API only to an authenticated, authorised session, with a short TTL |
| Signed URLs | Every playlist and segment URL is signed and expires in 60 seconds, bound to the user id and IP |
| Referer / origin lock | The CDN rejects requests without our origin |
| Player | `hls.js` in a custom React player. Native controls disabled, `controlsList="nodownload"`, right-click menu disabled, `<video disablePictureInPicture>` |
| Rate limiting | Abnormal segment-fetch patterns (a downloader pulling all segments at once) are detected and the session is throttled and flagged |
| Watermark | A **dynamic overlay** showing the student's name and phone, moving position every 20–30 seconds, semi-transparent — makes a screen recording personally identifiable |
| Optional (phase 2) | Widevine/FairPlay DRM if the client accepts the licensing cost |

### 18.2 PDF / Library protection

| Layer | Implementation |
|---|---|
| No file delivery | The PDF is **never sent to the browser**. Server-side, each page is rendered to an image tile set (`pdfium`/`mupdf`), cached, and delivered page by page on demand through a signed, expiring endpoint |
| Custom reader | Canvas-based reader with page navigation, zoom, bookmarks and search-on-server. No `<embed>`, no `pdf.js` on a raw file, no object URL |
| Watermark | Every rendered page carries a diagonal watermark with the student's name, phone and timestamp, burned into the image server-side |
| Print | `@media print { body { display: none } }` plus a print-blocking overlay |
| Copy | Text layer is not delivered as selectable text; `user-select: none`, copy/cut/context-menu handlers suppressed |
| Keyboard | `PrintScreen`, `Ctrl/⌘+P`, `Ctrl/⌘+S`, `Ctrl/⌘+Shift+S`, `Win+Shift+S` intercepted where the browser allows; on `PrintScreen` the clipboard is overwritten with a notice |
| Blur on blur | The reader blanks its content when the tab loses focus or `visibilitychange` fires — this defeats most screen-capture tools that need the window active, and defeats OS screenshot UIs that briefly steal focus |
| DevTools deterrent | Detection of devtools opening → content blanked and the event logged |
| Mobile apps (if built later) | `FLAG_SECURE` on Android (genuinely blocks screenshots at OS level) and screenshot-detection on iOS |
| Traceability | Every page render is logged with user, material, page, timestamp. Abnormal behaviour (e.g. 300 pages in 4 minutes) raises an admin alert |

### 18.3 What the client must acknowledge

A short paragraph will be included in the contract: *the contractor implements the protection measures listed in Section 18; the client understands that no web technology can fully prevent a determined user from photographing the screen, and accepts watermarking + logging as the mitigation for that residual risk.*

---

## 19. Module 14 — Notifications

Implements PIC 9 of `BIG_PROJECT.pdf` — two tabs: **Bildirishnomalar** (personal notifications) and **Yangiliklar** (news).

### 19.1 Channels

- **In-app** — bell icon with unread count, real-time via Socket.io.
- **Web push** — service worker, for browsers.
- **SMS** — Eskiz.uz (primary) or Play Mobile, for payment and absence alerts.
- **Telegram bot** — free, and the most reliable channel in Uzbekistan. Parents link their Telegram to the student by a one-time code; they then receive attendance and payment alerts as messages.
- **Email** — optional, low priority.

### 19.2 Event catalogue

| Event | Recipients | Channels |
|---|---|---|
| Payment due in 3 days / today / overdue | Student, Parent | In-app, SMS, TG |
| Payment received | Student, Parent | In-app, TG |
| Fine issued | Target | In-app, SMS, TG |
| Marked absent | Parent | In-app, TG |
| 3 consecutive absences | Parent, Manager | In-app, SMS, TG |
| Control test scheduled / results published | Student, Parent | In-app, TG |
| New material in Library/Audio/Video | Assigned students | In-app |
| Lesson cancelled or rescheduled | Group students, Parents | In-app, SMS, TG |
| New lead | Branch managers | In-app, TG |
| Expense needs approval | SuperAdmin | In-app, TG |
| Course completed / certificate ready | Student, Parent | In-app, TG |

### 19.3 Admin capabilities

- Compose an announcement to a target audience (all / branch / course / group / debtors only / teachers), choose channels, schedule it, preview per language.
- Templates per language with variables; a template editor with live preview and an SMS character/segment counter.
- Delivery report per broadcast: sent, delivered, failed, read.
- Per-user notification preferences ("Sozlamalar"), with legally-required transactional messages (payment, safety) not switchable off.

---

## 20. Module 15 — Reports and statistics

Available at the level each role is permitted to see (Section 4.2).

**Academic:** attendance by group / teacher / course / period · average scores · progress dynamics · group fill rate · retention.
**Sales:** leads by source and by manager · conversion funnel · trial-lesson attendance and conversion · cost per lead.
**Operations:** students count by course and branch (the `Всего чел` column) · new vs. dropped per month · teacher load in lessons/hours · room utilisation.
**Financial (SuperAdmin):** as in Section 15.2.

Every report shares one component contract: period picker (with presets: this month, last month, quarter, financial year Sept–Aug, custom), branch filter, group-by selector, chart, table, Excel export, PDF export, and a "save as my report" bookmark.

---

## 21. Module 16 — Settings, i18n, audit log

### 21.1 Settings (SuperAdmin)

Branches · Courses and prices · Rooms · Fine rules · Expense categories and budgets · Salary schemes · Discount ceilings · Payment methods and integrations · Notification templates · SMS provider credentials · Public site content · Roles and staff accounts · Backups.

### 21.2 Internationalisation

- **Three languages: O'zbek (default), Русский, English**, on both the public site and all panels.
- `next-intl` with the App Router; locale in the path (`/uz`, `/ru`, `/en`), locale detection on first visit with a persistent cookie, `hreflang` alternates.
- Translation files as JSON namespaces per module. All user-visible strings come from the dictionary — a lint rule fails the build on hard-coded Cyrillic or Latin UI text in components.
- **Dynamic content** (course names, news, book titles, teacher bios) is stored as a localised object:
  ```
  title: { uz: '...', ru: '...', en: '...' }
  ```
  The admin sees three tabs when editing; `uz` is required, others fall back to `uz` if empty.
- Formatting: dates via `date-fns` with `uz`/`ru`/`en` locales; numbers and money via `Intl.NumberFormat`. Dates display as `dd.MM.yyyy`.
- **Cyrillic support is a hard constraint on font selection** (see Section 25.2) — the Russian interface must not fall back to a system font.
- SMS templates are stored per language and selected by the recipient's preferred language.

### 21.3 Audit log

- Every create / update / delete of a significant entity is written to an append-only `AuditLog` collection: actor, role, branch, action, entity, entity id, **before/after diff**, IP, user-agent, timestamp.
- Mandatory for: payments, refunds, fines, expenses, payroll, discounts, price changes, role changes, student transfers, attendance edits after 48 h, branch context switches, and any `403` on a finance endpoint.
- Searchable and filterable by actor, entity, period. Retained 3 years. Not deletable from the UI by anyone, including SuperAdmin.

---

## 22. Data model (MongoDB collections)

Mongoose 8, TypeScript-typed. All collections: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt` (soft delete).

```
branches          _id, name, slug, city, address, phones[], accentColor, geo,
                  workingHours, financialYearStart, settings{}, isActive

users             _id, phone (unique), passwordHash, fullName, photo,
                  roles: [{ role, branchId }], locale, isActive,
                  twoFactor{}, pinCodeHash, lastLoginAt

students          _id, branchId, userId?, fullName, photo, birthDate, gender,
                  schoolClass, age, address,
                  phone, parentName, parentPhone, telegramId,
                  status, joinedAt, source, level,
                  monthlyFee, discount{type,value}, balance,
                  documents[], comments[]

parents           _id, userId, students[]

courses           _id, name{uz,ru,en}, slug, description{}, level,
                  durationMonths, defaultPrice, cover, isPublic, order

groups            _id, branchId, courseId, name, teacherId, roomId,
                  schedule{pattern,days[],startTime,endTime},
                  startDate, endDate, capacity, price, teacherShare, status

enrollments       _id, studentId, groupId, branchId, startDate, endDate,
                  price, discount, status

rooms             _id, branchId, name, capacity, equipment[]

lessons           _id, groupId, branchId, date, startTime, endTime,
                  teacherId, roomId, topic, status(planned|held|cancelled),
                  cancelReason

attendance        _id, lessonId, studentId, groupId, branchId,
                  status(present|absent|late|excused), reason,
                  markedBy, markedAt, editedBy?, editedAt?

invoices          _id, studentId, groupId, branchId, period('YYYY-MM'),
                  items[{type:'tuition'|'fine'|'other', refId, amount}],
                  amount, discount, finalAmount, paidAmount,
                  dueDate, status, paidAt

payments          _id, invoiceId?, studentId, branchId, amount, method,
                  providerTxnId?, receivedBy, receivedAt, receiptNo,
                  note, isRefund, refundOf?

fines             _id, branchId, targetType, targetId, ruleId?, reason,
                  amount, status, appliedTo, relatedDocId,
                  issuedBy, issuedAt, cancelledBy?, cancelReason?,
                  appeal{ text, at, resolvedBy, resolution }, attachments[]

fineRules         _id, branchId?, scope, trigger, calc{type,value,cap},
                  thresholdDays?, isActive

expenses          _id, branchId, categoryId, subCategoryId?, amount, date,
                  comment, supplierId?, attachments[],
                  isRecurring, recurrenceId?, status(draft|pending|approved|rejected),
                  createdBy, approvedBy?, approvedAt?

expenseCategories _id, name{}, icon, color, parentId?, monthlyBudget?, order

payrolls          _id, branchId, employeeId, period, scheme, base,
                  lessonsCount, collectedBase, bonuses[], fines[],
                  advances[], gross, deductions, net, status, paidAt

salarySchemes     _id, employeeId, branchId, type, fixedAmount?, share?,
                  perLessonRate?, perStudentRate?, effectiveFrom

leads             _id, branchId, fullName, phone, age, courseId,
                  preferredDays, preferredTime, source, comment,
                  status, assignedTo, nextActionAt, history[],
                  convertedStudentId?, utm{}

exams             _id, groupId, branchId, title, date, themes[{name,maxScore}],
                  createdBy

examResults       _id, examId, studentId, scores[{theme,correct,score}],
                  total, absentThemes[]

materials         _id, branchId?, type('book'|'audio'|'video'),
                  section, title{}, author, description{}, level, tags[],
                  cover, storageKey, hlsKey?, duration?, pages?,
                  access{ scope, courseIds[], groupIds[] },
                  stats{views,uniqueUsers}, isActive, order

mediaAccessLogs   _id, userId, materialId, action, page?, position?, ip, at

notifications     _id, userId, type, title{}, body{}, data{}, channels[],
                  readAt, sentAt, status

announcements     _id, branchId?, audience{}, title{}, body{}, channels[],
                  scheduledAt, sentAt, stats{}

settings          _id, branchId?, key, value

auditLogs         _id, actorId, role, branchId, action, entity, entityId,
                  before, after, ip, userAgent, at

posts             _id, slug, title{}, excerpt{}, body{}, cover,
                  publishedAt, isPublished, tags[]

teachers(profile) _id, userId, branchIds[], subjects[], bio{},
                  certificates[], experienceYears, photo, isPublic, order
```

**Indexes (minimum):**
`students(branchId, status)`, `students(phone)`, `students(fullName text)`,
`invoices(branchId, status, dueDate)`, `invoices(studentId, period)` unique,
`payments(branchId, receivedAt)`, `attendance(lessonId, studentId)` unique,
`lessons(groupId, date)`, `fines(branchId, targetId, status)`,
`expenses(branchId, date, categoryId)`, `leads(branchId, status, createdAt)`,
`auditLogs(entity, entityId, at)`, `mediaAccessLogs(userId, at)`.

---

## 23. REST API surface

Base: `/api/v1`. JSON. Errors follow a single envelope:
```json
{ "error": { "code": "INVOICE_ALREADY_PAID", "message": "...", "details": {} } }
```
Lists are paginated: `?page=1&limit=25&sort=-createdAt&search=&branchId=`.

```
AUTH
POST   /auth/login                      phone + password
POST   /auth/otp/request                phone → SMS code
POST   /auth/otp/verify
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
GET    /auth/sessions
DELETE /auth/sessions/:id
POST   /auth/2fa/enable | verify | disable

BRANCHES (superadmin)
GET/POST/PATCH/DELETE  /branches[/:id]
POST   /branches/switch                 { branchId | 'ALL' }

STAFF
GET/POST/PATCH  /users[/:id]
PATCH  /users/:id/roles
GET    /users/:id/payroll

STUDENTS
GET/POST/PATCH/DELETE  /students[/:id]
GET    /students/:id/attendance | payments | invoices | fines | exams
POST   /students/:id/transfer           { toBranchId | toGroupId }
POST   /students/:id/freeze | unfreeze
GET    /students/export                 xlsx

GROUPS & SCHEDULE
GET/POST/PATCH/DELETE  /groups[/:id]
POST   /groups/:id/students             enroll
DELETE /groups/:id/students/:studentId
GET    /schedule?from=&to=&teacherId=&roomId=
POST   /lessons/:id/cancel

ATTENDANCE
GET    /attendance?groupId=&date=
POST   /attendance/bulk                 [{studentId,status}]
PATCH  /attendance/:id

PAYMENTS
GET    /invoices?status=overdue&branchId=
POST   /invoices/generate               (cron + manual)
GET    /invoices/:id
POST   /payments                        accept payment
POST   /payments/:id/refund
GET    /payments/:id/receipt.pdf
GET    /debtors                         qarzdorlar list
GET    /debtors/unpaid                  kurs puli to'lamaganlar
POST   /debtors/notify                  bulk SMS
POST   /webhooks/payme | click | uzum

FINES
GET/POST  /fines
POST   /fines/:id/cancel
POST   /fines/:id/appeal
GET/POST/PATCH  /fine-rules             (superadmin)

EXPENSES
GET/POST/PATCH/DELETE  /expenses[/:id]
POST   /expenses/:id/approve | reject
GET/POST/PATCH  /expense-categories
GET    /expenses/summary?groupBy=category|month|branch
GET    /expenses/export                 xlsx

PAYROLL (superadmin, except own)
POST   /payroll/calculate               { period }
GET    /payroll?period=
POST   /payroll/:id/approve | pay
GET    /payroll/me

FINANCE (superadmin only)
GET    /finance/overview
GET    /finance/revenue | expenses | profit | cashflow
GET    /finance/collection-rate
GET    /finance/branches-comparison
GET    /finance/pnl?year=2026
GET    /finance/export

LEADS
GET/POST/PATCH  /leads[/:id]
POST   /leads/:id/convert
GET    /leads/funnel

EXAMS
GET/POST  /exams
POST   /exams/:id/results               bulk
GET    /ranking?groupId=|branchId=

MATERIALS
GET/POST/PATCH/DELETE  /materials[/:id]
GET    /materials/:id/manifest.m3u8     signed, short TTL
GET    /materials/:id/key               HLS AES key, authorised only
GET    /materials/:id/page/:n           watermarked page image
POST   /materials/:id/log               view telemetry

NOTIFICATIONS
GET    /notifications
POST   /notifications/read
POST   /announcements
GET    /announcements/:id/stats

PUBLIC (no auth, rate-limited)
GET    /public/courses | branches | teachers | posts | results
POST   /public/leads                    registration form
POST   /public/otp/request | verify
POST   /public/contact
```

---

## 24. Frontend architecture and packages

### 24.1 Structure

One Next.js 15 application (App Router, TypeScript, React 19), three route groups:

```
app/
  (site)/[locale]/...          public website
  (cabinet)/[locale]/...       student & parent cabinet
  (crm)/[locale]/...           manager, teacher, admin
  (boss)/[locale]/...          superadmin
  api/                         BFF proxy only (auth cookie handling)
```

Business logic lives in the Express API. Next.js is for rendering, routing and UX; it never talks to MongoDB directly.

### 24.2 Packages

| Purpose | Package | Why |
|---|---|---|
| Framework | `next@15`, `react@19`, `typescript` | SSR/ISR, App Router |
| Styling | `tailwindcss@4` | Speed and consistency |
| Components | `shadcn/ui` + `radix-ui` | Accessible primitives we own the code of |
| **Animation** | **`motion` (Framer Motion 12)** | Layout animations, page transitions, gesture-driven UI |
| **Animation** | **`gsap` + `ScrollTrigger`** | Orchestrated scroll sequences on the landing only |
| Smooth scroll | `lenis` | Used **only** on the public site, never in the CRM |
| Number motion | `motion` `useSpring` + custom `<CountUp/>` | Stat counters, live money figures |
| Gradients / atmosphere | `@paper-design/shaders-react` *or* a hand-written WebGL mesh-gradient canvas | The animated gradient signature; static CSS fallback for `prefers-reduced-motion` and low-end devices |
| Icons | `lucide-react` | Consistent, tree-shakeable |
| i18n | `next-intl` | App Router native, type-safe messages |
| Data fetching | `@tanstack/react-query@5` | Caching, invalidation on branch switch |
| Client state | `zustand` | Branch context, UI state |
| URL state | `nuqs` | Filters survive refresh and are shareable |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` | Shared schemas with the backend |
| Tables | `@tanstack/react-table` | Debtors, payments, expenses — sorting, column visibility, sticky columns |
| Charts | `recharts` | Finance dashboards |
| Calendar | `react-day-picker`, `@schedule-x/react` | Attendance calendar, schedule grid |
| Drag & drop | `@dnd-kit/core` | Lead kanban, schedule rescheduling |
| Toasts | `sonner` | Non-blocking feedback with Undo |
| Command palette | `cmdk` | `⌘K` global search |
| Carousel | `embla-carousel-react` | Course/teacher shelves |
| Video | `hls.js` | Encrypted HLS playback |
| Audio | `howler` or native `<audio>` + custom UI | Podcast player |
| Excel export | `xlsx` (SheetJS) | Client-side quick exports |
| Dates | `date-fns` + `date-fns-tz` | Locale-aware, tree-shakeable |
| Phone input | `libphonenumber-js` | +998 validation |
| Realtime | `socket.io-client` | Notifications, live dashboard |
| Errors | `@sentry/nextjs` | Production monitoring |

### 24.3 Performance discipline

- The CRM is a **dashboard**, not a showreel. Animations there are limited to 150–250 ms transitions, skeleton loaders and layout shifts. No scroll-jacking, no parallax, no smooth-scroll library.
- Heavy modules (charts, tables, the video player, the PDF reader) are `dynamic()`-imported.
- Every list is virtualised beyond 100 rows.
- `prefers-reduced-motion` is respected everywhere: shaders freeze to a static gradient, transitions collapse to opacity.

---

## 25. Design direction and UI system

The client asked for "beautiful gradients and beautiful UI". Gradients are therefore in the brief — but they must be a deliberate identity, not a generic purple SaaS wash.

### 25.1 Concept — "Khorezm light"

The centre is in Urganch, next to Khiva. The visual identity borrows from **Khiva majolica tilework**: deep indigo and turquoise glaze over warm clay, with the geometry of the tile grid used as the layout's structural device. This is specific to this client, defensible in front of the boss, and it distinguishes the site from every other learning-centre site in the country, which are all blue-and-orange.

### 25.2 Tokens

**Colour**

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0B1B2B` | Text, dark surfaces |
| `--glaze` | `#0E7C86` | Primary — turquoise glaze |
| `--indigo` | `#1E3A8A` | Secondary, gradient anchor |
| `--clay` | `#C2643C` | Warm accent, CTAs on dark |
| `--sand` | `#F5F1E8` | Page background (light) |
| `--paper` | `#FFFFFF` | Cards |
| Semantic | `#16A34A` success · `#F59E0B` warning · `#DC2626` danger · `#0EA5E9` info | Statuses |

**Signature gradient:** `linear-gradient(135deg, var(--indigo) 0%, var(--glaze) 55%, #2DD4BF 100%)` — used on the hero shader, on primary buttons, and as the accent bar of each branch (each branch shifts the hue by a fixed offset, so the boss recognises the branch by colour instantly).

**Debt colours are deliberately outside the brand palette** (amber → orange → red) so a debtor row can never be confused with a decorative element.

**Typography** — the hard constraint is **full Cyrillic + Latin coverage**, because the Russian interface must not fall back to a system font.

| Role | Face | Notes |
|---|---|---|
| Display | **Unbounded** | Wide, geometric, distinctive; full Cyrillic. Used sparingly: hero, section titles, big numbers |
| Body / UI | **Onest** | Neutral, excellent Cyrillic, made for interfaces |
| Data | **JetBrains Mono** | Money columns, receipts, ids — tabular figures so sums align |

Type scale (rem): `0.75 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25 / 3 / 4`. Display weights 500–700 only; body 400/500/600.

**Layout** — 12-column grid, 1280 px container, 8 px spacing unit. Radius `16px` cards, `12px` inputs, `999px` pills. Two shadow levels only.

### 25.3 Structural device

The tile grid: section eyebrows are set as a small square glyph plus a label, and course/teacher cards align to a visible 4-unit rhythm. Numbered markers are used **only** in the "How it works" section, because that content genuinely is a sequence — nowhere else.

### 25.4 Signature element

A **living glaze gradient** in the hero: a WebGL mesh gradient whose flow follows the pointer slowly, with a faint tile-grid mask over it so the colour appears to move *behind* ceramic. It is the one bold thing on the page; everything around it stays quiet. It degrades to a static CSS gradient on `prefers-reduced-motion`, on low-power devices, and when WebGL is unavailable.

### 25.5 Motion rules

- Landing: one orchestrated page-load sequence (hero elements stagger in over 600 ms), scroll-triggered reveals at 12 % viewport entry, hover micro-interactions on cards (lift 4 px, gradient border sweep). Nothing animates twice.
- CRM: functional motion only — modal 180 ms, drawer 220 ms, toast slide, skeleton shimmer, `layoutId` transitions when a table row expands into a detail panel.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for entries, `cubic-bezier(0.4, 0, 1, 1)` for exits.

### 25.6 Quality floor (not negotiable)

Responsive from 360 px up · visible keyboard focus rings · `prefers-reduced-motion` honoured · WCAG AA contrast on all text · dark mode for the CRM panels (the boss opens it at night) · touch targets ≥ 44 px · every screen has designed empty, loading and error states, and error messages say what happened and what to do next.

---

## 26. Backend architecture and packages

### 26.1 Structure

```
src/
  config/          env (zod-validated), db, redis, logger
  modules/         one folder per domain
    students/  { routes, controller, service, model, schema, tests }
    payments/  ...
  middleware/      auth, rbac, branchScope, validate, errorHandler, rateLimit
  jobs/            invoice generation, reminders, payroll, backups
  integrations/    eskiz, payme, click, uzum, telegram, s3
  utils/
```

Layering rule: **routes → controller → service → model**. Controllers never contain business logic; services never touch `req`/`res`. This keeps the codebase understandable for whoever maintains it after handover.

### 26.2 Packages

| Purpose | Package |
|---|---|
| Framework | `express@5`, `typescript` |
| ODM | `mongoose@8` |
| Validation | `zod` (schemas shared with the frontend via a workspace package) |
| Auth | `jsonwebtoken`, `argon2` |
| Security | `helmet`, `cors`, `express-rate-limit`, `express-mongo-sanitize`, `hpp` |
| Logging | `pino`, `pino-http` |
| Files | `multer`, `@aws-sdk/client-s3` (S3 or self-hosted MinIO), `sharp` |
| Media | `fluent-ffmpeg` (HLS transcode + AES-128), `mupdf`/`pdfium` bindings for page rasterisation |
| Jobs | `bullmq` + Redis (retries, scheduling, dead-letter queue) |
| Realtime | `socket.io` |
| Excel / PDF | `exceljs`, `pdfkit` (receipts, certificates) |
| SMS | Eskiz.uz REST client |
| Telegram | `telegraf` |
| Testing | `vitest`, `supertest`, `mongodb-memory-server` |
| Docs | `swagger-jsdoc` + `swagger-ui-express` at `/api/docs` |

### 26.3 Scheduled jobs

| Job | Schedule |
|---|---|
| Generate invoices | Daily 00:30 |
| Recalculate invoice statuses → overdue | Daily 01:00 |
| Payment reminders (T−3, T, T+3, T+7) | Daily 09:00 |
| Auto-fines for overdue payments (if enabled) | Daily 01:30 |
| Create draft recurring expenses | Daily 02:00 |
| Calculate payroll draft | Monthly, 1st, 03:00 |
| Attendance digest to parents | Daily 20:00 |
| MongoDB backup | Daily 03:30, retained 30 days + monthly archive 12 months |
| Media access anomaly scan | Hourly |

All jobs are idempotent (safe to re-run) and record their outcome in a `jobRuns` collection visible to SuperAdmin.

### 26.4 Money handling

- All monetary values stored as **integers in so'm** (no floats, no `Decimal128` ambiguity). Formatting happens only at the presentation layer.
- Payment + invoice updates run inside a **MongoDB transaction** (replica set required, even on a single node).
- Idempotency keys on payment creation and on all provider webhooks.

---

## 27. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | API p95 < 300 ms for list endpoints; dashboard first paint < 2 s on 4G; public pages LCP < 2.5 s |
| **Capacity** | 10 branches, 5 000 active students, 100 concurrent staff users without architectural change |
| **Availability** | 99.5 % monthly; planned maintenance announced 24 h ahead, outside 08:00–21:00 |
| **Mobile** | Every CRM screen works on a phone. Attendance marking, payment acceptance and expense entry are designed **mobile-first** — that is where they are actually used |
| **Browsers** | Last 2 versions of Chrome, Safari, Firefox, Edge; Android 9+; iOS 15+ |
| **Offline** | Attendance marking queues locally and syncs when the connection returns (the internet in branches is not always stable) |
| **Security** | HTTPS only, HSTS; rate limiting on all public endpoints; no secrets in the repository; dependency audit in CI; server-side authorisation on every request |
| **Data protection** | Personal data of minors: minimum necessary collection, encryption at rest for sensitive fields, access logged. Retention policy documented |
| **Backups** | Daily automated, stored off-server, **restore tested at least once before handover** |
| **Localisation** | Full uz / ru / en parity — no English-only screens |
| **Accessibility** | WCAG 2.1 AA on the public site; keyboard-operable CRM |
| **Code quality** | TypeScript strict, ESLint + Prettier, Husky pre-commit, conventional commits, PR review; ≥ 70 % unit test coverage on `services/` |
| **Documentation** | Swagger API docs, README with local setup, deployment runbook, and a **video walkthrough in Uzbek for each role** — this matters more than any document for a non-technical team |

---

## 28. Infrastructure and deployment

**Recommended (cost-effective for Uzbekistan):**

- **App server:** VPS 4 vCPU / 8 GB / 160 GB NVMe (a local provider for latency, or Hetzner). Docker Compose: `api`, `web`, `mongo`, `redis`, `minio`, `caddy`.
- **Reverse proxy:** Caddy or Nginx with automatic TLS.
- **Database:** MongoDB 8 as a single-node **replica set** (transactions require it), or MongoDB Atlas M10+ if the client prefers managed.
- **Object storage:** MinIO on the same server initially; move to S3-compatible cloud when media volume grows.
- **Media:** a separate volume for HLS output; CDN in front of it in phase 2.
- **Environments:** `dev` (local) → `staging` (`staging.leaderonline.uz`, seeded demo data) → `production`.
- **CI/CD:** GitHub Actions — lint, typecheck, test, build, push image, deploy on tag. Rollback = redeploy the previous tag.
- **Monitoring:** Sentry (errors), Uptime Kuma (availability), `pino` logs shipped to a log viewer, a Telegram alert channel for the technical contact.
- **Domains:** `leaderonline.uz` (site), `crm.leaderonline.uz` (panels), `api.leaderonline.uz`, `cdn.leaderonline.uz`.

**Migration of existing data:** a one-off importer script reads the current Excel workbook (`НАМУНА.xlsx`) sheet by sheet and creates courses, groups, students and their payment history. Dates in the workbook are Excel serial numbers (e.g. `46252`) and must be converted correctly. Migration runs first on staging, is verified by the client against the workbook totals, and only then on production.

---

## 29. Delivery phases and estimates

Estimates assume one full-stack developer working full time; they roughly halve with a second developer on the frontend.

| Phase | Contents | Est. |
|---|---|---|
| **0. Setup** | Repo, monorepo workspaces, CI, Docker, environments, design tokens, base UI kit | 1 week |
| **1. Core** | Auth, roles, branches + branch switcher, users, students, courses, groups, schedule | 3 weeks |
| **2. Operations** | Attendance (web + mobile + offline queue), notifications core, Telegram bot | 2 weeks |
| **3. Money** | Invoices, payments, receipts, **debtors / qarzdor**, discounts, online payment integration | 3 weeks |
| **4. Fines & expenses** | Fine engine + rules + appeals; expenses, categories, budgets, approvals, recurring | 2 weeks |
| **5. Payroll & finance** | Salary schemes, payroll runs, SuperAdmin finance dashboard, P&L, exports | 2 weeks |
| **6. Public site** | Landing + all pages, 3 languages, SEO, online registration + lead kanban | 3 weeks |
| **7. Cabinet & content** | Student/parent cabinet, exams & ranking, Library/Audio/Video, protection layer, Moodle SSO | 3 weeks |
| **8. Reports & polish** | All reports, exports, audit log, performance pass, accessibility pass | 2 weeks |
| **9. Migration, training, launch** | Excel import, staging acceptance, staff training + video guides, go-live, 2 weeks hypercare | 2 weeks |
| | **Total** | **≈ 23 weeks (5–6 months)** |

**Suggested MVP (if the client wants value sooner — ≈ 10 weeks):** Phases 0, 1, 2, 3 + a simplified expense module + the landing page with online registration. Fines, payroll, the full finance dashboard and the protected content library follow in a second stage.

---

## 30. Acceptance criteria

The system is accepted when all of the following are demonstrated on production data:

1. SuperAdmin switches between at least 2 branches and every figure on screen changes accordingly; consolidated mode shows correct totals.
2. An Admin account receives `403` on every finance endpoint, and the attempt appears in the audit log.
3. Admin opens **"Qarzdorlar"** and sees, for their branch, every student with an overdue invoice, with days overdue and amount; and opens **"Kurs puli to'lamaganlar"** and sees students with nothing paid for the current period.
4. A payment is accepted and a receipt printed in under 15 seconds; the invoice status, the student's debt and the dashboard widget all update without a page reload.
5. A fine is issued to a student and to a teacher; the student's next invoice shows it as a separate line, the teacher's payslip shows it as a deduction, both are notified, and an appeal reaches the admin.
6. An expense is recorded from a phone in under 10 seconds including a receipt photo; an above-ceiling expense goes to SuperAdmin for approval.
7. Payroll is calculated for a month; a percentage-based teacher's figure is traceable to the exact collected payments that produced it.
8. Attendance is marked for a full group in one save; the student's calendar shows red circles on absent days and the info table appears on tap.
9. A video cannot be saved by right-click, by `Ctrl+S`, by devtools network inspection of a direct file, or by common downloader extensions; a screen recording carries the viewer's name.
10. A library PDF cannot be downloaded; the reader blanks on focus loss; every page carries the reader's watermark; the print dialog produces nothing usable.
11. The full site and all panels are complete in **uz, ru and en** — no untranslated strings, no Cyrillic font fallback.
12. An application submitted from the site appears in the lead kanban within 5 seconds and notifies the branch manager on Telegram.
13. Lighthouse on the home page: Performance ≥ 90 (mobile), Accessibility ≥ 95, SEO 100.
14. A backup is restored onto a clean environment and the data matches.
15. Staff training is completed and the Uzbek-language video guides are delivered.

---

## 31. Open questions for the client

These must be answered before the corresponding phase starts. Nothing here blocks Phase 0–1.

1. **The `к` / `б` marks** in the monthly payment columns of `НАМУНА.xlsx` — what do they stand for? (Cash / card? Paid / debt?) The payment-method list depends on this answer.
2. **`Chek` units** — is `700` seven hundred thousand so'm? Confirm so the importer scales correctly.
3. **Number of branches now**, and how many are planned in the next two years?
4. **Which online payment providers** does the centre already have a merchant contract with — Payme, Click, Uzum? (Contracts take time; start early.)
5. **SMS provider account** — does the centre have an Eskiz.uz account and an approved sender name? Approved template texts?
6. **Fines** — which specific fines does the centre actually apply today, and at what amounts? Are staff fines wanted from day one, or students only?
7. **Expense approval ceiling** — above what amount must the boss approve?
8. **Teacher share** — is `0.6` used for all teachers, or does it vary?
9. **Billing cycle** — strictly calendar month, or from the student's own start date? What happens to the fee when a student joins mid-month?
10. **Certifications** — are the Cambridge / IDP / British Council statuses still current and may they be shown on the landing page?
11. **Moodle** — version and URL, and is SSO integration wanted in v1?
12. **Mobile applications** — is a native iOS/Android app wanted later? (It affects the media-protection design; `FLAG_SECURE` genuinely blocks screenshots on Android, which the web cannot.)
13. **Existing data** — is `НАМУНА.xlsx` the complete current dataset, or are there other workbooks or a database to migrate?
14. **Domain and hosting** — who controls the DNS for `leaderonline.uz`, and where is it hosted now?
15. **Brand assets** — is there a logo in vector format, brand colours, official photos of the branches and teachers? If not, a photo session should be scheduled before the landing page is built.

---

*End of technical mission. Sections 4, 5, 11, 12, 13 and 18 encode explicit client requirements and should not be reduced without written agreement.*

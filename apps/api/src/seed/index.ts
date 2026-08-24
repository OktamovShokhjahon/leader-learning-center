import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Types } from 'mongoose'
import { normalizePhone } from '@leader/shared/schemas'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'
import { hashPassword } from '../modules/auth/password.service.js'
import { Branch } from '../modules/branches/branch.model.js'
import { Course, Group, Room } from '../modules/groups/group.model.js'
import { generateLessons, enrollStudent } from '../modules/groups/group.service.js'
import { Student } from '../modules/students/student.model.js'
import { User } from '../modules/users/user.model.js'
import { Enrollment, Lesson, Attendance } from '../modules/groups/group.model.js'
import { Invoice, Payment } from '../modules/payments/invoice.model.js'
import { currentPeriod } from '../modules/payments/payment.service.js'
import { Expense, ExpenseCategory } from '../modules/expenses/expense.model.js'
import { Fine, FineRule, SalaryScheme } from '../modules/fines/fine.model.js'
import { Lead } from '../modules/leads/lead.model.js'
import { TestModule } from '../modules/tests/test.model.js'
import { Payroll } from '../modules/fines/fine.model.js'
import { Setting } from '../modules/settings/setting.model.js'
import { EXPENSE_CATEGORY_SEED, LEAD_STATUSES } from '@leader/shared/schemas'
import { runWithScope } from '../middleware/branch-scope.js'

/**
 * Every seeder, and the runner behind `npm run seed`.
 *
 * All three are idempotent: running this twice creates nothing the second time.
 * That is what makes it safe to run on staging after each deploy, and it is the
 * same property TZ §26.3 requires of the scheduled jobs.
 *
 * The runner at the bottom is a **separate entry point** from `server.ts` —
 * seeding is an operator action with a visible report and an exit code, not a
 * side effect of starting the API. Because `server.ts` also imports two of the
 * seeders directly, that runner is guarded by `isEntryPoint()`: importing this
 * module must never connect to a database or exit the process.
 */

/* ── Branches ─────────────────────────────────────────────────────────────── */

/**
 * ⚠️ PLACEHOLDER — mirrors `apps/web/src/content/branches.ts`. Both are replaced
 * by real client data (§31 Q3, Q15), after which the website reads branches from
 * `GET /public/branches` and this list becomes the migration's starting point.
 */
const BRANCHES = [
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
  for (const branch of BRANCHES) {
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

/* ── The first SuperAdmin ─────────────────────────────────────────────────── */

/**
 * TZ §8 — "Staff accounts are created by an administrator; there is no public
 * staff self-registration." Which leaves the question of where the *first*
 * administrator comes from. This does that, once, and only on an empty
 * collection.
 *
 * Nothing is created unless `SEED_SUPERADMIN_PHONE` and
 * `SEED_SUPERADMIN_PASSWORD` are both set: a hard-coded default password on a
 * boss account with access to every branch's finance would be the single worst
 * bug this project could ship.
 *
 * Sign-in is phone + password. TZ §8 made 2FA mandatory for SuperAdmin and that
 * requirement was lifted at the client's request (ADR 0002); self-service
 * password change was removed at their request too (ADR 0005), so this password
 * stands until another SuperAdmin issues a new one from the Accounts screen.
 * Enrolling a second factor from the panel via `POST /auth/2fa/enable` is
 * strongly recommended for an account that can read every branch's finance.
 */
export async function seedSuperadmin(): Promise<boolean> {
  const phone = env.SEED_SUPERADMIN_PHONE
  const password = env.SEED_SUPERADMIN_PASSWORD

  if (!phone || !password) {
    const existing = await User.countDocuments({ 'roles.role': 'superadmin', deletedAt: null })
    if (existing === 0) {
      logger.warn(
        'No SuperAdmin exists and none is configured. Set SEED_SUPERADMIN_PHONE and ' +
          'SEED_SUPERADMIN_PASSWORD, then restart, to create the first account.',
      )
    }
    return false
  }

  const normalizedPhone = normalizePhone(phone)

  if (await User.exists({ phone: normalizedPhone })) return false

  await User.create({
    fullName: 'SuperAdmin',
    phone: normalizedPhone,
    passwordHash: await hashPassword(password),
    roles: [{ role: 'superadmin' }],
    locale: 'uz',
    isActive: true,
  })

  logger.warn(
    { phone: normalizedPhone },
    'Created the bootstrap SuperAdmin. Sign in with the phone and password, then ' +
      'remove SEED_SUPERADMIN_* from the environment. Enabling 2FA ' +
      'on this account is strongly recommended: it can read every branch finance page.',
  )
  return true
}

/* ── Demo data ────────────────────────────────────────────────────────────── */

/**
 * Demo data for the CRM, so the panels can be exercised before real data lands.
 *
 * ⚠️ Development and staging only. It is skipped entirely in production and it
 * never touches a collection that already has rows, so it cannot overwrite real
 * students or groups.
 *
 * Every account uses the same password, printed on completion — these are demo
 * logins, not credentials to carry anywhere near production.
 */
const DEMO_PASSWORD = 'DemoParol2026!'

const COURSES = [
  { slug: 'general-english', uz: 'General English', ru: 'General English', price: 700000 },
  { slug: 'ielts', uz: 'IELTS tayyorgarlik', ru: 'Подготовка к IELTS', price: 900000 },
  { slug: 'kids', uz: 'Kids English', ru: 'Английский для детей', price: 500000 },
  { slug: 'matematika', uz: 'Matematika', ru: 'Математика', price: 650000 },
]

const STUDENT_NAMES = [
  'Dilnoza Rahimova', 'Aziz Tursunov', 'Shohruh Nazarov', 'Madina Yusupova',
  'Islom Bekmurodov', 'Zilola Mamatova', 'Javohir Aliyev', 'Sevara Qodirova',
  'Ruslan Xolmatov', 'Gulnora Sattorova', 'Otabek Jumaniyozov', 'Kamola Ismoilova',
  'Bexruz Sobirov', 'Nigora Ergasheva', 'Sanjar Qurbonov', 'Feruza Yo‘ldosheva',
]

/**
 * §10.2 / §16 — gives the first few demo students an actual login, so the
 * cabinet can be opened and reviewed.
 *
 * Idempotent and additive: it only touches a student that has no `userId` and
 * whose phone is not already a user, so re-running it is a no-op and it can
 * never take over a real account.
 */
async function linkStudentLogins(limit = 3): Promise<number> {
  // Once any student has a login the demo can show a cabinet, which is the whole
  // point of this helper. Without this guard a repeated seed keeps minting three
  // more accounts a run while reporting "0 created".
  if (await Student.exists({ userId: { $nin: [null, undefined] } })) return 0

  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const candidates = await Student.find({ userId: { $in: [null, undefined] } })
    .sort({ createdAt: 1 })
    .limit(limit)

  let created = 0
  for (const student of candidates) {
    if (!student.phone) continue
    if (await User.exists({ phone: student.phone })) continue

    const account = await User.create({
      fullName: student.fullName,
      phone: student.phone,
      passwordHash,
      roles: [{ role: 'student', branchId: student.branchId }],
      locale: 'uz',
    })
    student.userId = account._id
    await student.save()
    created += 1
  }

  return created
}

export async function seedDemo(): Promise<{ created: boolean; note: string }> {
  const branch = await Branch.findOne({ isActive: true }).sort({ createdAt: 1 })
  if (!branch) return { created: false, note: 'no branch — run seedBranches first' }

  if ((await Student.countDocuments()) > 0) {
    // Existing demo data is never rewritten, but a student that has no login
    // yet can still be given one — otherwise a database seeded before student
    // cabinets existed can never demonstrate them.
    const linked = await linkStudentLogins()
    return {
      created: false,
      note:
        linked > 0
          ? `students already exist — added ${linked} student login(s)`
          : 'students already exist — left untouched',
    }
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD)

  // ── Staff, one per role (§4.1) ──────────────────────────────────────────
  // No Admin: the role was retired and SuperAdmin absorbed it (ADR 0004). The
  // boss account comes from SEED_SUPERADMIN_*, not from here.
  const staff: Record<string, Types.ObjectId> = {}
  for (const [role, phone, name] of [
    ['manager', '+998900000102', 'Manager Menejerov'],
    ['teacher', '+998900000103', 'Aziza Yusupova'],
    ['teacher', '+998900000104', 'Jasur Ro‘zmetov'],
  ] as const) {
    const existing = await User.findOne({ phone })
    const user =
      existing ??
      (await User.create({
        fullName: name,
        phone,
        passwordHash,
        roles: [{ role, branchId: branch._id }],
        isActive: true,
      }))
    staff[phone] = user._id
  }

  const teacherA = staff['+998900000103']!
  const teacherB = staff['+998900000104']!

  // ── Courses and rooms ───────────────────────────────────────────────────
  const courseIds: Record<string, Types.ObjectId> = {}
  for (const [index, course] of COURSES.entries()) {
    const existing = await Course.findOne({ slug: course.slug })
    const doc =
      existing ??
      (await Course.create({
        slug: course.slug,
        name: { uz: course.uz, ru: course.ru, en: course.uz },
        defaultPrice: course.price,
        order: index + 1,
      }))
    courseIds[course.slug] = doc._id
  }

  // Rooms and groups are branch-scoped, so the writes run inside a branch scope.
  return runWithScope({ branchId: branch._id.toString(), role: 'superadmin' }, async () => {
    const rooms = await Room.insertMany([
      { branchId: branch._id, name: '1-xona', capacity: 14 },
      { branchId: branch._id, name: '2-xona', capacity: 12 },
    ])

    const startDate = new Date()
    startDate.setUTCDate(startDate.getUTCDate() - 30)
    const endDate = new Date()
    endDate.setUTCMonth(endDate.getUTCMonth() + 3)

    /**
     * The demo runs round the clock: every group meets all seven days, and the
     * four of them tile the 24 hours between them, so any moment a reviewer
     * picks has a lesson in progress.
     *
     * Two constraints shape how that is expressed. `har_kun` is six days in
     * `weekdaysFor()` — it means "every teaching day", and Sunday is not one —
     * so a genuinely seven-day group is `custom` with the days spelled out. And
     * `createGroupSchema` requires `endTime > startTime`, so no single lesson can
     * cross midnight; the day is covered by four blocks that meet end to end
     * instead.
     *
     * The room and teacher pairings stay non-overlapping, so this seeds cleanly
     * past the §9.3 double-booking checks.
     */
    const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7]
    const groupPlans = [
      { name: 'GE-A2 tunggi', course: 'general-english', teacher: teacherA, room: rooms[0]!._id, pattern: 'custom', start: '00:00', end: '06:00', price: 700000 },
      { name: 'Kids-1 ertalab', course: 'kids', teacher: teacherB, room: rooms[1]!._id, pattern: 'custom', start: '06:00', end: '12:00', price: 500000 },
      { name: 'IELTS-B2 kunduzgi', course: 'ielts', teacher: teacherA, room: rooms[0]!._id, pattern: 'custom', start: '12:00', end: '18:00', price: 900000 },
      { name: 'Matematika 9-sinf kechqurun', course: 'matematika', teacher: teacherB, room: rooms[1]!._id, pattern: 'custom', start: '18:00', end: '23:59', price: 650000 },
    ] as const

    const groups = []
    for (const plan of groupPlans) {
      const group = await Group.create({
        branchId: branch._id,
        courseId: courseIds[plan.course],
        name: plan.name,
        teacherId: plan.teacher,
        roomId: plan.room,
        schedule: {
          pattern: plan.pattern,
          days:
            plan.pattern === 'custom'
              ? EVERY_DAY
              : plan.pattern === 'toq'
                ? [1, 3, 5]
                : [2, 4, 6],
          startTime: plan.start,
          endTime: plan.end,
        },
        startDate,
        endDate,
        capacity: 12,
        price: plan.price,
        teacherShare: 0.6,
        status: 'active',
      })
      await generateLessons(group)
      groups.push(group)
    }

    // ── Students, spread across the groups ────────────────────────────────
    for (const [index, fullName] of STUDENT_NAMES.entries()) {
      const group = groups[index % groups.length]!
      const student = await Student.create({
        branchId: branch._id,
        fullName,
        phone: `+9989010${String(index).padStart(5, '0')}`,
        parentName: `${fullName.split(' ')[1]} (ota-ona)`,
        parentPhone: `+9989020${String(index).padStart(5, '0')}`,
        status: 'active',
        monthlyFee: group.price,
        joinedAt: startDate,
        // A couple of frozen students, so the "no invoice" path is exercised.
        ...(index === 14 ? { status: 'frozen' as const } : {}),
      })
      if (student.status !== 'frozen') {
        await enrollStudent(group.id, { studentId: student.id })
      }

      /**
       * §10.2 / §16 — a student has a cabinet, so the demo data needs an actual
       * login to open it with. Only the first three get one: the point is to
       * make the cabinet demonstrable, not to mint fifteen accounts nobody uses.
       *
       * The parent account (§4.1) is linked in a later phase, when the
       * parent↔children table lands; for now the student's own login is enough
       * to exercise the calendar and the payment history.
       */
      if (index < 3) {
        const account = await User.create({
          fullName,
          phone: student.phone,
          passwordHash,
          roles: [{ role: 'student', branchId: branch._id }],
          locale: 'uz',
        })
        student.userId = account._id
        await student.save()
      }
    }

    logger.warn(
      { password: DEMO_PASSWORD },
      'Demo data seeded. Staff logins: +998900000102 manager, ...103/104 teacher. ' +
        'Student logins: +998901000000, ...0001, ...0002.',
    )

    return {
      created: true,
      note: `${groups.length} groups, ${STUDENT_NAMES.length} students, password ${DEMO_PASSWORD}`,
    }
  })
}

/* ── Operations demo (§12–§16) ────────────────────────────────────────────── */

/**
 * Everything the newer modules need in order to be *demonstrable*.
 *
 * `seedDemo` above builds the academic core — courses, rooms, groups, students,
 * lessons. This builds the rest of the working day on top of it, and the
 * selection is deliberate: every screen in the panel should have something on it
 * after one `npm run seed`, and every state a screen can show should be
 * represented by at least one row. An empty table teaches nobody what a feature
 * does, and a table where every row looks the same teaches them the wrong thing.
 *
 * So: invoices that are paid, part-paid and overdue; an expense waiting on the
 * boss and several already booked; a fine that has been appealed; a payroll run
 * with a percentage teacher whose figure can be traced; leads sitting in all six
 * funnel stages. Idempotent throughout — a second run adds nothing.
 */
async function seedOperations(): Promise<{ created: boolean; note: string }> {
  const branches = await Branch.find({ isActive: true }).sort({ createdAt: 1 })
  if (branches.length === 0) return { created: false, note: 'no branches' }

  const summary: string[] = []

  for (const branch of branches) {
    await runWithScope({ branchId: branch._id.toString(), role: 'superadmin' }, async () => {
      summary.push(...(await seedBranchOperations(branch)))
    })
  }

  return summary.length > 0
    ? { created: true, note: summary.join(', ') }
    : { created: false, note: 'already present' }
}

async function seedBranchOperations(
  branch: InstanceType<typeof Branch>,
): Promise<string[]> {
  const done: string[] = []
  const period = currentPeriod()

  /* ── §13.2 expense categories ─────────────────────────────────────────── */
  let categoriesAdded = 0
  for (const seed of EXPENSE_CATEGORY_SEED) {
    if (await ExpenseCategory.exists({ slug: seed.slug, branchId: branch._id })) continue
    await ExpenseCategory.create({
      branchId: branch._id,
      slug: seed.slug,
      name: { uz: seed.uz, ru: seed.ru },
      icon: seed.icon,
      color: seed.color,
      petty: 'petty' in seed ? seed.petty : false,
      payrollOnly: 'payroll' in seed ? seed.payroll : false,
    })
    categoriesAdded += 1
  }
  if (categoriesAdded > 0) done.push(`${categoriesAdded} expense categories`)

  const categoryOf = async (slug: string) =>
    ExpenseCategory.findOne({ slug, branchId: branch._id })

  /* ── §13 expenses, including one waiting on the boss ──────────────────── */
  if ((await Expense.countDocuments({ branchId: branch._id })) === 0) {
    const plans = [
      { slug: 'arenda', amount: 4_500_000, comment: 'Oylik ijara', status: 'approved' },
      { slug: 'kommunal', amount: 620_000, comment: 'Elektr va suv', status: 'approved' },
      { slug: 'reklama', amount: 1_200_000, comment: 'Instagram reklama', status: 'approved' },
      { slug: 'kanselyariya', amount: 180_000, comment: 'Qog‘oz, marker', status: 'approved' },
      { slug: 'transport', amount: 90_000, comment: 'Taksi', status: 'approved' },
      // Above the default 1 000 000 ceiling, so the Approvals queue is not empty.
      { slug: 'jihoz', amount: 7_400_000, comment: 'Proyektor', status: 'pending_approval' },
    ] as const

    let added = 0
    for (const [index, plan] of plans.entries()) {
      const category = await categoryOf(plan.slug)
      if (!category) continue
      const spentAt = new Date()
      spentAt.setUTCDate(spentAt.getUTCDate() - index * 3)
      await Expense.create({
        branchId: branch._id,
        categoryId: category._id,
        amount: plan.amount,
        spentAt,
        comment: plan.comment,
        status: plan.status,
        ...(plan.status === 'approved' ? { approvedAt: new Date() } : {}),
      })
      added += 1
    }
    if (added > 0) done.push(`${added} expenses`)
  }

  /* ── §11 invoices and payments — the debtor list needs debtors ─────────── */
  const students = await Student.find({ branchId: branch._id, status: { $ne: 'dropped' } })
    .sort({ createdAt: 1 })
    .limit(16)
  if (students.length > 0 && (await Invoice.countDocuments({ branchId: branch._id })) === 0) {
    const cashierAccount =
      (await User.findOne({ 'roles.role': 'manager', 'roles.branchId': branch._id })) ??
      (await User.findOne({ 'roles.role': 'superadmin' }))
    if (!cashierAccount) return done
    const cashier = cashierAccount._id

    let paid = 0
    let partial = 0
    let overdue = 0

    for (const [index, student] of students.entries()) {
      if (student.status === 'frozen') continue // §9.1 — no invoice for a frozen student.

      const enrollment = await Enrollment.findOne({ studentId: student._id, status: 'active' })
      const amount = student.monthlyFee || 700_000
      const dueDate = new Date()
      dueDate.setUTCDate(10)

      const invoice = await Invoice.create({
        branchId: branch._id,
        studentId: student._id,
        groupId: enrollment?.groupId,
        period,
        amount,
        finalAmount: amount,
        dueDate,
        status: 'pending',
      })

      // A third settle in full, a third pay something, a third pay nothing —
      // which is what makes "Qarzdorlar" and the collection rate meaningful.
      const kind = index % 3
      if (kind === 0) {
        await settle(branch._id, invoice, amount, 'naqd', cashier)
        paid += 1
      } else if (kind === 1) {
        await settle(branch._id, invoice, Math.round(amount / 2), 'plastik', cashier)
        partial += 1
      } else {
        // Overdue: due date pushed into last month so the ageing buckets fill.
        invoice.dueDate = new Date(Date.now() - 12 * 24 * 3600 * 1000)
        invoice.status = 'overdue'
        await invoice.save()
        overdue += 1
      }
    }
    done.push(`${paid + partial + overdue} invoices (${paid} paid, ${partial} partial, ${overdue} overdue)`)
  }

  /* ── §10 attendance on lessons that have already happened ─────────────── */
  if ((await Attendance.countDocuments({ branchId: branch._id })) === 0) {
    const past = await Lesson.find({
      branchId: branch._id,
      date: { $lte: new Date() },
      status: { $ne: 'cancelled' },
    })
      .sort({ date: -1 })
      // A month of lessons, so the §10.2 calendar has something on most days
      // rather than two marks floating in an empty grid.
      .limit(24)

    let marked = 0
    for (const [lessonIndex, lesson] of past.entries()) {
      const enrolled = await Enrollment.find({ groupId: lesson.groupId, status: 'active' })
      for (const [index, enrollment] of enrolled.entries()) {
        /**
         * Mostly present, with enough absences to draw the §10.2 red circles.
         *
         * The seed varies on the *lesson* as well as the student. Keying on the
         * student alone gave every one of them the same status on every lesson
         * — a handful permanently absent, the rest permanently present — which
         * makes the cabinet's headline read "0% attendance, 2 absences" and
         * teaches a reader the wrong thing about what the screen shows.
         */
        const slot = index * 3 + lessonIndex * 5
        const status =
          slot % 9 === 0 ? 'absent' : slot % 13 === 0 ? 'late' : slot % 17 === 0 ? 'excused' : 'present'
        await Attendance.create({
          branchId: branch._id,
          lessonId: lesson._id,
          studentId: enrollment.studentId,
          groupId: lesson.groupId,
          status,
          markedAt: lesson.date,
        })
        marked += 1
      }
    }
    if (marked > 0) done.push(`${marked} attendance marks`)
  }

  /* ── §12 fine rules and fines, one of them appealed ───────────────────── */
  if ((await FineRule.countDocuments({ branchId: branch._id })) === 0) {
    await FineRule.create({
      branchId: branch._id,
      name: { uz: 'To‘lov kechikishi', ru: 'Задержка оплаты' },
      targetType: 'student',
      trigger: 'late_payment',
      amount: 20_000,
      threshold: 1,
      gracePeriodDays: 3,
      isActive: false, // §12 — nothing fires until the boss switches it on.
    })
    await FineRule.create({
      branchId: branch._id,
      name: { uz: 'Darsga kechikish', ru: 'Опоздание на урок' },
      targetType: 'employee',
      trigger: 'late_arrival',
      amount: 50_000,
      threshold: 3,
      isActive: false,
    })
    done.push('2 fine rules')
  }

  if ((await Fine.countDocuments({ branchId: branch._id })) === 0) {
    const student = students[0]
    const teacher = await User.findOne({ 'roles.role': 'teacher', 'roles.branchId': branch._id })

    if (student) {
      await Fine.create({
        branchId: branch._id,
        targetType: 'student',
        targetId: student._id,
        amount: 20_000,
        reason: 'Kurs puli uch kundan ortiq kechikdi',
        appliedTo: 'invoice',
        status: 'issued',
      })
    }
    if (teacher) {
      await Fine.create({
        branchId: branch._id,
        targetType: 'employee',
        targetId: teacher._id,
        amount: 50_000,
        reason: 'Darsga uch marta kechikib keldi',
        appliedTo: 'payroll',
        status: 'issued',
      })
      // One appeal open, so the boss has something to decide (§12.4).
      await Fine.create({
        branchId: branch._id,
        targetType: 'employee',
        targetId: teacher._id,
        amount: 30_000,
        reason: 'Dars jurnalini vaqtida to‘ldirmadi',
        appliedTo: 'payroll',
        status: 'appealed',
        appeal: {
          at: new Date(),
          by: teacher._id,
          text: 'Internet uzilgan edi, ertasiga to‘ldirdim',
        },
      })
      done.push('3 fines')
    }
  }

  /* ── §14 salary schemes, one of each shape worth showing ──────────────── */
  const staff = await User.find({
    'roles.branchId': branch._id,
    'roles.role': { $in: ['manager', 'teacher'] },
    deletedAt: null,
  })
  let schemesAdded = 0
  for (const person of staff) {
    if (await SalaryScheme.exists({ userId: person._id })) continue
    const isTeacher = person.roles.some((assignment) => assignment.role === 'teacher')
    await SalaryScheme.create({
      branchId: branch._id,
      userId: person._id,
      // A percentage teacher is the case §30.7 asks to be traceable; the manager
      // is fixed, which is the other half of the payroll screen.
      scheme: isTeacher ? 'percentage' : 'fixed',
      baseAmount: isTeacher ? 0 : 4_000_000,
      ...(isTeacher ? { share: 0.6 } : {}),
      isActive: true,
    })
    schemesAdded += 1
  }
  if (schemesAdded > 0) done.push(`${schemesAdded} salary schemes`)

  /* ── §7.2 leads across every funnel stage ─────────────────────────────── */
  if ((await Lead.countDocuments({ branchId: branch._id })) === 0) {
    const names = [
      'Nodira Ergasheva',
      'Bobur Xudoyberganov',
      'Sevinch Ollaberganova',
      'Temur Matyoqubov',
      'Malika Doschanova',
      'Ulug‘bek Saparov',
    ]
    for (const [index, fullName] of names.entries()) {
      const status = LEAD_STATUSES[index % LEAD_STATUSES.length]!
      await Lead.create({
        branchId: branch._id,
        fullName,
        phone: `+99893${String(1000000 + index).padStart(7, '0')}`,
        courseSlug: COURSES[index % COURSES.length]!.slug,
        branchSlug: branch.slug,
        source: (['instagram', 'friend', 'passing_by', 'telegram', 'other'] as const)[index % 5],
        status,
        age: 12 + index,
        history: [{ at: new Date(), action: 'created' }],
      })
    }
    done.push(`${names.length} leads`)
  }

  /* ── §16 online test modules, so the cabinet has something to sit ────── */
  if ((await TestModule.countDocuments({ branchId: branch._id })) === 0) {
    const courses = await Course.find({ deletedAt: null }).sort({ order: 1 }).limit(2)
    let modules = 0

    for (const course of courses) {
      for (const order of [1, 2]) {
        await TestModule.create({
          branchId: branch._id,
          courseId: course._id,
          title: { uz: `${course.name.uz} — ${order}-modul` },
          order,
          passMark: 60,
          isPublished: true,
          // Four questions is enough to show the runner, the pass mark and the
          // per-question review without turning the seed into a content pack.
          questions: QUIZ.map((question, index) => ({
            key: `q${index + 1}`,
            prompt: { uz: question.prompt },
            options: question.options.map((text, at) => ({
              key: String.fromCharCode(97 + at),
              text: { uz: text },
            })),
            correctKey: question.correct,
            explanation: { uz: question.explanation },
          })),
        })
        modules += 1
      }
    }
    if (modules > 0) done.push(`${modules} test modules`)
  }

  /* ── §14 a payroll draft, so the boss's screen is not empty ───────────── */
  if ((await Payroll.countDocuments({ branchId: branch._id })) === 0) {
    const schemes = await SalaryScheme.find({ branchId: branch._id, isActive: true })
    let payslips = 0

    for (const scheme of schemes) {
      // Percentage teachers are paid on money *collected* (§30.7), so read the
      // payments the seed just booked rather than inventing a number.
      const collected = await Payment.aggregate<{ total: number; ids: Types.ObjectId[] }>([
        { $match: { branchId: branch._id } },
        { $group: { _id: null, total: { $sum: '$amount' }, ids: { $push: '$_id' } } },
      ])
      const total = scheme.scheme === 'percentage' ? (collected[0]?.total ?? 0) : 0
      const share = scheme.share ?? 0.6
      const gross =
        scheme.scheme === 'percentage' ? Math.round(total * share) : (scheme.baseAmount ?? 0)

      await Payroll.create({
        branchId: branch._id,
        userId: scheme.userId,
        period,
        scheme: scheme.scheme,
        basis: {
          collectedTotal: total,
          paymentIds: scheme.scheme === 'percentage' ? (collected[0]?.ids ?? []) : [],
          share,
        },
        gross,
        deductions: [],
        net: gross,
        status: 'draft',
      })
      payslips += 1
    }
    if (payslips > 0) done.push(`${payslips} payslips (draft)`)
  }

  /* ── §21.1 one override, so the settings screen shows both states ─────── */
  if (!(await Setting.exists({ key: 'money.discountCeilingPercent', branchId: branch._id }))) {
    await Setting.create({
      key: 'money.discountCeilingPercent',
      branchId: branch._id,
      value: 25,
    })
    done.push('1 settings override')
  }

  return done
}

/** A tiny shared quiz — the point is a working module, not a syllabus. */
const QUIZ = [
  {
    prompt: 'Choose the correct form: She ___ to school every day.',
    options: ['go', 'goes', 'going', 'gone'],
    correct: 'b',
    explanation: 'Third person singular in the present simple takes -s.',
  },
  {
    prompt: 'What is the plural of "child"?',
    options: ['childs', 'childes', 'children', 'child'],
    correct: 'c',
    explanation: '"Children" is an irregular plural.',
  },
  {
    prompt: '15 × 4 = ?',
    options: ['45', '54', '60', '64'],
    correct: 'c',
    explanation: '15 × 4 = 60.',
  },
  {
    prompt: 'Which word is a synonym of "quick"?',
    options: ['slow', 'fast', 'late', 'heavy'],
    correct: 'b',
    explanation: '"Fast" and "quick" mean the same thing.',
  },
] as const

/** Books a payment against an invoice and moves its status accordingly. */
async function settle(
  branchId: Types.ObjectId,
  invoice: { _id: Types.ObjectId; studentId: Types.ObjectId; finalAmount: number; paidAmount?: number; status: string; save: () => Promise<unknown> },
  amount: number,
  method: 'naqd' | 'plastik',
  /** §11.2 — a payment always records the person who took it. */
  receivedBy: Types.ObjectId,
) {
  await Payment.create({
    branchId,
    receivedBy,
    invoiceId: invoice._id,
    studentId: invoice.studentId,
    amount,
    method,
    receivedAt: new Date(),
    approvalStatus: 'approved',
    idempotencyKey: `seed-${invoice._id.toString()}-${amount}`,
  })
  invoice.paidAmount = amount
  invoice.status = amount >= invoice.finalAmount ? 'paid' : 'partial'
  await invoice.save()
}

/* ── The runner ───────────────────────────────────────────────────────────── */

type SeedResult = { name: string; created: number; note?: string }

async function run(): Promise<SeedResult[]> {
  const results: SeedResult[] = []

  const branches = await seedBranches()
  results.push({
    name: 'branches',
    created: branches,
    note: branches === 0 ? 'already present' : undefined,
  })

  const superadmin = await seedSuperadmin()
  results.push({
    name: 'superadmin',
    created: superadmin ? 1 : 0,
    note: superadmin
      ? 'enrolling 2FA on this account is strongly recommended (§8, ADR 0002)'
      : env.SEED_SUPERADMIN_PHONE
        ? 'already present'
        : 'skipped — set SEED_SUPERADMIN_PHONE and SEED_SUPERADMIN_PASSWORD',
  })

  // Development and staging only — never fabricates data in production.
  if (!env.isProduction) {
    const demo = await seedDemo()
    results.push({ name: 'demo data', created: demo.created ? 1 : 0, note: demo.note })

    // Everything the money, fines, payroll and funnel screens need in order to
    // show something real. Runs after the academic core it depends on.
    const operations = await seedOperations()
    results.push({
      name: 'operations',
      created: operations.created ? 1 : 0,
      note: operations.note,
    })
  }

  return results
}

async function main() {
  await connectDatabase()

  try {
    const results = await run()

    const width = Math.max(...results.map((result) => result.name.length))
    const lines = results.map((result) => {
      const name = result.name.padEnd(width)
      const count = String(result.created).padStart(3)
      return `  ${name}  ${count} created${result.note ? `  — ${result.note}` : ''}`
    })

    const total = results.reduce((sum, result) => sum + result.created, 0)
    process.stdout.write(`\nSeed complete — ${total} document(s) created\n${lines.join('\n')}\n\n`)
  } finally {
    await disconnectDatabase()
  }
}

/**
 * True only when this file *is* the process entry point.
 *
 * `server.ts` imports `seedBranches` and `seedSuperadmin` from here, and an
 * import must not open its own database connection or call `process.exit`.
 * `realpathSync` on both sides so a symlinked path or a differently-cased
 * Windows drive letter still compares equal.
 */
function isEntryPoint(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isEntryPoint()) {
  main().catch((error) => {
    logger.fatal({ err: error }, 'seed failed')
    process.exitCode = 1
    void disconnectDatabase()
  })
}

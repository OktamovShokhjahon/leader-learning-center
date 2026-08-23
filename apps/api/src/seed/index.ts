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
 * The account is created with `mustChangePassword` set. Sign-in is phone +
 * password: TZ §8 made 2FA mandatory for SuperAdmin, and that requirement was
 * lifted at the client's request — see docs/adr/0002-optional-two-factor.md.
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
    mustChangePassword: true,
    roles: [{ role: 'superadmin' }],
    locale: 'uz',
    isActive: true,
  })

  logger.warn(
    { phone: normalizedPhone },
    'Created the bootstrap SuperAdmin. Sign in with the phone and password, change ' +
      'the password, then remove SEED_SUPERADMIN_* from the environment. Enabling 2FA ' +
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

    const groupPlans = [
      { name: 'GE-A2 ertalab', course: 'general-english', teacher: teacherA, room: rooms[0]!._id, pattern: 'juft', start: '09:00', end: '10:30', price: 700000 },
      { name: 'IELTS-B2 kechqurun', course: 'ielts', teacher: teacherA, room: rooms[0]!._id, pattern: 'toq', start: '18:00', end: '19:30', price: 900000 },
      { name: 'Kids-1', course: 'kids', teacher: teacherB, room: rooms[1]!._id, pattern: 'juft', start: '14:00', end: '15:00', price: 500000 },
      { name: 'Matematika 9-sinf', course: 'matematika', teacher: teacherB, room: rooms[1]!._id, pattern: 'toq', start: '16:00', end: '17:30', price: 650000 },
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
          days: plan.pattern === 'toq' ? [1, 3, 5] : [2, 4, 6],
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
      ? 'sign in and change the password; enrolling 2FA is recommended (§8, ADR 0002)'
      : env.SEED_SUPERADMIN_PHONE
        ? 'already present'
        : 'skipped — set SEED_SUPERADMIN_PHONE and SEED_SUPERADMIN_PASSWORD',
  })

  // Development and staging only — never fabricates data in production.
  if (!env.isProduction) {
    const demo = await seedDemo()
    results.push({ name: 'demo data', created: demo.created ? 1 : 0, note: demo.note })
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

import { Types } from 'mongoose'
import { hashPassword } from '../modules/auth/password.service.js'
import { User } from '../modules/users/user.model.js'
import { Branch } from '../modules/branches/branch.model.js'
import { Course, Group, Room } from '../modules/groups/group.model.js'
import { Student } from '../modules/students/student.model.js'
import { generateLessons, enrollStudent } from '../modules/groups/group.service.js'
import { runWithScope } from '../middleware/branch-scope.js'
import { logger } from '../config/logger.js'

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
  const staff: Record<string, Types.ObjectId> = {}
  for (const [role, phone, name] of [
    ['admin', '+998900000101', 'Admin Adminov'],
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
      'Demo data seeded. Staff logins: +998900000101 admin, ...102 manager, ...103/104 teacher. ' +
        'Student logins: +998901000000, ...0001, ...0002.',
    )

    return {
      created: true,
      note: `${groups.length} groups, ${STUDENT_NAMES.length} students, password ${DEMO_PASSWORD}`,
    }
  })
}

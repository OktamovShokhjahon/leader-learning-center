/**
 * TZ §9 (students, groups, schedule) and §10 (attendance).
 *
 * These are the spine of the CRM: everything downstream — invoices, payroll,
 * exams — references a student, a group or a lesson.
 */
import { z } from 'zod'
import { objectIdSchema, paginationSchema, slugSchema, localizedSchema } from './common.js'
import { phoneSchema } from './lead.js'

/* ── Students ──────────────────────────────────────────────────────────── */

/**
 * §9.1 — mapped from the workbook's `Status` column. `frozen` generates no
 * invoices; `dropped` requires a reason so the churn report has something to
 * group by.
 */
export const STUDENT_STATUSES = [
  'active',
  'pending',
  'overdue',
  'paid',
  'completed',
  'frozen',
  'dropped',
] as const
export type StudentStatus = (typeof STUDENT_STATUSES)[number]

/** §9.1 — the dropdown behind `dropped`, so churn can be counted by cause. */
export const DROP_REASONS = ['price', 'moved_away', 'dissatisfied', 'other'] as const
export type DropReason = (typeof DROP_REASONS)[number]

export const GENDERS = ['male', 'female'] as const

export const createStudentSchema = z.object({
  fullName: z.string().trim().min(3, 'nameTooShort').max(120, 'nameTooLong'),
  phone: phoneSchema.optional(),
  birthDate: z.coerce.date().optional(),
  gender: z.enum(GENDERS).optional(),
  /** The workbook keeps either a school class or a bare age (§9.1). */
  schoolClass: z.string().trim().max(20).optional(),
  age: z.coerce.number().int().min(4).max(80).optional(),
  address: z.string().trim().max(200).optional(),
  parentName: z.string().trim().max(120).optional(),
  /** Required for a minor — §8 calls parent contact a legal necessity. */
  parentPhone: phoneSchema.optional(),
  telegramId: z.string().trim().max(60).optional(),
  level: z.string().trim().max(40).optional(),
  /** §9.1 `Chek` — whole so'm, never a float (§26.4). */
  monthlyFee: z.coerce.number().int().min(0).optional(),
  discountPercent: z.coerce.number().int().min(0).max(100).default(0),
  joinedAt: z.coerce.date().optional(),
  source: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
})
export type CreateStudentInput = z.input<typeof createStudentSchema>

export const updateStudentSchema = createStudentSchema.partial().extend({
  status: z.enum(STUDENT_STATUSES).optional(),
  dropReason: z.enum(DROP_REASONS).optional(),
})

export const studentQuerySchema = paginationSchema.extend({
  status: z.enum(STUDENT_STATUSES).optional(),
  groupId: objectIdSchema.optional(),
  /** §11.3 — the qarzdor filter, reused by the debtor page. */
  onlyDebtors: z.coerce.boolean().optional(),
})

/* ── Courses ───────────────────────────────────────────────────────────── */

export const createCourseSchema = z.object({
  name: localizedSchema,
  slug: slugSchema,
  description: localizedSchema.partial().optional(),
  level: z.string().trim().max(40).optional(),
  durationMonths: z.coerce.number().int().min(1).max(36).default(8),
  /** Default only — the real price lives on the group, per branch (§5.3). */
  defaultPrice: z.coerce.number().int().min(0).default(0),
  isPublic: z.boolean().default(true),
  order: z.coerce.number().int().default(0),
})
export const updateCourseSchema = createCourseSchema.partial()

/**
 * §9.1 / A4 — `POST /students/:id/freeze { fromDate, toDate, amount, reason }`.
 * `toDate` in the future is the "auto-unfreeze on end date" contract; a nightly
 * sweep (alongside `recalculateOverdue`) flips the student back to `active`
 * once `toDate` has passed.
 */
export const freezeStudentSchema = z
  .object({
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    amount: z.coerce.number().int().min(0).optional(),
    reason: z.string().trim().min(3, 'required').max(300),
  })
  .refine((value) => value.toDate > value.fromDate, {
    message: 'toDateBeforeFromDate',
    path: ['toDate'],
  })
export type FreezeStudentInput = z.infer<typeof freezeStudentSchema>

/** §23 — `POST /students/:id/transfer { toBranchId | toGroupId }`. */
export const transferSchema = z
  .object({
    toBranchId: objectIdSchema.optional(),
    toGroupId: objectIdSchema.optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.toBranchId || value.toGroupId, {
    message: 'transferTargetRequired',
    path: ['toBranchId'],
  })
export type TransferInput = z.infer<typeof transferSchema>

export const courseQuerySchema = paginationSchema.extend({
  isPublic: z.coerce.boolean().optional(),
})

/* ── Rooms (§9.3 — the schedule grid's other axis) ─────────────────────── */

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, 'required').max(60),
  capacity: z.coerce.number().int().min(1).max(200).default(12),
  equipment: z.array(z.string().trim().max(40)).max(20).default([]),
  /**
   * Which branch the room is in.
   *
   * Normally omitted — the branch-scope plugin stamps the active branch and a
   * room belongs to exactly one building. It is spelled out when the boss adds
   * rooms from the branches screen, where the session sits in the consolidated
   * `'ALL'` scope and there is no active branch to stamp. Only a SuperAdmin may
   * name a branch other than their own; the route enforces that.
   */
  branchId: objectIdSchema.optional(),
})
export const updateRoomSchema = createRoomSchema.partial()
export type CreateRoomInput = z.infer<typeof createRoomSchema>

/* ── Groups ────────────────────────────────────────────────────────────── */

/** §9.2 — matches the workbook's `Kun` column. */
export const SCHEDULE_PATTERNS_GROUP = ['har_kun', 'toq', 'juft', 'custom'] as const
/**
 * §9.2 — "Group archive keeps all history; archived groups are excluded from all
 * default views." Archiving is therefore a status, not a delete: the lessons,
 * attendance and invoices that point at the group all stay valid.
 */
export const GROUP_STATUSES = ['planned', 'active', 'finished', 'archived'] as const

/** `HH:mm`, 24-hour. */
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'invalidTime')

export const createGroupSchema = z
  .object({
    courseId: objectIdSchema,
    name: z.string().trim().min(2, 'nameTooShort').max(80),
    teacherId: objectIdSchema,
    assistantTeacherId: objectIdSchema.optional(),
    roomId: objectIdSchema.optional(),
    pattern: z.enum(SCHEDULE_PATTERNS_GROUP).default('juft'),
    /** ISO weekday numbers, 1 = Monday. Required when `pattern` is custom. */
    days: z.array(z.coerce.number().int().min(1).max(7)).min(1, 'required'),
    startTime: timeSchema,
    endTime: timeSchema,
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    capacity: z.coerce.number().int().min(1).max(40).default(12),
    /** Whole so'm. A Manager may create a group but not price it (§4.2 note 1). */
    price: z.coerce.number().int().min(0).optional(),
    /** §14.1 — the `Статистика` sheet uses 0.6. */
    teacherShare: z.coerce.number().min(0).max(1).default(0.6),
    status: z.enum(GROUP_STATUSES).default('planned'),
  })
  .refine((group) => group.endTime > group.startTime, {
    message: 'endBeforeStart',
    path: ['endTime'],
  })

export const updateGroupSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  teacherId: objectIdSchema.optional(),
  assistantTeacherId: objectIdSchema.nullable().optional(),
  roomId: objectIdSchema.nullable().optional(),
  pattern: z.enum(SCHEDULE_PATTERNS_GROUP).optional(),
  days: z.array(z.coerce.number().int().min(1).max(7)).min(1).optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  endDate: z.coerce.date().nullable().optional(),
  capacity: z.coerce.number().int().min(1).max(40).optional(),
  price: z.coerce.number().int().min(0).optional(),
  teacherShare: z.coerce.number().min(0).max(1).optional(),
  status: z.enum(GROUP_STATUSES).optional(),
})

export const groupQuerySchema = paginationSchema.extend({
  status: z.enum(GROUP_STATUSES).optional(),
  teacherId: objectIdSchema.optional(),
  courseId: objectIdSchema.optional(),
})

export const enrollSchema = z.object({
  studentId: objectIdSchema,
  /** Overrides the group price for this student; the fee still lands on the invoice. */
  price: z.coerce.number().int().min(0).optional(),
  discountPercent: z.coerce.number().int().min(0).max(100).optional(),
  startDate: z.coerce.date().optional(),
})

/* ── Attendance ────────────────────────────────────────────────────────── */

/** §10.1 — one tap cycles present → absent → late → excused. */
export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const markAttendanceSchema = z.object({
  lessonId: objectIdSchema,
  entries: z
    .array(
      z.object({
        studentId: objectIdSchema,
        status: z.enum(ATTENDANCE_STATUSES),
        reason: z.string().trim().max(200).optional(),
        parentInformed: z.boolean().optional(),
      }),
    )
    .min(1, 'required')
    .max(60),
})
export type MarkAttendanceInput = z.input<typeof markAttendanceSchema>

export const attendanceQuerySchema = z.object({
  groupId: objectIdSchema.optional(),
  studentId: objectIdSchema.optional(),
  lessonId: objectIdSchema.optional(),
  teacherId: objectIdSchema.optional(),
  /** B1 — `from`/`to` filter on the lesson's own date, not when it was marked. */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

/** B1/H1 — the shared attendance-rate aggregation, per student or per group. */
export const attendanceRateQuerySchema = z.object({
  groupId: objectIdSchema.optional(),
  studentId: objectIdSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

export const cancelLessonSchema = z.object({
  /** §10.1 — a cancelled lesson does not consume a paid month, so the reason matters. */
  reason: z.string().trim().min(3, 'required').max(200),
})

export const scheduleQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  teacherId: objectIdSchema.optional(),
  roomId: objectIdSchema.optional(),
  groupId: objectIdSchema.optional(),
})

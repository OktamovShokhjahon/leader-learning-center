import { Router } from 'express'
import { Types } from 'mongoose'
import {
  createGroupSchema,
  updateGroupSchema,
  groupQuerySchema,
  enrollSchema,
  markAttendanceSchema,
  attendanceQuerySchema,
  attendanceRateQuerySchema,
  cancelLessonSchema,
  scheduleQuerySchema,
  parseSort,
} from '@leader/shared/schemas'
import { ApiError } from '@leader/shared/errors'
import { DEFAULT_LIMITS, can } from '@leader/shared/permissions'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import {
  requireAuth,
  requirePermission,
  requireFullGrant,
  writeGuards,
  currentUser,
} from '../../middleware/auth.js'
import { allowSelfOr } from '../../middleware/self-access.js'
import { recordAudit } from '../audit/audit.service.js'
import { Group, Lesson, Enrollment, Attendance, Course } from './group.model.js'
import { Student } from '../students/student.model.js'
import { Invoice } from '../payments/invoice.model.js'
import { findScheduleConflicts, generateLessons, enrollStudent } from './group.service.js'

/** TZ §23 — `GROUPS & SCHEDULE` and `ATTENDANCE`. */
export const groupRouter = Router()

groupRouter.use(requireAuth)

/**
 * A teacher may only see and mark their own groups (§4.2). Rather than trusting
 * each handler to remember, this narrows the filter once.
 */
function ownGroupsFilter(req: Express.Request): Record<string, unknown> {
  const user = currentUser(req)
  const roles = user.roles.map((assignment) => assignment.role)
  const isTeacherOnly = roles.every((role) => role === 'teacher')
  return isTeacherOnly ? { teacherId: user._id } : {}
}

groupRouter.get(
  '/',
  validateQuery(groupQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as {
      page: number
      limit: number
      sort: string
      search?: string
      status?: string
      teacherId?: string
      courseId?: string
    }

    const filter: Record<string, unknown> = { deletedAt: null, ...ownGroupsFilter(req) }
    if (query.status) filter.status = query.status
    if (query.teacherId) filter.teacherId = query.teacherId
    if (query.courseId) filter.courseId = query.courseId
    if (query.search) filter.name = { $regex: query.search, $options: 'i' }

    const [groups, total] = await Promise.all([
      Group.find(filter)
        .sort(parseSort(query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate('courseId', 'name slug')
        .populate('teacherId', 'fullName')
        .lean(),
      Group.countDocuments(filter),
    ])

    // Enrolled counts, so the list shows fill rate without an N+1.
    const counts = await Enrollment.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { groupId: { $in: groups.map((group) => group._id) }, status: 'active' } },
      { $group: { _id: '$groupId', count: { $sum: 1 } } },
    ])
    const enrolledBy = new Map(counts.map((row) => [row._id.toString(), row.count]))

    res.json({
      data: {
        items: groups.map((group) => ({
          ...group,
          enrolled: enrolledBy.get(group._id.toString()) ?? 0,
        })),
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    })
  }),
)

groupRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const group = await Group.findOne({
      _id: req.params.id,
      deletedAt: null,
      ...ownGroupsFilter(req),
    })
      .populate('courseId', 'name slug')
      .populate('teacherId', 'fullName phone')
      .lean()
    if (!group) throw ApiError.notFound('Group not found')

    const enrollments = await Enrollment.find({ groupId: group._id, status: 'active' })
      .populate('studentId', 'fullName phone status balance')
      .lean()

    res.json({ data: { ...group, students: enrollments } })
  }),
)

groupRouter.post(
  '/',
  // §5.1 — see the note on `POST /students`: a group created in the `'ALL'`
  // scope would carry no branch and appear in none of them.
  ...writeGuards('group.manage'),
  validateBody(createGroupSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)

    // §4.2 note 1 ("Manager may create a group but cannot set its price") was
    // lifted with the Admin role — a Manager assembles the group, so they price
    // it too. `group.manage` is now a full grant for everyone who holds it, and
    // the route guard above is the whole check (ADR 0004).

    // §9.3 — block the save and name the conflict.
    const conflicts = await findScheduleConflicts({
      teacherId: req.body.teacherId,
      roomId: req.body.roomId,
      days: req.body.days,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
    })
    if (conflicts.length > 0) {
      throw new ApiError(409, 'SCHEDULE_CONFLICT', 'That slot is already taken', { conflicts })
    }

    const group = await Group.create({
      courseId: req.body.courseId,
      name: req.body.name,
      teacherId: req.body.teacherId,
      assistantTeacherId: req.body.assistantTeacherId,
      roomId: req.body.roomId,
      schedule: {
        pattern: req.body.pattern,
        days: req.body.days,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
      },
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      capacity: req.body.capacity,
      price: req.body.price ?? 0,
      teacherShare: req.body.teacherShare ?? DEFAULT_LIMITS.teacherShare,
      status: req.body.status,
      createdBy: actor._id,
    })

    const lessons = await generateLessons(group)

    await recordAudit({
      action: 'group.create',
      entity: 'Group',
      entityId: group.id,
      actorId: actor._id,
      after: { name: group.name, lessons },
      req,
    })

    res.status(201).json({ data: { group, lessonsCreated: lessons } })
  }),
)

groupRouter.patch(
  '/:id',
  requirePermission('group.manage'),
  validateBody(updateGroupSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const group = await Group.findOne({ _id: req.params.id, deletedAt: null })
    if (!group) throw ApiError.notFound('Group not found')


    // Re-check the slot whenever timing, teacher or room moves.
    const touchesSlot =
      req.body.teacherId || req.body.roomId !== undefined || req.body.days || req.body.startTime
    if (touchesSlot) {
      const conflicts = await findScheduleConflicts({
        teacherId: req.body.teacherId ?? group.teacherId.toString(),
        roomId: req.body.roomId ?? group.roomId?.toString(),
        days: req.body.days ?? group.schedule?.days ?? [],
        startTime: req.body.startTime ?? group.schedule?.startTime ?? '00:00',
        endTime: req.body.endTime ?? group.schedule?.endTime ?? '23:59',
        excludeGroupId: group.id,
      })
      if (conflicts.length > 0) {
        throw new ApiError(409, 'SCHEDULE_CONFLICT', 'That slot is already taken', { conflicts })
      }
    }

    const { pattern, days, startTime, endTime, ...rest } = req.body
    Object.assign(group, rest, { updatedBy: actor._id })
    if (group.schedule) {
      if (pattern) group.schedule.pattern = pattern
      if (days) group.schedule.days = days
      if (startTime) group.schedule.startTime = startTime
      if (endTime) group.schedule.endTime = endTime
    }
    await group.save()

    await recordAudit({
      action: 'group.update',
      entity: 'Group',
      entityId: group.id,
      actorId: actor._id,
      req,
    })
    res.json({ data: group })
  }),
)

groupRouter.post(
  '/:id/students',
  requirePermission('student.manage'),
  validateBody(enrollSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const enrollment = await enrollStudent(String(req.params.id), req.body, actor.id)
    await recordAudit({
      action: 'group.enroll',
      entity: 'Enrollment',
      entityId: enrollment.id,
      actorId: actor._id,
      after: { groupId: req.params.id, studentId: req.body.studentId },
      req,
    })
    res.status(201).json({ data: enrollment })
  }),
)

/**
 * §9.2 — "Group archive keeps all history; archived groups are excluded from all
 * default views."
 *
 * So this is a status change, not a delete. Lessons, attendance rows, invoices
 * and payroll lines all point at the group, and removing the document would turn
 * every one of them into a dangling id. Future lessons are cancelled, because a
 * timetable slot held by an archived group would block the room forever.
 */
groupRouter.delete(
  '/:id',
  requirePermission('group.manage'),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const group = await Group.findOne({ _id: req.params.id, deletedAt: null })
    if (!group) throw ApiError.notFound('Group not found')

    const active = await Enrollment.countDocuments({ groupId: group._id, status: 'active' })
    if (active > 0) {
      throw ApiError.conflict(`${active} student(s) are still enrolled — move them first`, {
        enrolled: active,
      })
    }

    const before = group.status
    group.status = 'archived'
    group.updatedBy = actor._id
    await group.save()

    // Only lessons that have not happened yet — a past lesson is a record.
    const cancelled = await Lesson.updateMany(
      { groupId: group._id, date: { $gte: new Date() }, status: { $ne: 'cancelled' } },
      { $set: { status: 'cancelled', cancelReason: 'group_archived' } },
    )

    await recordAudit({
      action: 'group.archive',
      entity: 'Group',
      entityId: group.id,
      actorId: actor._id,
      before: { status: before },
      after: { status: group.status, lessonsCancelled: cancelled.modifiedCount },
      req,
    })

    res.json({ data: { archived: true, lessonsCancelled: cancelled.modifiedCount } })
  }),
)

groupRouter.delete(
  '/:id/students/:studentId',
  requirePermission('student.manage'),
  asyncRoute(async (req, res) => {
    const enrollment = await Enrollment.findOne({
      groupId: req.params.id,
      studentId: req.params.studentId,
      status: 'active',
    })
    if (!enrollment) throw ApiError.notFound('Enrolment not found')

    enrollment.status = 'dropped'
    enrollment.endDate = new Date()
    await enrollment.save()

    await recordAudit({
      action: 'group.unenroll',
      entity: 'Enrollment',
      entityId: enrollment.id,
      actorId: currentUser(req)._id,
      req,
    })
    res.json({ data: { ok: true } })
  }),
)

/* ── Schedule and attendance ───────────────────────────────────────────── */

groupRouter.get(
  '/schedule/lessons',
  validateQuery(scheduleQuerySchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as {
      from: Date
      to: Date
      teacherId?: string
      roomId?: string
      groupId?: string
    }

    const filter: Record<string, unknown> = {
      date: { $gte: query.from, $lte: query.to },
      deletedAt: null,
    }
    if (query.groupId) filter.groupId = query.groupId
    if (query.roomId) filter.roomId = query.roomId

    const own = ownGroupsFilter(req)
    if (own.teacherId) filter.teacherId = own.teacherId
    else if (query.teacherId) filter.teacherId = query.teacherId

    const lessons = await Lesson.find(filter)
      .sort({ date: 1 })
      .limit(500)
      .populate('groupId', 'name')
      .populate('teacherId', 'fullName')
      .populate('roomId', 'name')
      .lean()

    res.json({ data: lessons })
  }),
)

/**
 * §10.1 — "Open group → today's lesson is at the top → one tap per student."
 * Returns the roster already merged with whatever is marked, so the client
 * renders the grid from one response.
 */
groupRouter.get(
  '/:id/roster',
  requirePermission('attendance.mark'),
  asyncRoute(async (req, res) => {
    const group = await Group.findOne({
      _id: req.params.id,
      deletedAt: null,
      ...ownGroupsFilter(req),
    }).lean()
    if (!group) throw ApiError.notFound('Group not found')

    const date = req.query.date ? new Date(String(req.query.date)) : new Date()
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    )
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

    const lesson = await Lesson.findOne({
      groupId: group._id,
      date: { $gte: dayStart, $lte: dayEnd },
      deletedAt: null,
    }).lean()

    const enrollments = await Enrollment.find({ groupId: group._id, status: 'active' })
      .populate('studentId', 'fullName phone photo status')
      .lean()

    const marked = lesson
      ? await Attendance.find({ lessonId: lesson._id }).lean()
      : []
    const markBy = new Map(marked.map((row) => [row.studentId.toString(), row]))

    const studentIds = enrollments.map(
      (e) => (e.studentId as unknown as { _id: Types.ObjectId })._id,
    )
    const now = new Date()
    const overdueInvoices = await Invoice.find({
      studentId: { $in: studentIds },
      status: { $in: ['pending', 'partial', 'overdue'] },
      deletedAt: null,
      $expr: { $lt: ['$paidAmount', '$finalAmount'] },
    }).lean()

    const debtorMap = new Map<string, { debt: number; daysOverdue: number; hasDebt: boolean }>()
    for (const inv of overdueInvoices) {
      const sId = inv.studentId.toString()
      const current = debtorMap.get(sId) ?? { debt: 0, daysOverdue: 0, hasDebt: false }
      const remaining = Math.max(0, inv.finalAmount - inv.paidAmount)
      current.debt += remaining
      if (inv.dueDate && new Date(inv.dueDate) < now) {
        current.hasDebt = true
        const days = Math.max(
          0,
          Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
        )
        if (days > current.daysOverdue) current.daysOverdue = days
      } else if (remaining > 0) {
        current.hasDebt = true
      }
      debtorMap.set(sId, current)
    }

    const actor = currentUser(req)
    const isFullDebtorViewer = actor.roles.some((r) => r.role === 'superadmin' || r.role === 'manager')

    res.json({
      data: {
        group: { id: group._id, name: group.name },
        lesson,
        students: enrollments.map((enrollment) => {
          const student = enrollment.studentId as unknown as {
            _id: Types.ObjectId
            fullName: string
            phone?: string
            status: string
          }
          const row = markBy.get(student._id.toString())
          const debtInfo = debtorMap.get(student._id.toString())
          return {
            studentId: student._id,
            fullName: student.fullName,
            phone: student.phone,
            // §10.1 — the default state is present, so a full lesson is one tap.
            status: row?.status ?? 'present',
            reason: row?.reason,
            marked: Boolean(row),
            hasDebt: Boolean(debtInfo?.hasDebt),
            daysOverdue: debtInfo?.daysOverdue ?? 0,
            debt: isFullDebtorViewer ? debtInfo?.debt : undefined,
          }
        }),
      },
    })
  }),
)

/** §10.1 — bulk mark. One request per lesson, not one per student. */
groupRouter.post(
  '/attendance',
  requirePermission('attendance.mark'),
  validateBody(markAttendanceSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const lesson = await Lesson.findOne({ _id: req.body.lessonId, deletedAt: null })
    if (!lesson) throw ApiError.notFound('Lesson not found')
    if (lesson.status === 'cancelled') {
      throw ApiError.badRequest('That lesson was cancelled')
    }

    // §10.1 — marking closes 48 h after the lesson; later edits need Admin.
    const ageHours = (Date.now() - lesson.date.getTime()) / (1000 * 60 * 60)
    const windowHours = DEFAULT_LIMITS.attendanceEditWindowHours
    if (ageHours > windowHours) {
      if (!can(req.role!, 'attendance.editAfter48h')) {
        throw ApiError.forbidden(
          `Attendance closed ${windowHours} h after the lesson. Ask an administrator.`,
        )
      }
    }

    const isLate = ageHours > windowHours
    const operations = req.body.entries.map(
      (entry: { studentId: string; status: string; reason?: string; parentInformed?: boolean }) => ({
        updateOne: {
          filter: { lessonId: lesson._id, studentId: new Types.ObjectId(entry.studentId) },
          update: {
            $set: {
              branchId: lesson.branchId,
              groupId: lesson.groupId,
              status: entry.status,
              reason: entry.reason,
              parentInformed: entry.parentInformed ?? false,
              ...(isLate
                ? { editedBy: actor._id, editedAt: new Date() }
                : { markedBy: actor._id, markedAt: new Date() }),
            },
          },
          upsert: true,
        },
      }),
    )

    await Attendance.bulkWrite(operations)

    if (lesson.status === 'planned') {
      lesson.status = 'held'
      await lesson.save()
    }

    // §21.3 — an attendance edit after 48 h is on the mandatory audit list.
    if (isLate) {
      await recordAudit({
        action: 'attendance.editAfter48h',
        entity: 'Lesson',
        entityId: lesson.id,
        actorId: actor._id,
        after: { entries: req.body.entries.length },
        req,
      })
    }

    res.json({ data: { marked: req.body.entries.length, lessonId: lesson.id } })
  }),
)

/**
 * B1 — resolve which lessons a `from`/`to`/`teacherId` filter actually means,
 * since `Attendance` rows only carry `groupId`/`lessonId`, not a lesson date
 * or teacher of their own.
 */
async function matchingLessonIds(query: {
  groupId?: string
  teacherId?: string
  from?: Date
  to?: Date
}): Promise<Types.ObjectId[] | null> {
  if (!query.from && !query.to && !query.teacherId) return null

  const lessonFilter: Record<string, unknown> = { deletedAt: null }
  if (query.groupId) lessonFilter.groupId = query.groupId
  if (query.from || query.to) {
    lessonFilter.date = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    }
  }
  if (query.teacherId) {
    const teacherGroupIds = await Group.find({ teacherId: query.teacherId }).distinct('_id')
    lessonFilter.groupId = query.groupId
      ? query.groupId
      : { $in: teacherGroupIds }
  }

  return Lesson.find(lessonFilter).distinct('_id')
}

groupRouter.get(
  '/attendance/history',
  validateQuery(attendanceQuerySchema),
  // Without this any signed-in account could read another student's attendance
  // by changing ?studentId. Staff who mark attendance keep full access (§4.2).
  allowSelfOr("attendance.mark", (req) => req.query.studentId?.toString()),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as {
      groupId?: string
      studentId?: string
      teacherId?: string
      from?: Date
      to?: Date
    }
    const filter: Record<string, unknown> = {}
    if (query.studentId) filter.studentId = query.studentId

    // B1 — the date range and teacher filters describe the lesson, not when it
    // happened to be marked (`markedAt` is unset entirely for a late edit —
    // see the write path above, which sets `editedAt` instead in that case).
    const lessonIds = await matchingLessonIds(query)
    if (lessonIds) {
      filter.lessonId = { $in: lessonIds }
    } else if (query.groupId) {
      filter.groupId = query.groupId
    }

    const rows = await Attendance.find(filter)
      .sort({ createdAt: -1 })
      .limit(3000)
      .populate('lessonId', 'date status')
      .lean()

    res.json({ data: rows })
  }),
)

/**
 * B1/H1 — attendance %, computed once here so the teacher grid, the group
 * report and the student dashboard all read the same number instead of each
 * recomputing it (a late-edit's `absent` still counts once, not per screen).
 */
groupRouter.get(
  '/attendance/rate',
  validateQuery(attendanceRateQuerySchema),
  allowSelfOr('attendance.mark', (req) => req.query.studentId?.toString()),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as {
      groupId?: string
      studentId?: string
      from?: Date
      to?: Date
    }

    const lessonIds = await matchingLessonIds(query)
    const filter: Record<string, unknown> = {}
    if (query.studentId) filter.studentId = query.studentId
    if (lessonIds) filter.lessonId = { $in: lessonIds }
    else if (query.groupId) filter.groupId = query.groupId

    const rows = await Attendance.find(filter).select('studentId status').lean()

    const byStudent = new Map<string, { present: number; absent: number; late: number; excused: number }>()
    for (const row of rows) {
      const sid = row.studentId.toString()
      const bucket = byStudent.get(sid) ?? { present: 0, absent: 0, late: 0, excused: 0 }
      bucket[row.status as 'present' | 'absent' | 'late' | 'excused'] += 1
      byStudent.set(sid, bucket)
    }

    // §10.1 — "davomat %": present + late + excused count toward it, only a
    // flat absence does not. Matches the counting rule already used client-side
    // in the student cabinet before this endpoint existed.
    const rateOf = (bucket: { present: number; absent: number; late: number; excused: number }) => {
      const total = bucket.present + bucket.absent + bucket.late + bucket.excused
      return total === 0 ? null : Math.round(((total - bucket.absent) / total) * 100)
    }

    if (query.studentId) {
      const bucket = byStudent.get(query.studentId) ?? { present: 0, absent: 0, late: 0, excused: 0 }
      res.json({ data: { ...bucket, total: bucket.present + bucket.absent + bucket.late + bucket.excused, rate: rateOf(bucket) } })
      return
    }

    res.json({
      data: {
        byStudent: [...byStudent.entries()].map(([studentId, bucket]) => ({
          studentId,
          ...bucket,
          total: bucket.present + bucket.absent + bucket.late + bucket.excused,
          rate: rateOf(bucket),
        })),
      },
    })
  }),
)

/** §10.1 — a cancelled lesson does not consume a paid month, so it needs a reason. */
groupRouter.post(
  '/lessons/:id/cancel',
  requireFullGrant('attendance.mark'),
  validateBody(cancelLessonSchema),
  asyncRoute(async (req, res) => {
    const lesson = await Lesson.findOne({ _id: req.params.id, deletedAt: null })
    if (!lesson) throw ApiError.notFound('Lesson not found')

    lesson.status = 'cancelled'
    lesson.cancelReason = req.body.reason
    await lesson.save()

    await recordAudit({
      action: 'lesson.cancel',
      entity: 'Lesson',
      entityId: lesson.id,
      actorId: currentUser(req)._id,
      after: { reason: req.body.reason },
      req,
    })
    res.json({ data: lesson })
  }),
)

/* ── Courses ───────────────────────────────────────────────────────────── */

groupRouter.get(
  '/catalog/courses',
  asyncRoute(async (_req, res) => {
    res.json({ data: await Course.find({ deletedAt: null }).sort({ order: 1 }).lean() })
  }),
)

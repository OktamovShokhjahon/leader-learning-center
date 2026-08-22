import { Types } from 'mongoose'
import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import { Group, Lesson, Enrollment, type GroupDocument } from './group.model.js'
import { Student } from '../students/student.model.js'
import { logger } from '../../config/logger.js'

/**
 * TZ §9.3 — lesson generation and conflict detection.
 *
 * "Creating a group generates Lesson documents for the whole period, which
 * attendance and teacher payroll attach to."
 */

/** ISO weekday, 1 = Monday … 7 = Sunday. */
function isoWeekday(date: Date): number {
  const day = date.getUTCDay()
  return day === 0 ? 7 : day
}

/**
 * §9.2 — the workbook's `Kun` column.
 *   har_kun — Monday to Saturday (Sunday is not a teaching day here)
 *   toq     — odd days: Mon, Wed, Fri
 *   juft    — even days: Tue, Thu, Sat
 */
export function weekdaysFor(pattern: string, custom: number[]): number[] {
  switch (pattern) {
    case 'har_kun':
      return [1, 2, 3, 4, 5, 6]
    case 'toq':
      return [1, 3, 5]
    case 'juft':
      return [2, 4, 6]
    default:
      return custom.length > 0 ? [...new Set(custom)].sort() : [2, 4, 6]
  }
}

/**
 * §9.3 — "Public holidays calendar of Uzbekistan pre-loaded; lessons on holidays
 * are auto-skipped (and therefore not billed) unless the admin overrides."
 *
 * Fixed-date national holidays. Ramadan and Qurbon Hayit move with the lunar
 * calendar and are added per year by the admin — a hard-coded guess would
 * silently cancel the wrong lessons.
 */
const FIXED_HOLIDAYS = ['01-01', '03-08', '03-21', '05-09', '09-01', '10-01', '12-08']

export function isHoliday(date: Date): boolean {
  const key = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  return FIXED_HOLIDAYS.includes(key)
}

/** Caps generation so a group with no end date cannot write an unbounded collection. */
const MAX_LESSONS = 400

export function planLessonDates(
  startDate: Date,
  endDate: Date | null | undefined,
  pattern: string,
  customDays: number[],
): Date[] {
  const weekdays = new Set(weekdaysFor(pattern, customDays))
  const dates: Date[] = []

  const cursor = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()),
  )
  // No end date means "run for a year", which the admin can extend.
  const last = endDate
    ? new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()))
    : new Date(cursor.getTime() + 365 * 24 * 60 * 60 * 1000)

  while (cursor <= last && dates.length < MAX_LESSONS) {
    if (weekdays.has(isoWeekday(cursor)) && !isHoliday(cursor)) {
      dates.push(new Date(cursor))
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

export type Conflict = { kind: 'teacher' | 'room'; groupId: string; groupName: string }

/**
 * §9.3 — "the system blocks the save and names the conflict".
 *
 * Two groups collide when they share a weekday and their time ranges overlap.
 * Naming the offending group is the whole point: "room busy" is not actionable,
 * "Room 2 is taken by IELTS-A2 on Tue/Thu 14:00–15:30" is.
 */
export async function findScheduleConflicts(input: {
  teacherId: string
  roomId?: string | null
  days: number[]
  startTime: string
  endTime: string
  excludeGroupId?: string
}): Promise<Conflict[]> {
  const candidates = await Group.find({
    status: { $ne: 'finished' },
    deletedAt: null,
    ...(input.excludeGroupId ? { _id: { $ne: new Types.ObjectId(input.excludeGroupId) } } : {}),
    $or: [
      { teacherId: new Types.ObjectId(input.teacherId) },
      ...(input.roomId ? [{ roomId: new Types.ObjectId(input.roomId) }] : []),
    ],
  })
    .select('name teacherId roomId schedule')
    .lean()

  const wanted = new Set(input.days)
  const conflicts: Conflict[] = []

  for (const other of candidates) {
    const otherDays: number[] = other.schedule?.days ?? []
    const sharesDay = otherDays.some((day) => wanted.has(day))
    if (!sharesDay) continue

    // Half-open overlap: 14:00–15:30 and 15:30–17:00 do not collide.
    const overlaps =
      input.startTime < (other.schedule?.endTime ?? '') &&
      (other.schedule?.startTime ?? '') < input.endTime
    if (!overlaps) continue

    if (other.teacherId?.toString() === input.teacherId) {
      conflicts.push({ kind: 'teacher', groupId: other._id.toString(), groupName: other.name })
    } else if (input.roomId && other.roomId?.toString() === input.roomId) {
      conflicts.push({ kind: 'room', groupId: other._id.toString(), groupName: other.name })
    }
  }

  return conflicts
}

/** Writes the whole planned period for a group. Idempotent per (group, date). */
export async function generateLessons(group: GroupDocument): Promise<number> {
  const dates = planLessonDates(
    group.startDate,
    group.endDate,
    group.schedule?.pattern ?? 'juft',
    group.schedule?.days ?? [],
  )

  if (dates.length === 0) return 0

  const existing = await Lesson.find({ groupId: group._id }).select('date').lean()
  const seen = new Set(existing.map((lesson) => lesson.date.toISOString().slice(0, 10)))

  const fresh = dates
    .filter((date) => !seen.has(date.toISOString().slice(0, 10)))
    .map((date) => ({
      branchId: group.branchId,
      groupId: group._id,
      date,
      startTime: group.schedule?.startTime,
      endTime: group.schedule?.endTime,
      teacherId: group.teacherId,
      roomId: group.roomId,
      status: 'planned' as const,
    }))

  if (fresh.length === 0) return 0
  await Lesson.insertMany(fresh)
  logger.info({ groupId: group._id.toString(), created: fresh.length }, 'lessons generated')
  return fresh.length
}

/** §9.2 — capacity warning; the waiting list is a later phase. */
export async function enrollStudent(
  groupId: string,
  input: { studentId: string; price?: number; discountPercent?: number; startDate?: Date },
  actorId?: string,
) {
  const group = await Group.findById(groupId)
  if (!group) throw ApiError.notFound('Group not found')

  const student = await Student.findById(input.studentId)
  if (!student) throw ApiError.notFound('Student not found')

  const active = await Enrollment.countDocuments({ groupId: group._id, status: 'active' })
  if (active >= group.capacity) {
    throw new ApiError(
      409,
      'GROUP_FULL',
      `${group.name} is full (${active}/${group.capacity})`,
      { capacity: group.capacity, enrolled: active },
    )
  }

  const duplicate = await Enrollment.findOne({
    groupId: group._id,
    studentId: student._id,
    status: 'active',
  })
  if (duplicate) throw new ApiError(409, ERROR_CODES.CONFLICT, 'Student is already in this group')

  const enrollment = await Enrollment.create({
    branchId: group.branchId,
    studentId: student._id,
    groupId: group._id,
    price: input.price ?? group.price ?? 0,
    discountPercent: input.discountPercent ?? student.discountPercent ?? 0,
    startDate: input.startDate ?? new Date(),
    createdBy: actorId,
  })

  // A student with a group is studying, not merely registered.
  if (student.status === 'pending') {
    student.status = 'active'
    await student.save()
  }

  return enrollment
}

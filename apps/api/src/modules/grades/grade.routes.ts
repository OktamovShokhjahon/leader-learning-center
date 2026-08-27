import { Router } from 'express'
import type { Request } from 'express'
import { Types } from 'mongoose'
import { markGradesSchema, gradeQuerySchema } from '@leader/shared/schemas'
import { ApiError } from '@leader/shared/errors'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requirePermission, currentUser } from '../../middleware/auth.js'
import { allowSelfOr } from '../../middleware/self-access.js'
import { recordAudit } from '../audit/audit.service.js'
import { Group, Lesson, Enrollment } from '../groups/group.model.js'
import { Grade } from './grade.model.js'

/**
 * C — Grading ("Baho"), distinct from the future themed-exam/ranking module
 * (§16). Mirrors the ATTENDANCE block's shape: a roster for one lesson, a
 * bulk mark endpoint, a history list, and a shared average so the teacher
 * grid, the student dashboard and any later statistics all read one number.
 */
export const gradeRouter = Router()

gradeRouter.use(requireAuth)

/** A teacher may only grade their own groups — same rule as attendance (§4.2). */
function ownGroupsFilter(req: Request): Record<string, unknown> {
  const user = currentUser(req)
  const roles = user.roles.map((assignment) => assignment.role)
  const isTeacherOnly = roles.every((role) => role === 'teacher')
  return isTeacherOnly ? { teacherId: user._id } : {}
}

/**
 * C1 — "clicking a date opens the grade-entry panel for that date." This is
 * that panel's data: the group's roster for one lesson, merged with whatever
 * is already graded, mirroring `GET /groups/:id/roster`.
 */
gradeRouter.get(
  '/roster',
  requirePermission('grade.manage'),
  asyncRoute(async (req, res) => {
    const groupId = String(req.query.groupId ?? '')
    if (!groupId) throw ApiError.badRequest('groupId is required')

    const group = await Group.findOne({
      _id: groupId,
      deletedAt: null,
      ...ownGroupsFilter(req),
    }).lean()
    if (!group) throw ApiError.notFound('Group not found')

    const date = req.query.date ? new Date(String(req.query.date)) : new Date()
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

    const lesson = await Lesson.findOne({
      groupId: group._id,
      date: { $gte: dayStart, $lte: dayEnd },
      deletedAt: null,
    }).lean()

    const enrollments = await Enrollment.find({ groupId: group._id, status: 'active' })
      .populate('studentId', 'fullName')
      .lean()

    const graded = lesson ? await Grade.find({ lessonId: lesson._id }).lean() : []
    const gradeBy = new Map(graded.map((row) => [row.studentId.toString(), row]))

    res.json({
      data: {
        group: { id: group._id, name: group.name },
        lesson,
        students: enrollments.map((enrollment) => {
          const student = enrollment.studentId as unknown as { _id: Types.ObjectId; fullName: string }
          const row = gradeBy.get(student._id.toString())
          return {
            studentId: student._id,
            fullName: student.fullName,
            value: row?.value ?? null,
            comment: row?.comment,
          }
        }),
      },
    })
  }),
)

/** C1 — bulk-save one lesson's grades in a single request. */
gradeRouter.post(
  '/',
  requirePermission('grade.manage'),
  validateBody(markGradesSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const lesson = await Lesson.findOne({ _id: req.body.lessonId, deletedAt: null })
    if (!lesson) throw ApiError.notFound('Lesson not found')

    const group = await Group.findOne({ _id: lesson.groupId, ...ownGroupsFilter(req) }).lean()
    if (!group) throw ApiError.forbidden('You may only grade your own groups')

    const operations = req.body.entries.map(
      (entry: { studentId: string; value: number; comment?: string }) => ({
        updateOne: {
          filter: { lessonId: lesson._id, studentId: new Types.ObjectId(entry.studentId) },
          update: {
            $set: {
              branchId: lesson.branchId,
              groupId: lesson.groupId,
              value: entry.value,
              comment: entry.comment,
              gradedBy: actor._id,
              gradedAt: new Date(),
            },
          },
          upsert: true,
        },
      }),
    )

    await Grade.bulkWrite(operations)

    res.json({ data: { graded: req.body.entries.length, lessonId: lesson.id } })
  }),
)

/** Flat grade history, filtered by the lesson's own date (not when it was entered). */
gradeRouter.get(
  '/history',
  validateQuery(gradeQuerySchema),
  allowSelfOr('grade.manage', (req) => req.query.studentId?.toString()),
  asyncRoute(async (req, res) => {
    const query = res.locals.query as {
      groupId?: string
      studentId?: string
      lessonId?: string
      from?: Date
      to?: Date
    }

    const filter: Record<string, unknown> = {}
    if (query.studentId) filter.studentId = query.studentId
    if (query.lessonId) filter.lessonId = query.lessonId

    if (query.groupId || query.from || query.to) {
      const lessonFilter: Record<string, unknown> = { deletedAt: null }
      if (query.groupId) lessonFilter.groupId = query.groupId
      if (query.from || query.to) {
        lessonFilter.date = {
          ...(query.from ? { $gte: query.from } : {}),
          ...(query.to ? { $lte: query.to } : {}),
        }
      }
      filter.lessonId = { $in: await Lesson.find(lessonFilter).distinct('_id') }
    }

    const rows = await Grade.find(filter)
      .sort({ createdAt: -1 })
      .limit(2000)
      .populate('lessonId', 'date')
      .populate({ path: 'groupId', select: 'name courseId', populate: { path: 'courseId', select: 'name' } })
      .lean()

    res.json({ data: rows })
  }),
)

/**
 * C2 — the student dashboard's average, computed once here so it matches
 * whatever a group report or statistics chart shows later (H1).
 */
gradeRouter.get(
  '/average',
  allowSelfOr('grade.manage', (req) => req.query.studentId?.toString()),
  asyncRoute(async (req, res) => {
    const studentId = String(req.query.studentId ?? '')
    if (!studentId) throw ApiError.badRequest('studentId is required')

    const rows = await Grade.find({ studentId }).select('groupId value').lean()
    if (rows.length === 0) {
      res.json({ data: { overall: null, byGroup: [] } })
      return
    }

    const groupIds = [...new Set(rows.map((row) => row.groupId.toString()))]
    const groups = await Group.find({ _id: { $in: groupIds } })
      .select('name courseId')
      .populate('courseId', 'name')
      .lean()
    const groupById = new Map(groups.map((group) => [group._id.toString(), group]))

    const sums = new Map<string, { total: number; count: number }>()
    for (const row of rows) {
      const gid = row.groupId.toString()
      const bucket = sums.get(gid) ?? { total: 0, count: 0 }
      bucket.total += row.value
      bucket.count += 1
      sums.set(gid, bucket)
    }

    const byGroup = [...sums.entries()].map(([groupId, bucket]) => ({
      groupId,
      groupName: groupById.get(groupId)?.name,
      courseName: (groupById.get(groupId)?.courseId as unknown as { name?: unknown })?.name,
      average: Math.round((bucket.total / bucket.count) * 10) / 10,
      count: bucket.count,
    }))

    const overall =
      Math.round((rows.reduce((sum, row) => sum + row.value, 0) / rows.length) * 10) / 10

    res.json({ data: { overall, byGroup } })
  }),
)

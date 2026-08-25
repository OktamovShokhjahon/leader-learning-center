import { Router } from 'express'
import {
  createTeacherProfileSchema,
  updateTeacherProfileSchema,
  teacherQuerySchema,
  createVideoLessonSchema,
  updateVideoLessonSchema,
  videoLessonQuerySchema,
  logWatchSchema,
  parseSort,
} from '@leader/shared/schemas'
import { ApiError } from '@leader/shared/errors'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js'
import { recordAudit, diff } from '../audit/audit.service.js'
import { TeacherProfile, VideoLesson, WatchLog } from './content.model.js'
import { Course, Enrollment, Group } from '../groups/group.model.js'
import { Student } from '../students/student.model.js'

/**
 * TZ §21.1 "Public site content" and §17.3 Video.
 *
 * Writing is `requireRole('superadmin')` at mount level, not a permission
 * check — the centre asked for both of these to be the boss's alone. §4.2 gives
 * a teacher `content.manage` as `limited`, for their own group's material
 * folder (note 7); that is a different door and is not this one.
 *
 * Reading a lesson is separate and open to the student it belongs to, so those
 * routes live on their own router below the guard.
 */
export const contentRouter = Router()

contentRouter.use(requireAuth)

/* ── Reading: the student's side (§17.4) ──────────────────────────────── */

/**
 * The courses this account may watch, resolved from their own enrolments.
 *
 * A student holds no `student.manage` grant, so they cannot list students to
 * find themselves — the same reason `SessionUser` carries `studentId`.
 */
async function watchableCourseIds(userId: unknown): Promise<string[]> {
  const student = await Student.findOne({ userId, deletedAt: null }).select('_id').lean()
  if (!student) return []

  const enrolments = await Enrollment.find({ studentId: student._id, status: 'active' })
    .select('groupId')
    .lean()
  if (enrolments.length === 0) return []

  const groups = await Group.find({ _id: { $in: enrolments.map((e) => e.groupId) } })
    .select('courseId')
    .lean()
  return groups.map((group) => group.courseId?.toString()).filter(Boolean) as string[]
}

contentRouter.get(
  '/lessons/mine',
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const courseIds = await watchableCourseIds(actor._id)

    // A free lesson is visible to anyone signed in; the rest need the course.
    const lessons = await VideoLesson.find({
      deletedAt: null,
      isPublished: true,
      $or: [{ isFree: true }, { courseId: { $in: courseIds } }],
    })
      .sort({ courseId: 1, order: 1 })
      .lean()

    const student = await Student.findOne({ userId: actor._id, deletedAt: null })
      .select('_id')
      .lean()
    const watched = student
      ? await WatchLog.find({ studentId: student._id }).lean()
      : []

    const courses = await Course.find({ _id: { $in: lessons.map((l) => l.courseId) } })
      .select('name slug')
      .lean()

    res.json({
      data: lessons.map((lesson) => {
        const log = watched.find((w) => w.lessonId?.toString() === lesson._id.toString())
        return {
          ...lesson,
          course: courses.find((c) => c._id.toString() === lesson.courseId?.toString()) ?? null,
          progress: log ? { seconds: log.seconds, completed: log.completed } : null,
        }
      }),
    })
  }),
)

/** §23 — watch telemetry. Upserted per student per lesson. */
contentRouter.post(
  '/lessons/:id/log',
  validateBody(logWatchSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const student = await Student.findOne({ userId: actor._id, deletedAt: null }).select('_id')
    // Staff previewing a lesson generate no telemetry — they are not learners.
    if (!student) {
      res.json({ data: { logged: false } })
      return
    }

    const lesson = await VideoLesson.findOne({ _id: req.params.id, deletedAt: null })
    if (!lesson) throw ApiError.notFound('Lesson not found')

    await WatchLog.findOneAndUpdate(
      { lessonId: lesson._id, studentId: student._id },
      {
        // Never let a rewind erase progress already earned.
        $max: { seconds: req.body.seconds },
        $set: { lastWatchedAt: new Date(), ...(req.body.completed ? { completed: true } : {}) },
      },
      { upsert: true },
    )

    res.json({ data: { logged: true } })
  }),
)

/* ── Writing: the boss's side ─────────────────────────────────────────── */

const bossOnly = requireRole('superadmin')

contentRouter.get(
  '/lessons',
  bossOnly,
  validateQuery(videoLessonQuerySchema),
  asyncRoute(async (_req, res) => {
    const query = res.locals.query
    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.courseId) filter.courseId = query.courseId
    if (query.isPublished !== undefined) filter.isPublished = query.isPublished

    const [items, total] = await Promise.all([
      VideoLesson.find(filter)
        .populate('courseId', 'name slug')
        .sort(parseSort(query.sort === '-createdAt' ? 'order' : query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      VideoLesson.countDocuments(filter),
    ])

    res.json({
      data: {
        items,
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    })
  }),
)

contentRouter.post(
  '/lessons',
  bossOnly,
  validateBody(createVideoLessonSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    if (!(await Course.exists({ _id: req.body.courseId, deletedAt: null }))) {
      throw ApiError.badRequest('Unknown course')
    }

    const lesson = await VideoLesson.create({ ...req.body, createdBy: actor._id })
    await recordAudit({
      action: 'lesson.create',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'VideoLesson',
      entityId: lesson._id,
      after: { title: lesson.title?.uz, courseId: req.body.courseId },
      req,
    })
    res.status(201).json({ data: lesson })
  }),
)

contentRouter.patch(
  '/lessons/:id',
  bossOnly,
  validateBody(updateVideoLessonSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const lesson = await VideoLesson.findOne({ _id: req.params.id, deletedAt: null })
    if (!lesson) throw ApiError.notFound('Lesson not found')

    const before = lesson.toObject()
    lesson.set({ ...req.body, updatedBy: actor._id })
    await lesson.save()

    const changes = diff(before as Record<string, unknown>, req.body)
    await recordAudit({
      action: 'lesson.update',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'VideoLesson',
      entityId: lesson._id,
      before: changes.before,
      after: changes.after,
      req,
    })
    res.json({ data: lesson })
  }),
)

contentRouter.delete(
  '/lessons/:id',
  bossOnly,
  asyncRoute(async (req, res) => {
    const lesson = await VideoLesson.findOne({ _id: req.params.id, deletedAt: null })
    if (!lesson) throw ApiError.notFound('Lesson not found')

    // Soft delete: the watch logs pointing at it stay meaningful.
    lesson.deletedAt = new Date()
    await lesson.save()

    await recordAudit({
      action: 'lesson.delete',
      actorId: currentUser(req)._id,
      actorName: currentUser(req).fullName,
      entity: 'VideoLesson',
      entityId: lesson._id,
      req,
    })
    res.json({ data: { deleted: true } })
  }),
)

/* ── Teacher profiles ─────────────────────────────────────────────────── */

contentRouter.get(
  '/teachers',
  bossOnly,
  validateQuery(teacherQuerySchema),
  asyncRoute(async (_req, res) => {
    const query = res.locals.query
    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.isPublic !== undefined) filter.isPublic = query.isPublic
    if (query.search) {
      const term = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.fullName = { $regex: term, $options: 'i' }
    }

    const [items, total] = await Promise.all([
      TeacherProfile.find(filter)
        .sort(parseSort(query.sort === '-createdAt' ? 'order' : query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      TeacherProfile.countDocuments(filter),
    ])

    res.json({
      data: {
        items,
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    })
  }),
)

contentRouter.post(
  '/teachers',
  bossOnly,
  validateBody(createTeacherProfileSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    if (await TeacherProfile.exists({ slug: req.body.slug, deletedAt: null })) {
      throw ApiError.conflict('A teacher with this address already exists', { slug: req.body.slug })
    }

    const profile = await TeacherProfile.create({ ...req.body, createdBy: actor._id })
    await recordAudit({
      action: 'teacher.create',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'TeacherProfile',
      entityId: profile._id,
      after: { slug: profile.slug, fullName: profile.fullName },
      req,
    })
    res.status(201).json({ data: profile })
  }),
)

contentRouter.patch(
  '/teachers/:id',
  bossOnly,
  validateBody(updateTeacherProfileSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const profile = await TeacherProfile.findOne({ _id: req.params.id, deletedAt: null })
    if (!profile) throw ApiError.notFound('Teacher not found')

    if (req.body.slug && req.body.slug !== profile.slug) {
      if (await TeacherProfile.exists({ slug: req.body.slug, deletedAt: null })) {
        throw ApiError.conflict('A teacher with this address already exists')
      }
    }

    const before = profile.toObject()
    profile.set({ ...req.body, updatedBy: actor._id })
    await profile.save()

    const changes = diff(before as Record<string, unknown>, req.body)
    await recordAudit({
      action: 'teacher.update',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'TeacherProfile',
      entityId: profile._id,
      before: changes.before,
      after: changes.after,
      req,
    })
    res.json({ data: profile })
  }),
)

contentRouter.delete(
  '/teachers/:id',
  bossOnly,
  asyncRoute(async (req, res) => {
    const profile = await TeacherProfile.findOne({ _id: req.params.id, deletedAt: null })
    if (!profile) throw ApiError.notFound('Teacher not found')

    profile.deletedAt = new Date()
    await profile.save()

    await recordAudit({
      action: 'teacher.delete',
      actorId: currentUser(req)._id,
      actorName: currentUser(req).fullName,
      entity: 'TeacherProfile',
      entityId: profile._id,
      req,
    })
    res.json({ data: { deleted: true } })
  }),
)

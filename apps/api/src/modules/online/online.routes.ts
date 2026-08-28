import { Router } from 'express'
import { ApiError } from '@leader/shared/errors'
import {
  createOnlineLessonSchema,
  updateOnlineLessonSchema,
  onlineLessonQuerySchema,
  submitAttemptSchema,
  logWatchSchema,
} from '@leader/shared/schemas'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js'
import { recordAudit } from '../audit/audit.service.js'
import { Course } from '../groups/group.model.js'
import { OnlineLesson, OnlineAttempt, OnlineWatch } from './online.model.js'
import {
  learnerFor,
  accessFilter,
  allProgress,
  courseProgress,
  submitAttempt,
  reviewAttempt,
} from './online.service.js'

/**
 * Online darslar.
 *
 * Authoring is SuperAdmin's alone — the same guard the video catalogue and the
 * library already carried, applied once at the `/admin` prefix rather than
 * three times across three routers. The learner half needs nothing but a login;
 * what it returns is decided by the lesson's own access list.
 */
export const onlineRouter = Router()

onlineRouter.use(requireAuth)

/* ── The learner's side ───────────────────────────────────────────────── */

/** Everything this account may open, grouped client-side by course. */
onlineRouter.get(
  '/lessons/mine',
  asyncRoute(async (req, res) => {
    const learner = await learnerFor(currentUser(req)._id)
    if (!learner) {
      // Staff have no student record and therefore no coursework — an empty
      // list is the honest answer, not a 403.
      res.json({ data: [] })
      return
    }

    const lessons = await OnlineLesson.find(accessFilter(learner))
      .sort({ courseId: 1, order: 1 })
      .lean()

    const [progress, watched, courses] = await Promise.all([
      allProgress(learner),
      OnlineWatch.find({ studentId: learner._id }).lean(),
      Course.find({ _id: { $in: lessons.map((lesson) => lesson.courseId) } })
        .select('name slug')
        .lean(),
    ])

    res.json({
      data: lessons.map((lesson) => {
        const own = progress.get(lesson._id.toString())
        const log = watched.find((row) => row.lessonId?.toString() === lesson._id.toString())
        const course = courses.find((row) => row._id.toString() === lesson.courseId?.toString())

        return {
          _id: lesson._id.toString(),
          title: lesson.title,
          description: lesson.description,
          order: lesson.order,
          course: course ? { _id: course._id.toString(), name: course.name } : null,
          hasVideo: Boolean(lesson.video?.videoId),
          durationMinutes: lesson.video?.durationMinutes ?? 0,
          thumbnail: lesson.video?.thumbnail,
          materialCount: lesson.materials?.length ?? 0,
          questionCount: lesson.test?.questions?.length ?? 0,
          passMark: lesson.test?.passMark ?? 0,
          maxAttempts: lesson.test?.maxAttempts ?? 0,
          unlocked: own?.unlocked ?? false,
          best: own?.best ?? null,
          attemptsUsed: own?.attemptsUsed ?? 0,
          watched: Boolean(log?.completed),
        }
      }),
    })
  }),
)

/**
 * One lesson in full — the video, the handouts and the test's questions.
 *
 * Deliberately never selects `test.questions.correctKey`: the answer key must
 * not be in the payload that renders the test, only in the one that reviews a
 * finished attempt.
 */
onlineRouter.get(
  '/lessons/:id',
  asyncRoute(async (req, res) => {
    const learner = await learnerFor(currentUser(req)._id)
    if (!learner) throw ApiError.forbidden('This account has no student record')

    const lesson = await OnlineLesson.findOne({
      ...accessFilter(learner),
      _id: req.params.id,
    }).lean()
    if (!lesson) throw ApiError.notFound('Lesson not found')

    const progress = await courseProgress(lesson.courseId.toString(), learner)
    const own = progress.get(lesson._id.toString())
    if (!own?.unlocked) {
      throw new ApiError(403, 'MODULE_LOCKED', 'Finish the previous lesson first')
    }

    const course = await Course.findById(lesson.courseId).select('name slug').lean()
    const log = await OnlineWatch.findOne({
      lessonId: lesson._id,
      studentId: learner._id,
    }).lean()

    res.json({
      data: {
        _id: lesson._id.toString(),
        title: lesson.title,
        description: lesson.description,
        order: lesson.order,
        course: course ? { _id: course._id.toString(), name: course.name } : null,
        video: lesson.video ?? null,
        materials: lesson.materials ?? [],
        test:
          (lesson.test?.questions?.length ?? 0) > 0
            ? {
                passMark: lesson.test!.passMark,
                maxAttempts: lesson.test!.maxAttempts,
                timeLimitMinutes: lesson.test!.timeLimitMinutes,
                attemptsUsed: own.attemptsUsed,
                questions: lesson.test!.questions.map((question) => ({
                  key: question.key,
                  prompt: question.prompt,
                  options: question.options,
                })),
              }
            : null,
        best: own.best,
        progress: log ? { seconds: log.seconds, completed: log.completed } : null,
      },
    })
  }),
)

/** Watch telemetry, upserted per student per lesson. */
onlineRouter.post(
  '/lessons/:id/log',
  validateBody(logWatchSchema),
  asyncRoute(async (req, res) => {
    const learner = await learnerFor(currentUser(req)._id)
    // Staff previewing a lesson generate no telemetry — they are not learners.
    if (!learner) {
      res.json({ data: { logged: false } })
      return
    }

    const lesson = await OnlineLesson.findOne({
      ...accessFilter(learner),
      _id: req.params.id,
    }).select('_id')
    if (!lesson) throw ApiError.notFound('Lesson not found')

    await OnlineWatch.findOneAndUpdate(
      { lessonId: lesson._id, studentId: learner._id },
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

onlineRouter.post(
  '/lessons/:id/submit',
  validateBody(submitAttemptSchema),
  asyncRoute(async (req, res) => {
    const learner = await learnerFor(currentUser(req)._id)
    if (!learner) throw ApiError.forbidden('This account has no student record')

    const { attempt } = await submitAttempt(String(req.params.id), learner, req.body)

    res.status(201).json({
      data: {
        attemptId: attempt._id.toString(),
        score: attempt.score,
        correct: attempt.correct,
        total: attempt.total,
        passMark: attempt.passMark,
        passed: attempt.passed,
      },
    })
  }),
)

/** The review — every question marked right or wrong, with the correct answer. */
onlineRouter.get(
  '/attempts/:id',
  asyncRoute(async (req, res) => {
    const user = currentUser(req)
    const isStaff = user.roles.some((assignment) =>
      ['superadmin', 'manager', 'teacher'].includes(assignment.role),
    )

    const learner = isStaff ? null : await learnerFor(user._id)
    if (!isStaff && !learner) throw ApiError.forbidden('This account has no student record')

    res.json({ data: await reviewAttempt(String(req.params.id), learner?._id.toString()) })
  }),
)

/* ── Authoring: the boss's side ───────────────────────────────────────── */

const bossOnly = requireRole('superadmin')

onlineRouter.get(
  '/admin/lessons',
  bossOnly,
  validateQuery(onlineLessonQuerySchema),
  asyncRoute(async (_req, res) => {
    const query = res.locals.query
    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.courseId) filter.courseId = query.courseId
    if (query.isPublished !== undefined) filter.isPublished = query.isPublished
    if (query.search) filter['title.uz'] = { $regex: query.search, $options: 'i' }

    const [items, total] = await Promise.all([
      OnlineLesson.find(filter)
        .populate('courseId', 'name slug')
        .sort({ courseId: 1, order: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      OnlineLesson.countDocuments(filter),
    ])

    res.json({
      data: {
        // The list never needs the questions, so it never carries them.
        items: items.map((lesson) => ({
          ...lesson,
          questionCount: lesson.test?.questions?.length ?? 0,
          test: lesson.test
            ? { ...lesson.test, questions: undefined as unknown as never[] }
            : null,
        })),
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    })
  }),
)

/**
 * One uploaded video, referenced by several lessons: this lists the distinct
 * files already uploaded so the editor can offer "reuse an existing video"
 * instead of only "upload a new one".
 */
onlineRouter.get(
  '/admin/videos',
  bossOnly,
  asyncRoute(async (_req, res) => {
    const rows = await OnlineLesson.aggregate<{
      _id: string
      title: unknown
      durationMinutes: number
      usedBy: number
    }>([
      { $match: { 'video.provider': 'file', deletedAt: null } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$video.videoId',
          title: { $first: '$title' },
          durationMinutes: { $first: '$video.durationMinutes' },
          usedBy: { $sum: 1 },
        },
      },
      { $sort: { usedBy: -1 } },
      { $limit: 200 },
    ])

    res.json({
      data: rows.map((row) => ({
        videoId: row._id,
        title: row.title,
        durationMinutes: row.durationMinutes,
        usedBy: row.usedBy,
      })),
    })
  }),
)

/** The full record, answer key included — this is the editing view. */
onlineRouter.get(
  '/admin/lessons/:id',
  bossOnly,
  asyncRoute(async (req, res) => {
    const lesson = await OnlineLesson.findOne({ _id: req.params.id, deletedAt: null })
      .select('+test.questions.correctKey +test.questions.explanation')
      .lean()
    if (!lesson) throw ApiError.notFound('Lesson not found')
    res.json({ data: lesson })
  }),
)

onlineRouter.post(
  '/admin/lessons',
  bossOnly,
  validateBody(createOnlineLessonSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    if (!(await Course.exists({ _id: req.body.courseId, deletedAt: null }))) {
      throw ApiError.badRequest('Unknown course')
    }

    // Provenance only — the lesson itself is course-wide, not branch-scoped.
    const authorBranch = actor.roles.find((assignment) => assignment.branchId)?.branchId
    const lesson = await OnlineLesson.create({
      ...req.body,
      branchId: authorBranch,
      createdBy: actor._id,
    })

    await recordAudit({
      action: 'online.lesson.create',
      entity: 'OnlineLesson',
      entityId: lesson._id,
      actorId: actor._id,
      actorName: actor.fullName,
      after: {
        title: lesson.title?.uz,
        courseId: String(req.body.courseId),
        questions: lesson.test?.questions?.length ?? 0,
        accessCourses: lesson.accessCourseIds?.length ?? 0,
      },
      req,
    })

    res.status(201).json({ data: lesson })
  }),
)

onlineRouter.patch(
  '/admin/lessons/:id',
  bossOnly,
  validateBody(updateOnlineLessonSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const lesson = await OnlineLesson.findOne({ _id: req.params.id, deletedAt: null })
    if (!lesson) throw ApiError.notFound('Lesson not found')

    Object.assign(lesson, req.body, { updatedBy: actor._id })
    await lesson.save()

    await recordAudit({
      action: 'online.lesson.update',
      entity: 'OnlineLesson',
      entityId: lesson._id,
      actorId: actor._id,
      actorName: actor.fullName,
      after: {
        isPublished: lesson.isPublished,
        questions: lesson.test?.questions?.length ?? 0,
        accessCourses: lesson.accessCourseIds?.length ?? 0,
        accessStudents: lesson.accessStudentIds?.length ?? 0,
      },
      req,
    })

    res.json({ data: lesson })
  }),
)

onlineRouter.delete(
  '/admin/lessons/:id',
  bossOnly,
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const lesson = await OnlineLesson.findOne({ _id: req.params.id, deletedAt: null })
    if (!lesson) throw ApiError.notFound('Lesson not found')

    // Soft delete (§22) — attempts reference this lesson and must stay readable.
    lesson.deletedAt = new Date()
    lesson.updatedBy = actor._id
    await lesson.save()

    await recordAudit({
      action: 'online.lesson.delete',
      entity: 'OnlineLesson',
      entityId: lesson._id,
      actorId: actor._id,
      actorName: actor.fullName,
      req,
    })

    res.json({ data: { ok: true } })
  }),
)

/** Who has sat this lesson's test, and how they did. */
onlineRouter.get(
  '/admin/lessons/:id/results',
  bossOnly,
  asyncRoute(async (req, res) => {
    const attempts = await OnlineAttempt.find({ lessonId: req.params.id })
      .sort({ submittedAt: -1 })
      .populate('studentId', 'fullName phone')
      .limit(500)
      .lean()

    res.json({
      data: attempts.map((attempt) => ({
        _id: attempt._id.toString(),
        student: attempt.studentId,
        score: attempt.score,
        correct: attempt.correct,
        total: attempt.total,
        passed: attempt.passed,
        submittedAt: attempt.submittedAt,
      })),
    })
  }),
)

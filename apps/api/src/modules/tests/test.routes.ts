import { Router } from 'express'
import { ApiError } from '@leader/shared/errors'
import { createModuleSchema, updateModuleSchema, submitAttemptSchema } from '@leader/shared/schemas'
import { validateBody } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requirePermission, currentUser, isSuperadmin } from '../../middleware/auth.js'
import { recordAudit } from '../audit/audit.service.js'
import { Student } from '../students/student.model.js'
import { Group } from '../groups/group.model.js'
import { TestModule, TestAttempt } from './test.model.js'
import { courseProgress, submitAttempt, reviewAttempt } from './test.service.js'

/**
 * Online modules and their tests.
 *
 * Authoring is `test.manage` — SuperAdmin and Teacher only, per the client:
 * an Admin runs the branch but does not write the coursework.
 */
export const testRouter = Router()

testRouter.use(requireAuth)

/** The student record behind this login, for the learner-facing routes. */
async function ownStudent(req: Parameters<typeof currentUser>[0]) {
  const user = currentUser(req)
  return Student.findOne({ userId: user._id, deletedAt: null }).select('_id branchId').lean()
}

/**
 * §4.2 note 10 — a teacher may author only for a course they actually teach.
 * SuperAdmin is unrestricted.
 */
async function assertMayAuthor(req: Parameters<typeof currentUser>[0], courseId: string) {
  const user = currentUser(req)
  if (isSuperadmin(user)) return

  const teaches = await Group.exists({ courseId, teacherId: user._id, deletedAt: null })
  if (!teaches) {
    throw ApiError.forbidden('You may only author tests for a course you teach')
  }
}

// ── Learner-facing ────────────────────────────────────────────────────────────

/**
 * The module list for a course, with the unlock chain applied.
 *
 * Deliberately never selects `questions.correctKey`: the answer key must not be
 * in the payload that renders the course, only in the one that reviews a
 * finished attempt.
 */
testRouter.get(
  '/courses/:courseId/modules',
  asyncRoute(async (req, res) => {
    const student = await ownStudent(req)
    if (!student) throw ApiError.forbidden('This account has no student record')

    const modules = await TestModule.find({
      courseId: req.params.courseId,
      isPublished: true,
      deletedAt: null,
    })
      .sort({ order: 1 })
      .lean()

    const progress = await courseProgress(String(req.params.courseId), student._id.toString())

    res.json({
      data: modules.map((module) => {
        const own = progress.get(module._id.toString())
        return {
          _id: module._id.toString(),
          title: module.title,
          description: module.description,
          order: module.order,
          passMark: module.passMark,
          questionCount: module.questions.length,
          maxAttempts: module.maxAttempts,
          timeLimitMinutes: module.timeLimitMinutes,
          unlocked: own?.unlocked ?? false,
          best: own?.best ?? null,
          attemptsUsed: own?.attemptsUsed ?? 0,
        }
      }),
    })
  }),
)

/** The test itself — questions and options, never the answers. */
testRouter.get(
  '/modules/:id',
  asyncRoute(async (req, res) => {
    const student = await ownStudent(req)
    if (!student) throw ApiError.forbidden('This account has no student record')

    const module = await TestModule.findOne({
      _id: req.params.id,
      isPublished: true,
      deletedAt: null,
    }).lean()
    if (!module) throw ApiError.notFound('Test not found')

    const progress = await courseProgress(module.courseId.toString(), student._id.toString())
    const own = progress.get(module._id.toString())

    if (!own?.unlocked) {
      throw new ApiError(403, 'MODULE_LOCKED', 'Finish the previous module first')
    }

    res.json({
      data: {
        _id: module._id.toString(),
        title: module.title,
        description: module.description,
        order: module.order,
        passMark: module.passMark,
        timeLimitMinutes: module.timeLimitMinutes,
        attemptsUsed: own.attemptsUsed,
        maxAttempts: module.maxAttempts,
        questions: module.questions.map((question) => ({
          key: question.key,
          prompt: question.prompt,
          options: question.options,
        })),
      },
    })
  }),
)

testRouter.post(
  '/modules/:id/submit',
  validateBody(submitAttemptSchema),
  asyncRoute(async (req, res) => {
    const student = await ownStudent(req)
    if (!student) throw ApiError.forbidden('This account has no student record')

    const { attempt } = await submitAttempt(
      String(req.params.id),
      student._id.toString(),
      student.branchId,
      req.body,
    )

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
testRouter.get(
  '/attempts/:id',
  asyncRoute(async (req, res) => {
    const user = currentUser(req)
    const isStaff = user.roles.some((assignment) =>
      ['superadmin', 'manager', 'teacher'].includes(assignment.role),
    )

    const student = isStaff ? null : await ownStudent(req)
    if (!isStaff && !student) throw ApiError.forbidden('This account has no student record')

    res.json({
      data: await reviewAttempt(String(req.params.id), student?._id.toString()),
    })
  }),
)

// ── Authoring (SuperAdmin and Teacher only) ──────────────────────────────────

testRouter.get(
  '/modules',
  requirePermission('test.manage'),
  asyncRoute(async (req, res) => {
    const user = currentUser(req)
    const filter: Record<string, unknown> = { deletedAt: null }

    // A teacher sees only the courses they teach.
    if (!isSuperadmin(user)) {
      const groups = await Group.find({ teacherId: user._id, deletedAt: null })
        .select('courseId')
        .lean()
      filter.courseId = { $in: groups.map((group) => group.courseId) }
    }

    const modules = await TestModule.find(filter)
      .sort({ courseId: 1, order: 1 })
      .populate('courseId', 'name slug')
      .lean()

    res.json({
      data: modules.map((module) => ({
        ...module,
        questionCount: module.questions.length,
        // The list never needs the questions, so it never carries them.
        questions: undefined,
      })),
    })
  }),
)

testRouter.post(
  '/modules',
  requirePermission('test.manage'),
  validateBody(createModuleSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    await assertMayAuthor(req, req.body.courseId)

    const clash = await TestModule.findOne({
      courseId: req.body.courseId,
      order: req.body.order,
      deletedAt: null,
    })
    if (clash) {
      throw new ApiError(409, 'ORDER_TAKEN', `Module ${req.body.order} already exists`)
    }

    // Provenance only — the module itself is course-wide, not branch-scoped.
    const authorBranch = actor.roles.find((assignment) => assignment.branchId)?.branchId
    const module = await TestModule.create({
      ...req.body,
      branchId: authorBranch,
      createdBy: actor._id,
    })

    await recordAudit({
      action: 'test.module.create',
      entity: 'TestModule',
      entityId: module._id,
      actorId: actor._id,
      actorName: actor.fullName,
      after: { title: module.title, order: module.order, questions: module.questions.length },
      req,
    })

    res.status(201).json({ data: module })
  }),
)

testRouter.patch(
  '/modules/:id',
  requirePermission('test.manage'),
  validateBody(updateModuleSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const module = await TestModule.findOne({ _id: req.params.id, deletedAt: null })
    if (!module) throw ApiError.notFound('Test not found')

    await assertMayAuthor(req, module.courseId.toString())

    Object.assign(module, req.body, { updatedBy: actor._id })
    await module.save()

    await recordAudit({
      action: 'test.module.update',
      entity: 'TestModule',
      entityId: module._id,
      actorId: actor._id,
      actorName: actor.fullName,
      after: { isPublished: module.isPublished, questions: module.questions.length },
      req,
    })

    res.json({ data: module })
  }),
)

testRouter.delete(
  '/modules/:id',
  requirePermission('test.manage'),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const module = await TestModule.findOne({ _id: req.params.id, deletedAt: null })
    if (!module) throw ApiError.notFound('Test not found')

    await assertMayAuthor(req, module.courseId.toString())

    // Soft delete (§22) — attempts reference this module and must stay readable.
    module.deletedAt = new Date()
    module.updatedBy = actor._id
    await module.save()

    await recordAudit({
      action: 'test.module.delete',
      entity: 'TestModule',
      entityId: module._id,
      actorId: actor._id,
      actorName: actor.fullName,
      req,
    })

    res.json({ data: { ok: true } })
  }),
)

/** Results for one module, for the teacher who owns it. */
testRouter.get(
  '/modules/:id/results',
  requirePermission('test.manage'),
  asyncRoute(async (req, res) => {
    const module = await TestModule.findOne({ _id: req.params.id, deletedAt: null }).lean()
    if (!module) throw ApiError.notFound('Test not found')

    await assertMayAuthor(req, module.courseId.toString())

    const attempts = await TestAttempt.find({ moduleId: module._id })
      .sort({ submittedAt: -1 })
      .populate('studentId', 'fullName phone')
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

import type { FilterQuery, Types } from 'mongoose'
import { ApiError } from '@leader/shared/errors'
import type { SubmitAttemptInput } from '@leader/shared/schemas'
import { Student } from '../students/student.model.js'
import { Group, Enrollment } from '../groups/group.model.js'
import { OnlineLesson, OnlineAttempt } from './online.model.js'

/**
 * Access, the unlock chain and the grader.
 *
 * Three rules the client set, all enforced here rather than in the UI:
 *   · a lesson opens only to the courses (or named students) it was granted to,
 *   · a lesson that follows a *test-bearing* one opens only when that test was
 *     passed — a lesson with no test never blocks the next,
 *   · passing means scoring at or above the lesson's pass mark.
 */

export type Learner = { _id: Types.ObjectId; branchId: Types.ObjectId; courseIds: string[] }

/**
 * The student behind a login, with the courses they are actively enrolled on.
 *
 * A student holds no `student.manage` grant, so they cannot look themselves up
 * — this is the only path from a session to a student record on these routes.
 */
export async function learnerFor(userId: unknown): Promise<Learner | null> {
  const student = await Student.findOne({ userId, deletedAt: null })
    .select('_id branchId')
    .lean()
  if (!student) return null

  const enrolments = await Enrollment.find({ studentId: student._id, status: 'active' })
    .select('groupId')
    .lean()

  const groups = await Group.find({
    _id: { $in: enrolments.map((enrolment) => enrolment.groupId) },
    deletedAt: null,
  })
    .select('courseId')
    .lean()

  return {
    _id: student._id,
    branchId: student.branchId,
    // A student in two groups on the same course should not see it twice.
    courseIds: [...new Set(groups.map((group) => group.courseId.toString()))],
  }
}

/**
 * What this learner may open: anything free, anything granted to one of their
 * courses, and anything granted to them by name.
 *
 * Empty lists on both sides mean the lesson reaches nobody, which is the
 * intended default — access is granted, never assumed.
 */
export function accessFilter(learner: Learner): FilterQuery<unknown> {
  return {
    deletedAt: null,
    isPublished: true,
    $or: [
      { isFree: true },
      { accessCourseIds: { $in: learner.courseIds } },
      { accessStudentIds: learner._id },
    ],
  }
}

export type LessonProgress = {
  lessonId: string
  unlocked: boolean
  best: { score: number; passed: boolean; attemptId: string; submittedAt: Date } | null
  attemptsUsed: number
}

/**
 * Walks a course's accessible lessons in order, carrying the unlock forward.
 *
 * Computed rather than stored, so changing a pass mark or deleting an attempt
 * re-derives the truth instead of leaving a stale `unlocked` flag behind.
 *
 * The walk runs over the lessons *this learner can access*, not over every
 * lesson on the course: a lesson they were never granted must not sit in the
 * middle of the chain blocking everything after it forever.
 */
export async function courseProgress(
  courseId: string,
  learner: Learner,
): Promise<Map<string, LessonProgress>> {
  const lessons = await OnlineLesson.find({ ...accessFilter(learner), courseId })
    .sort({ order: 1, createdAt: 1 })
    .select('_id order test.questions test.passMark')
    .lean()

  const attempts = await OnlineAttempt.find({
    studentId: learner._id,
    lessonId: { $in: lessons.map((lesson) => lesson._id) },
  })
    .sort({ score: -1, submittedAt: -1 })
    .lean()

  const byLesson = new Map<string, typeof attempts>()
  for (const attempt of attempts) {
    const key = attempt.lessonId.toString()
    byLesson.set(key, [...(byLesson.get(key) ?? []), attempt])
  }

  const progress = new Map<string, LessonProgress>()
  let gateOpen = true // the first lesson needs nothing before it

  for (const lesson of lessons) {
    const key = lesson._id.toString()
    const own = byLesson.get(key) ?? []
    // Sorted by score desc above, so the first is the best.
    const best = own[0]

    progress.set(key, {
      lessonId: key,
      unlocked: gateOpen,
      best: best
        ? {
            score: best.score,
            passed: best.passed,
            attemptId: best._id.toString(),
            submittedAt: best.submittedAt,
          }
        : null,
      attemptsUsed: own.length,
    })

    // Only a lesson that actually carries a test can close the gate behind it.
    const hasTest = (lesson.test?.questions?.length ?? 0) > 0
    if (hasTest) gateOpen = Boolean(best?.passed)
  }

  return progress
}

/** The same walk across every course the learner has lessons on. */
export async function allProgress(learner: Learner): Promise<Map<string, LessonProgress>> {
  const courseIds = await OnlineLesson.distinct('courseId', accessFilter(learner))

  const merged = new Map<string, LessonProgress>()
  for (const courseId of courseIds) {
    const own = await courseProgress(String(courseId), learner)
    for (const [key, value] of own) merged.set(key, value)
  }
  return merged
}

/**
 * Grades a submission and stores it.
 *
 * The answer key is read here, server-side, and never travels to the browser
 * before this point — `correctKey` is `select: false` on the schema precisely so
 * a student cannot read the answers out of the payload that renders the test.
 */
export async function submitAttempt(
  lessonId: string,
  learner: Learner,
  input: SubmitAttemptInput,
) {
  // `+test.questions.correctKey` opts the hidden fields back in, for grading only.
  const lesson = await OnlineLesson.findOne({
    ...accessFilter(learner),
    _id: lessonId,
  }).select('+test.questions.correctKey +test.questions.explanation')

  if (!lesson) throw ApiError.notFound('Lesson not found')

  const questions = lesson.test?.questions ?? []
  if (questions.length === 0) throw ApiError.notFound('This lesson has no test')

  const progress = await courseProgress(lesson.courseId.toString(), learner)
  const own = progress.get(lesson._id.toString())

  if (!own?.unlocked) {
    throw new ApiError(403, 'MODULE_LOCKED', 'Finish the previous lesson before starting this one')
  }

  const maxAttempts = lesson.test?.maxAttempts ?? 0
  if (maxAttempts > 0 && own.attemptsUsed >= maxAttempts) {
    throw new ApiError(409, 'NO_ATTEMPTS_LEFT', 'No attempts remain for this test')
  }

  const chosenBy = new Map(
    input.answers.map((answer) => [answer.questionKey, answer.chosenKey ?? null]),
  )

  // Grade against every question on the lesson, not against what was submitted:
  // a question left out of the payload is simply wrong, not skipped.
  const answers = questions.map((question) => {
    const chosenKey = chosenBy.get(question.key) ?? null
    return {
      questionKey: question.key,
      chosenKey,
      correctKey: question.correctKey,
      isCorrect: chosenKey !== null && chosenKey === question.correctKey,
    }
  })

  const total = answers.length
  const correct = answers.filter((answer) => answer.isCorrect).length
  const score = total === 0 ? 0 : Math.round((correct / total) * 100)
  const passMark = lesson.test?.passMark ?? 70

  const attempt = await OnlineAttempt.create({
    branchId: learner.branchId,
    lessonId: lesson._id,
    studentId: learner._id,
    answers,
    correct,
    total,
    score,
    // Snapshotted, so a later change to the lesson cannot rewrite this result.
    passMark,
    passed: score >= passMark,
    startedAt: input.startedAt,
    submittedAt: new Date(),
    locale: input.locale,
  })

  return { attempt, lesson }
}

/**
 * The review view: every question with what the student chose, what was right,
 * and why. Only ever built from a *submitted* attempt, which is what makes it
 * safe to include the answer key at all.
 */
export async function reviewAttempt(attemptId: string, studentId?: string) {
  const attempt = await OnlineAttempt.findById(attemptId).lean()
  if (!attempt) throw ApiError.notFound('Attempt not found')

  // A student may review only their own attempt; staff pass no `studentId`.
  if (studentId && attempt.studentId.toString() !== studentId) {
    throw ApiError.forbidden('You may only review your own attempt')
  }

  const lesson = await OnlineLesson.findById(attempt.lessonId)
    .select('+test.questions.correctKey +test.questions.explanation')
    .lean()
  if (!lesson) throw ApiError.notFound('Lesson not found')

  const questionByKey = new Map(
    (lesson.test?.questions ?? []).map((question) => [question.key, question]),
  )

  return {
    attempt: {
      _id: attempt._id.toString(),
      score: attempt.score,
      correct: attempt.correct,
      total: attempt.total,
      passMark: attempt.passMark,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
    },
    lesson: { _id: lesson._id.toString(), title: lesson.title, order: lesson.order },
    questions: attempt.answers.map((answer) => {
      const question = questionByKey.get(answer.questionKey)
      return {
        key: answer.questionKey,
        prompt: question?.prompt,
        options: question?.options ?? [],
        chosenKey: answer.chosenKey,
        correctKey: answer.correctKey,
        isCorrect: answer.isCorrect,
        explanation: question?.explanation,
      }
    }),
  }
}

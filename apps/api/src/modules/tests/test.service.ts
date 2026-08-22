import { Types } from 'mongoose'
import { ApiError } from '@leader/shared/errors'
import type { SubmitAttemptInput } from '@leader/shared/schemas'
import { TestModule, TestAttempt } from './test.model.js'

/**
 * The unlock chain and the grader.
 *
 * Two rules the client set, and both are enforced here rather than in the UI:
 *   · a module opens only when the one before it was passed,
 *   · passing means scoring at or above the module's pass mark (70% by default).
 *
 * §16's "1 correct answer = 1 score" makes the score a plain percentage of
 * questions answered correctly.
 */

export type ModuleProgress = {
  moduleId: string
  unlocked: boolean
  best: { score: number; passed: boolean; attemptId: string; submittedAt: Date } | null
  attemptsUsed: number
}

/**
 * Walks a course's modules in order, carrying the unlock forward.
 *
 * The first module is always open; every later one opens only if the previous
 * module has a passing attempt. Computed rather than stored, so changing a pass
 * mark or deleting an attempt re-derives the truth instead of leaving a stale
 * `unlocked` flag behind.
 */
export async function courseProgress(
  courseId: string,
  studentId: string,
): Promise<Map<string, ModuleProgress>> {
  const modules = await TestModule.find({
    courseId,
    isPublished: true,
    deletedAt: null,
  })
    .sort({ order: 1 })
    .select('_id order passMark')
    .lean()

  const attempts = await TestAttempt.find({
    studentId,
    moduleId: { $in: modules.map((module) => module._id) },
  })
    .sort({ score: -1, submittedAt: -1 })
    .lean()

  const byModule = new Map<string, typeof attempts>()
  for (const attempt of attempts) {
    const key = attempt.moduleId.toString()
    byModule.set(key, [...(byModule.get(key) ?? []), attempt])
  }

  const progress = new Map<string, ModuleProgress>()
  let previousPassed = true // the first module needs nothing before it

  for (const module of modules) {
    const key = module._id.toString()
    const own = byModule.get(key) ?? []
    // Sorted by score desc above, so the first is the best.
    const best = own[0]

    progress.set(key, {
      moduleId: key,
      unlocked: previousPassed,
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

    previousPassed = Boolean(best?.passed)
  }

  return progress
}

/**
 * Grades a submission and stores it.
 *
 * The answer key is read here, server-side, and never travels to the browser
 * before this point — `correctKey` is `select: false` on the schema precisely so
 * that a student cannot read the answers out of the payload that renders the
 * test.
 */
export async function submitAttempt(
  moduleId: string,
  studentId: string,
  branchId: Types.ObjectId | string,
  input: SubmitAttemptInput,
) {
  // `+correctKey` opts the hidden field back in, only for grading.
  const module = await TestModule.findOne({
    _id: moduleId,
    isPublished: true,
    deletedAt: null,
  }).select('+questions.correctKey +questions.explanation')

  if (!module) throw ApiError.notFound('Test not found')

  const progress = await courseProgress(module.courseId.toString(), studentId)
  const own = progress.get(moduleId)

  if (!own?.unlocked) {
    throw new ApiError(
      403,
      'MODULE_LOCKED',
      'Finish the previous module before starting this one',
    )
  }

  if (module.maxAttempts > 0 && own.attemptsUsed >= module.maxAttempts) {
    throw new ApiError(409, 'NO_ATTEMPTS_LEFT', 'No attempts remain for this test')
  }

  const chosenBy = new Map(
    input.answers.map((answer) => [answer.questionKey, answer.chosenKey ?? null]),
  )

  // Grade against every question on the module, not against what was submitted:
  // a question left out of the payload is simply wrong, not skipped.
  const answers = module.questions.map((question) => {
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

  const attempt = await TestAttempt.create({
    branchId,
    moduleId: module._id,
    studentId,
    answers,
    correct,
    total,
    score,
    // Snapshotted, so a later change to the module cannot rewrite this result.
    passMark: module.passMark,
    passed: score >= module.passMark,
    startedAt: input.startedAt,
    submittedAt: new Date(),
    locale: input.locale,
  })

  return { attempt, module }
}

/**
 * The review view: every question with what the student chose, what was right,
 * and why — green for correct, red for wrong, decided by `isCorrect`.
 *
 * Only ever built from a *submitted* attempt, which is what makes it safe to
 * include the answer key at all.
 */
export async function reviewAttempt(attemptId: string, studentId?: string) {
  const attempt = await TestAttempt.findById(attemptId).lean()
  if (!attempt) throw ApiError.notFound('Attempt not found')

  // A student may review only their own attempt; staff pass no `studentId`.
  if (studentId && attempt.studentId.toString() !== studentId) {
    throw ApiError.forbidden('You may only review your own attempt')
  }

  const module = await TestModule.findById(attempt.moduleId)
    .select('+questions.correctKey +questions.explanation')
    .lean()
  if (!module) throw ApiError.notFound('Test not found')

  const questionByKey = new Map(module.questions.map((question) => [question.key, question]))

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
    module: { _id: module._id.toString(), title: module.title, order: module.order },
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

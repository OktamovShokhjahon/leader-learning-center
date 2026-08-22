/**
 * Online modules and their tests.
 *
 * Extends TZ §16 into the self-paced online track: a course is an ordered chain
 * of modules, each ending in a test, and the next module unlocks only when the
 * student reaches the pass mark. §16's "1 correct answer = 1 score" rule holds,
 * so the score is simply correct ÷ total as a percentage.
 */
import { z } from 'zod'
import { localizedSchema, localizedOptionalSchema, objectIdSchema } from './common.js'

/** The default the client asked for: 70% unlocks the next module. */
export const DEFAULT_PASS_MARK = 70

export const optionSchema = z.object({
  key: z.string().trim().min(1).max(8),
  text: localizedSchema,
})

export const questionSchema = z
  .object({
    key: z.string().trim().min(1).max(24),
    prompt: localizedSchema,
    options: z.array(optionSchema).min(2, 'tooFewOptions').max(6, 'tooManyOptions'),
    correctKey: z.string().trim().min(1),
    explanation: localizedOptionalSchema,
  })
  .refine((question) => question.options.some((option) => option.key === question.correctKey), {
    message: 'correctKeyNotAnOption',
    path: ['correctKey'],
  })
  .refine(
    (question) => new Set(question.options.map((option) => option.key)).size === question.options.length,
    { message: 'duplicateOptionKey', path: ['options'] },
  )

export const createModuleSchema = z.object({
  courseId: objectIdSchema,
  title: localizedSchema,
  description: localizedOptionalSchema,
  order: z.coerce.number().int().min(1),
  questions: z.array(questionSchema).min(1, 'atLeastOneQuestion'),
  passMark: z.coerce.number().int().min(1).max(100).default(DEFAULT_PASS_MARK),
  maxAttempts: z.coerce.number().int().min(0).default(0),
  timeLimitMinutes: z.coerce.number().int().min(0).default(0),
  isPublished: z.boolean().default(false),
})

export const updateModuleSchema = createModuleSchema.partial().omit({ courseId: true })

/** What a student submits. Unanswered questions may be omitted or sent as null. */
export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionKey: z.string().trim().min(1),
        chosenKey: z.string().trim().min(1).nullable(),
      }),
    )
    .min(1, 'noAnswers'),
  startedAt: z.coerce.date().optional(),
  locale: z.enum(['uz', 'ru', 'en']).default('uz'),
})

export type CreateModuleInput = z.input<typeof createModuleSchema>
export type SubmitAttemptInput = z.input<typeof submitAttemptSchema>

/** The shape a student sees — never carries `correctKey` before submission. */
export type StudentModuleView = {
  _id: string
  title: { uz: string; ru?: string; en?: string }
  description?: { uz: string; ru?: string; en?: string }
  order: number
  passMark: number
  questionCount: number
  maxAttempts: number
  timeLimitMinutes: number
  /** false until the previous module is passed — the unlock chain. */
  unlocked: boolean
  /** The student's best result so far, if they have attempted it. */
  best: { score: number; passed: boolean; attemptId: string; submittedAt: string } | null
  attemptsUsed: number
}

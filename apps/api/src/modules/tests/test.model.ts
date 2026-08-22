import { Schema, model, type InferSchemaType } from 'mongoose'
import { LOCALES } from '@leader/shared/locales'
import { branchScopePlugin } from '../../middleware/branch-scope.js'

/**
 * Online modules and their tests.
 *
 * Extends TZ §16 (exams, scores, ranking) into the self-paced online track:
 * a course is a sequence of modules, each ending in a test, and the next module
 * unlocks only once the student scores at or above the pass mark.
 *
 * §16's "1 correct answer = 1 score" still holds — every question is worth one
 * point, so the percentage is simply correct ÷ total.
 */

const localized = ({ required = false } = {}) => ({
  uz: { type: String, required },
  ru: String,
  en: String,
})

const optionSchema = new Schema(
  {
    /** Stable key, so shuffling display order never breaks a stored answer. */
    key: { type: String, required: true },
    text: { type: localized({ required: true }), required: true },
  },
  { _id: false },
)

const questionSchema = new Schema(
  {
    /** Stable across edits, so a submitted attempt can still be graded. */
    key: { type: String, required: true },
    prompt: { type: localized({ required: true }), required: true },
    options: {
      type: [optionSchema],
      validate: {
        validator: (options: unknown[]) => options.length >= 2 && options.length <= 6,
        message: 'a question needs between 2 and 6 options',
      },
    },
    /**
     * Never sent to a student before they submit — see `forStudent()`. Keeping
     * it `select: false` means a careless `.find()` cannot leak the answer key.
     */
    correctKey: { type: String, required: true, select: false },
    /** Shown with the result, so a wrong answer teaches something (§16). */
    explanation: { type: localized(), select: false },
  },
  { _id: false },
)

const testModuleSchema = new Schema(
  {
    /**
     * Coursework belongs to the **course**, not to a branch.
     *
     * A student taking General English sits the same test whichever branch they
     * are enrolled at, so branch-scoping this would force the same file to be
     * uploaded once per branch — the opposite of what the client asked for.
     * `branchId` is therefore provenance (who uploaded it), not a filter, and
     * the branch-scope plugin is deliberately **not** applied here.
     *
     * Attempts are a different matter: an attempt is operational data about one
     * student at one branch, so `TestAttempt` *is* scoped below.
     */
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    title: { type: localized({ required: true }), required: true },
    description: localized(),

    /** 1-based position in the course. The unlock chain walks this order. */
    order: { type: Number, required: true, min: 1 },

    questions: { type: [questionSchema], default: [] },

    /** Percentage needed to pass and unlock the next module. */
    passMark: { type: Number, default: 70, min: 1, max: 100 },
    /** 0 means unlimited. */
    maxAttempts: { type: Number, default: 0, min: 0 },
    timeLimitMinutes: { type: Number, default: 0, min: 0 },

    isPublished: { type: Boolean, default: false, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

testModuleSchema.index({ courseId: 1, order: 1 }, { unique: true })
// No branch-scope plugin here — see the note on `branchId` above.

const answerSchema = new Schema(
  {
    questionKey: { type: String, required: true },
    /** What the student picked. `null` when they left it blank. */
    chosenKey: { type: String, default: null },
    correctKey: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
  },
  { _id: false },
)

const attemptSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'TestModule', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },

    answers: { type: [answerSchema], default: [] },

    /** §16 — one correct answer is one score. */
    correct: { type: Number, required: true },
    total: { type: Number, required: true },
    /** Rounded percentage, stored so a later pass-mark change cannot rewrite history. */
    score: { type: Number, required: true },
    passMark: { type: Number, required: true },
    passed: { type: Boolean, required: true, index: true },

    startedAt: Date,
    submittedAt: { type: Date, default: Date.now },
    locale: { type: String, enum: LOCALES, default: 'uz' },
  },
  { timestamps: true },
)

attemptSchema.index({ studentId: 1, moduleId: 1, submittedAt: -1 })
attemptSchema.plugin(branchScopePlugin)

export type TestModuleDocument = InferSchemaType<typeof testModuleSchema>
export type TestAttemptDocument = InferSchemaType<typeof attemptSchema>

export const TestModule = model('TestModule', testModuleSchema)
export const TestAttempt = model('TestAttempt', attemptSchema)

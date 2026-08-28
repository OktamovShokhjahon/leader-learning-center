import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { LOCALES } from '@leader/shared/locales'
import { VIDEO_PROVIDERS, MATERIAL_TYPES } from '@leader/shared/schemas'
import { branchScopePlugin } from '../../middleware/branch-scope.js'

/**
 * Online darslar — the video, its test and its handouts as one record.
 *
 * This replaces the three separate authoring surfaces (`VideoLesson`,
 * `TestModule`, `Material`) with the unit the centre actually thinks in: a
 * lesson. Those collections are left where they are — nothing here reads or
 * writes them — so no historic attempt or upload is lost by the switch.
 *
 * §16's "1 correct answer = 1 score" still holds: every question is worth one
 * point and the score is correct ÷ total as a percentage.
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
     * Never sent to a student before they submit. `select: false` means a
     * careless `.find()` cannot leak the answer key out of the payload that
     * renders the test.
     */
    correctKey: { type: String, required: true, select: false },
    /** Shown with the result, so a wrong answer teaches something (§16). */
    explanation: { type: localized(), select: false },
  },
  { _id: false },
)

const videoSchema = new Schema(
  {
    provider: { type: String, enum: VIDEO_PROVIDERS, default: 'youtube' },
    /**
     * The provider's id, or a URL when `provider` is `file`.
     *
     * ⚠️ §18 requires that a video cannot be saved by right-click, devtools or a
     * downloader, and that a screen recording carries the viewer's name. None of
     * that is implemented — see docs/adr/0006-video-lessons-without-the-drm-layer.md.
     */
    videoId: { type: String, required: true },
    durationMinutes: { type: Number, default: 0 },
    thumbnail: String,
  },
  { _id: false },
)

const testSchema = new Schema(
  {
    questions: { type: [questionSchema], default: [] },
    /** Percentage needed to pass and unlock the next lesson. */
    passMark: { type: Number, default: 70, min: 1, max: 100 },
    /** 0 means unlimited. */
    maxAttempts: { type: Number, default: 0, min: 0 },
    timeLimitMinutes: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
)

const materialSchema = new Schema(
  {
    key: { type: String, required: true },
    title: { type: localized({ required: true }), required: true },
    type: { type: String, enum: MATERIAL_TYPES, required: true },
    fileUrl: { type: String, required: true },
  },
  { _id: false },
)

const onlineLessonSchema = new Schema(
  {
    /**
     * Coursework belongs to the **course**, not to a branch: a student taking
     * General English gets the same lesson whichever building they attend, and
     * branch-scoping would force the same video to be uploaded once per branch.
     * `branchId` is therefore provenance (who authored it), not a filter, and
     * the branch-scope plugin is deliberately not applied here.
     */
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    /** The owning course — what `order` counts within and the chain walks. */
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    title: { type: localized({ required: true }), required: true },
    description: localized(),

    /** Every part is optional; a lesson can be built up over several sittings. */
    video: { type: videoSchema, default: null },
    test: { type: testSchema, default: null },
    materials: { type: [materialSchema], default: [] },

    /**
     * The one access list, replacing the three the old screens each had.
     * Empty means nobody — access is granted, never assumed.
     */
    accessCourseIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Course' }],
      default: [],
      index: true,
    },
    /** The exception: a named student who is on none of those courses. */
    accessStudentIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
      default: [],
      index: true,
    },
    /** Open to anyone signed in. Off by default — §17.4. */
    isFree: { type: Boolean, default: false },

    /** Position within the owning course. The unlock chain walks this order. */
    order: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: false, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// The only query either side runs: this course's lessons, in order.
onlineLessonSchema.index({ courseId: 1, order: 1 })

export type OnlineLessonDocument = HydratedDocument<InferSchemaType<typeof onlineLessonSchema>>
export const OnlineLesson = model('OnlineLesson', onlineLessonSchema)

/* ── Attempts ─────────────────────────────────────────────────────────── */

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

/**
 * An attempt is operational data about one student at one branch, so unlike the
 * lesson it *is* branch-scoped.
 */
const attemptSchema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'OnlineLesson', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },

    answers: { type: [answerSchema], default: [] },

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

attemptSchema.index({ studentId: 1, lessonId: 1, submittedAt: -1 })
attemptSchema.plugin(branchScopePlugin)

export type OnlineAttemptDocument = HydratedDocument<InferSchemaType<typeof attemptSchema>>
export const OnlineAttempt = model('OnlineAttempt', attemptSchema)

/**
 * Watch telemetry — one row per student per lesson, updated in place. The
 * question the centre asks is "has this student watched it", not "how many
 * times did they press play".
 */
const watchSchema = new Schema(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: 'OnlineLesson', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    seconds: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    lastWatchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

watchSchema.index({ lessonId: 1, studentId: 1 }, { unique: true })

export type OnlineWatchDocument = HydratedDocument<InferSchemaType<typeof watchSchema>>
export const OnlineWatch = model('OnlineWatch', watchSchema)

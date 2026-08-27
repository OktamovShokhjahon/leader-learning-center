import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose'
import { VIDEO_PROVIDERS } from '@leader/shared/schemas'

/**
 * TZ §22 — `teachers(profile)` and the video half of `materials`.
 *
 * Neither is branch-scoped, and that is deliberate on both counts. A teacher
 * card and a video lesson are things the *centre* publishes: the landing page
 * has no session and therefore no branch, and a course's lessons are the same
 * lessons whichever building the student attends. A teacher profile carries
 * `branchIds` so the branch pages can filter, but the collection itself is not
 * filtered by the scope plugin — that would make the public site empty.
 */

const teacherProfileSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true },
    role: { uz: { type: String, required: true }, ru: String, en: String },
    bio: { uz: String, ru: String, en: String },
    subjects: { type: [String], default: [] },
    certificates: { type: [String], default: [] },
    experienceYears: { type: Number, default: 0 },
    photo: String,

    /** The staff login this profile describes, when there is one. */
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    /** Which branch pages should list them (§6.2). */
    branchIds: { type: [Schema.Types.ObjectId], ref: 'Branch', default: [] },

    isPublic: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// The public list is "everyone visible, in the order the centre chose".
teacherProfileSchema.index({ isPublic: 1, order: 1 })

export type TeacherProfileDocument = HydratedDocument<InferSchemaType<typeof teacherProfileSchema>>
export const TeacherProfile = model('TeacherProfile', teacherProfileSchema)

/* ── Video lessons (§17.3) ────────────────────────────────────────────── */

const videoLessonSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { uz: { type: String, required: true }, ru: String, en: String },
    description: { uz: String, ru: String, en: String },

    provider: { type: String, enum: VIDEO_PROVIDERS, default: 'youtube' },
    /**
     * The provider's id, or a URL when `provider` is `file`.
     *
     * ⚠️ §18 requires that a video cannot be saved by right-click, devtools or a
     * downloader, and that a screen recording carries the viewer's name. None of
     * that is implemented: a YouTube or Vimeo id is as protected as YouTube or
     * Vimeo make it, and a `file` URL is not protected at all. See
     * docs/adr/0006-video-lessons-without-the-drm-layer.md.
     */
    videoId: { type: String, required: true },
    durationMinutes: { type: Number, default: 0 },
    thumbnail: String,

    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false, index: true },
    /** §17.4 — off by default; a lesson belongs to the people who paid for it. */
    isFree: { type: Boolean, default: false },
    /**
     * D1 — explicit per-group access. Empty means "no access until granted"
     * for anything created after this field existed; `scripts/backfill-lesson-
     * groups.mjs` seeds it once for lessons that predate the field, from each
     * lesson's course enrolments at the time, so rollout does not silently
     * revoke access nobody asked to take away.
     */
    groupIds: { type: [Schema.Types.ObjectId], ref: 'Group', default: [], index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// The cabinet's only query: this course's published lessons, in order.
videoLessonSchema.index({ courseId: 1, order: 1 })

export type VideoLessonDocument = HydratedDocument<InferSchemaType<typeof videoLessonSchema>>
export const VideoLesson = model('VideoLesson', videoLessonSchema)

/**
 * §23 `POST /materials/:id/log` — who watched what, and how far.
 *
 * One row per student per lesson, updated in place: the question the centre asks
 * is "has this student watched it", not "how many times did they press play".
 */
const watchLogSchema = new Schema(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: 'VideoLesson', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    seconds: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    lastWatchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

watchLogSchema.index({ lessonId: 1, studentId: 1 }, { unique: true })

export type WatchLogDocument = HydratedDocument<InferSchemaType<typeof watchLogSchema>>
export const WatchLog = model('WatchLog', watchLogSchema)

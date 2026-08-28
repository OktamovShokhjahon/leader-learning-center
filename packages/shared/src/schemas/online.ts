/**
 * Online darslar — one lesson is one thing.
 *
 * The panel used to author the same lesson three times: a video under
 * `/boss/lessons`, its test under `/crm/tests`, and the handouts that go with it
 * under `/boss/library`. Nothing tied the three together, and each carried a
 * *different* access rule — a video was granted per group, a file per course, a
 * test not at all beyond the course's unlock chain. So "who can see this
 * lesson?" had three answers and no single screen that gave them.
 *
 * An `OnlineLesson` is that single screen's record: the video, the test and the
 * files, plus one access list — the courses (and, for the exception, the named
 * students) allowed to open it.
 */
import { z } from 'zod'
import { localizedSchema, localizedOptionalSchema, objectIdSchema } from './common.js'
import { questionSchema, DEFAULT_PASS_MARK } from './test.js'
import { VIDEO_PROVIDERS } from './content.js'
import { MATERIAL_TYPES } from './materials.js'

/**
 * The video half. Optional: a lesson may be a reading with a test and no
 * recording at all, and the client asked for both parts to be optional so a
 * lesson can be built up over several sittings.
 */
export const onlineVideoSchema = z.object({
  provider: z.enum(VIDEO_PROVIDERS).default('youtube'),
  /** The provider's id (`dQw4w9WgXcQ`), or an uploaded file's URL for `file`. */
  videoId: z.string().trim().min(1, 'required').max(500),
  durationMinutes: z.coerce.number().int().min(0).max(600).default(0),
  thumbnail: z.string().max(500).optional(),
})

/** The test half. `questions` may be empty while the lesson is still a draft. */
export const onlineTestSchema = z.object({
  questions: z.array(questionSchema).max(300).default([]),
  passMark: z.coerce.number().int().min(1).max(100).default(DEFAULT_PASS_MARK),
  /** 0 means unlimited. */
  maxAttempts: z.coerce.number().int().min(0).default(0),
  timeLimitMinutes: z.coerce.number().int().min(0).default(0),
})

/** The kutubxona half — the handouts that belong to this lesson. */
export const onlineMaterialSchema = z.object({
  /** Stable across edits so reordering never re-points a link. */
  key: z.string().trim().min(1).max(24),
  title: localizedSchema,
  type: z.enum(MATERIAL_TYPES),
  fileUrl: z.string().trim().min(1).max(500),
})

export const createOnlineLessonSchema = z.object({
  /**
   * The owning course. It is what gives the lesson its place in the chain —
   * `order` is a position *within this course*, and the unlock walk runs over
   * it. Access is a separate list below, so a lesson written for General
   * English can still be opened by an IELTS group without confusing whose
   * sequence it belongs to.
   */
  courseId: objectIdSchema,
  title: localizedSchema,
  description: localizedOptionalSchema,

  video: onlineVideoSchema.nullish(),
  test: onlineTestSchema.nullish(),
  materials: z.array(onlineMaterialSchema).max(50).default([]),

  /**
   * Who may open it. Empty means nobody but the author — access is granted,
   * never assumed, which is the rule the video lessons already worked to.
   */
  accessCourseIds: z.array(objectIdSchema).max(100).default([]),
  /** The exception: a named student who is not on any of those courses. */
  accessStudentIds: z.array(objectIdSchema).max(500).default([]),
  /** Open to anyone signed in. Off by default (§17.4). */
  isFree: z.boolean().default(false),

  order: z.coerce.number().int().min(0).default(0),
  isPublished: z.boolean().default(false),
})

export const updateOnlineLessonSchema = createOnlineLessonSchema.partial()

export const onlineLessonQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  courseId: objectIdSchema.optional(),
  search: z.string().trim().max(120).optional(),
  isPublished: z.coerce.boolean().optional(),
})

export type CreateOnlineLessonInput = z.input<typeof createOnlineLessonSchema>
export type OnlineMaterialInput = z.infer<typeof onlineMaterialSchema>

/** What a student sees in the list — never the answer key. */
export type StudentOnlineLesson = {
  _id: string
  title: { uz: string; ru?: string; en?: string }
  description?: { uz: string; ru?: string; en?: string }
  order: number
  course: { _id: string; name: { uz: string; ru?: string; en?: string } } | null
  hasVideo: boolean
  durationMinutes: number
  thumbnail?: string
  materialCount: number
  questionCount: number
  passMark: number
  maxAttempts: number
  /** false until the previous test-bearing lesson is passed. */
  unlocked: boolean
  best: { score: number; passed: boolean; attemptId: string; submittedAt: string } | null
  attemptsUsed: number
  watched: boolean
}

import { z } from 'zod'
import { paginationSchema, objectIdSchema, localizedSchema, slugSchema } from './common.js'

/**
 * TZ §22 `teachers(profile)` and §17.3 Video.
 *
 * Two things the centre publishes rather than operates on: the teacher cards the
 * landing page shows, and the video lessons a student watches in their cabinet.
 *
 * A teacher *profile* is deliberately not a `User`. A `User` is a login with a
 * role; a profile is a marketing record — bio, certificates, a photo — and the
 * centre wants to show faces on the site before those people ever sign in, and
 * to keep showing them after someone's account is deactivated. `userId` links
 * the two when both exist.
 */

/* ── Teacher profiles ─────────────────────────────────────────────────── */

export const createTeacherProfileSchema = z.object({
  slug: slugSchema,
  fullName: z.string().trim().min(3, 'nameTooShort').max(120, 'nameTooLong'),
  role: localizedSchema,
  bio: localizedSchema.partial().optional(),
  subjects: z.array(z.string().trim().max(60)).max(12).default([]),
  certificates: z.array(z.string().trim().max(80)).max(12).default([]),
  experienceYears: z.coerce.number().int().min(0).max(70).default(0),
  photo: z.string().max(500).optional(),
  /** The staff account this profile belongs to, when they have one. */
  userId: objectIdSchema.optional(),
  branchIds: z.array(objectIdSchema).max(20).default([]),
  /** §6.2 — a profile can exist without being on the public site yet. */
  isPublic: z.boolean().default(true),
  order: z.coerce.number().int().default(0),
})
export type CreateTeacherProfileInput = z.infer<typeof createTeacherProfileSchema>

export const updateTeacherProfileSchema = createTeacherProfileSchema.partial()

export const teacherQuerySchema = paginationSchema.extend({
  isPublic: z.coerce.boolean().optional(),
})

/* ── Video lessons (§17.3) ────────────────────────────────────────────── */

/**
 * Where the video actually lives.
 *
 * §17.3 and §18 describe self-hosted HLS with a signed manifest, a short-TTL
 * key and a per-viewer watermark. That is a serious piece of infrastructure —
 * ffmpeg, object storage, a key endpoint — and it is not built. What is built
 * is the lesson *catalogue*: an embed from a provider the centre already uses,
 * or a direct file URL. `provider` is stored so the player knows what it is
 * holding and so the protected path can be added later without a migration.
 */
export const VIDEO_PROVIDERS = ['youtube', 'vimeo', 'file'] as const
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number]

export const createVideoLessonSchema = z.object({
  courseId: objectIdSchema,
  title: localizedSchema,
  description: localizedSchema.partial().optional(),
  provider: z.enum(VIDEO_PROVIDERS).default('youtube'),
  /**
   * The provider's id for a hosted video (`dQw4w9WgXcQ`), or a URL for `file`.
   * Kept as the bare id rather than a full watch URL so the player builds the
   * embed itself and a pasted link with tracking parameters cannot leak them.
   */
  videoId: z.string().trim().min(1, 'required').max(500),
  /** Minutes; shown on the card so a student can judge before starting. */
  durationMinutes: z.coerce.number().int().min(0).max(600).default(0),
  thumbnail: z.string().max(500).optional(),
  /** Position within the course, the same idea as a test module's order. */
  order: z.coerce.number().int().min(0).default(0),
  /** A lesson can be prepared before students are meant to see it. */
  isPublished: z.boolean().default(false),
  /**
   * Open to anyone signed in, rather than only to students enrolled on the
   * course. Off by default: §17.4 scopes content to the people who paid for it.
   */
  isFree: z.boolean().default(false),
  /**
   * D1 — the explicit access allow-list: which groups may watch this lesson.
   * Default empty, meaning "no access until granted" for a lesson created
   * after this field existed. Editable after creation (D1's "access list
   * editable later").
   */
  groupIds: z.array(objectIdSchema).max(200).default([]),
})
export type CreateVideoLessonInput = z.infer<typeof createVideoLessonSchema>

export const updateVideoLessonSchema = createVideoLessonSchema.partial().omit({ courseId: true })

export const videoLessonQuerySchema = paginationSchema.extend({
  courseId: objectIdSchema.optional(),
  isPublished: z.coerce.boolean().optional(),
})

/**
 * Watch telemetry (§17.4 / §23 `POST /materials/:id/log`).
 *
 * Seconds watched rather than a boolean "done": a student who opens a lesson and
 * closes it after ten seconds has not watched it, and a completion flag cannot
 * tell the difference.
 */
export const logWatchSchema = z.object({
  seconds: z.coerce.number().int().min(0).max(60 * 60 * 12),
  completed: z.boolean().default(false),
})

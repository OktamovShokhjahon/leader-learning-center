/**
 * C — Grading ("Baho"). Distinct from the future themed-exam/ranking module
 * (§16): this is routine per-lesson classroom grading, entered by the
 * subject teacher for the whole group in one sitting, not a periodic test.
 */
import { z } from 'zod'
import { objectIdSchema } from './common.js'

/** A 5-point scale, matching the school-grade convention used in the region. */
export const GRADE_MIN = 1
export const GRADE_MAX = 5

export const gradeEntrySchema = z.object({
  studentId: objectIdSchema,
  value: z.coerce.number().int().min(GRADE_MIN).max(GRADE_MAX),
  comment: z.string().trim().max(300).optional(),
})

/** C1 — bulk entry for one lesson, the whole group in one request. */
export const markGradesSchema = z.object({
  lessonId: objectIdSchema,
  entries: z.array(gradeEntrySchema).min(1, 'required').max(60),
})
export type MarkGradesInput = z.input<typeof markGradesSchema>

export const gradeQuerySchema = z.object({
  groupId: objectIdSchema.optional(),
  studentId: objectIdSchema.optional(),
  lessonId: objectIdSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

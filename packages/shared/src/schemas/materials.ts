import { z } from 'zod'
import { paginationSchema, objectIdSchema, localizedSchema } from './common.js'

export const MATERIAL_TYPES = ['pdf', 'audio', 'video'] as const
export type MaterialType = (typeof MATERIAL_TYPES)[number]

export const createMaterialSchema = z.object({
  title: localizedSchema,
  description: localizedSchema.partial().optional(),
  type: z.enum(MATERIAL_TYPES),
  section: z.string().trim().min(1).max(80).default('General'),
  fileUrl: z.string().trim().min(1).max(500),
  coverUrl: z.string().max(500).optional(),
  courseIds: z.array(objectIdSchema).max(50).default([]),
  order: z.coerce.number().int().min(0).default(0),
  isPublished: z.boolean().default(false),
  /** Open to any signed-in student, not just enrolled courses. */
  isFree: z.boolean().default(false),
})
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>

export const updateMaterialSchema = createMaterialSchema.partial()

export const materialQuerySchema = paginationSchema.extend({
  type: z.enum(MATERIAL_TYPES).optional(),
  section: z.string().trim().max(80).optional(),
  isPublished: z.coerce.boolean().optional(),
})

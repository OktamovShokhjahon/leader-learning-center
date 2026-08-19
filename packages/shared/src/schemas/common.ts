/**
 * TZ §23 — "Lists are paginated: `?page=1&limit=25&sort=-createdAt&search=&branchId=`."
 *
 * One schema for every list endpoint, so a client that can page through students
 * can page through anything.
 */
import { z } from 'zod'
import { LOCALES } from '../locales.js'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'invalidId')

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  /**
   * Capped at 100. Without a ceiling, `?limit=100000` is a one-request denial of
   * service against a collection with tens of thousands of attendance rows.
   */
  limit: z.coerce.number().int().min(1).max(100).default(25),
  /** `-field` for descending, matching the §23 example. */
  sort: z
    .string()
    .regex(/^-?[a-zA-Z][\w.]*$/, 'invalidSort')
    .default('-createdAt'),
  search: z.string().trim().max(120).optional(),
  branchId: objectIdSchema.optional(),
})
export type PaginationQuery = z.infer<typeof paginationSchema>

export type Paginated<T> = {
  items: T[]
  page: number
  limit: number
  total: number
  pages: number
}

/** Turns `-createdAt` into what Mongoose's `.sort()` expects. */
export function parseSort(sort: string): Record<string, 1 | -1> {
  return sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 }
}

/** The localised field shape used by every dynamic document (§21.2). */
export const localizedSchema = z.object({
  uz: z.string().trim().min(1, 'required'),
  ru: z.string().trim().optional(),
  en: z.string().trim().optional(),
})

export const localizedOptionalSchema = localizedSchema.partial().optional()

/** A URL-safe slug: lower case, digits and single hyphens. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'slugTooShort')
  .max(60, 'slugTooLong')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'invalidSlug')

export const localeSchema = z.enum(LOCALES)

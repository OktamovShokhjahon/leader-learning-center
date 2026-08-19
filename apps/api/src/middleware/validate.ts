import type { RequestHandler } from 'express'
import type { ZodSchema } from 'zod'

/**
 * TZ §7.1 — the API validates with the *same* zod schema the browser used.
 * The parsed (and therefore normalised — e.g. phone → +998XXXXXXXXX) value
 * replaces the raw body, so services never see unvalidated input.
 */
export function validateBody(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      next(result.error)
      return
    }
    req.body = result.data
    next()
  }
}

/**
 * Express 5 exposes `req.query` as a getter, so the parsed value is stashed on
 * `res.locals.query` rather than written back over the original.
 */
export function validateQuery(schema: ZodSchema): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      next(result.error)
      return
    }
    res.locals.query = result.data
    next()
  }
}

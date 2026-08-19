import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import { env } from '../config/env.js'
import { logger } from '../config/logger.js'

/** TZ §23 — every error leaves the API in the same envelope shape. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json(error.toBody())
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Validation failed',
        details: error.flatten().fieldErrors,
      },
    })
    return
  }

  logger.error({ err: error }, 'unhandled error')
  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL,
      message: env.isProduction ? 'Internal server error' : String(error),
    },
  })
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: ERROR_CODES.NOT_FOUND, message: `No route for ${req.method} ${req.path}` },
  })
}

/** Express 5 forwards async rejections automatically, but this keeps intent explicit. */
export function asyncRoute<T extends RequestHandler>(handler: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

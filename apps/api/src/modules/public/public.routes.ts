import { Router, type RequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import { quickLeadSchema, leadSchema, contactSchema } from '@leader/shared/schemas'
import { ERROR_CODES } from '@leader/shared/errors'
import { validateBody } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { createPublicLead } from '../leads/lead.service.js'
import { Branch } from '../branches/branch.model.js'
import { logger } from '../../config/logger.js'

/**
 * TZ §23 — `PUBLIC (no auth, rate-limited)`.
 *
 * These are the only endpoints reachable without a token, so they carry the
 * tightest rate limits and the strictest validation.
 */
export const publicRouter = Router()

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many applications from this address' },
  },
})

/**
 * The public form posts either the short home-page shape or the full three-step
 * shape (§6.2 §14 vs §7.1).
 *
 * These are discriminated on `branchSlug` rather than combined with
 * `z.union([...])`: a union failure reports only `invalid_union` at the root, so
 * `flatten().fieldErrors` comes back empty and the browser cannot highlight the
 * offending field. Choosing the schema up front keeps per-field errors intact.
 */
const pickLeadSchema: RequestHandler = (req, _res, next) => {
  const isFullForm = typeof req.body === 'object' && req.body !== null && 'branchSlug' in req.body
  return validateBody(isFullForm ? leadSchema : quickLeadSchema)(req, _res, next)
}

publicRouter.post(
  '/leads',
  submitLimiter,
  pickLeadSchema,
  asyncRoute(async (req, res) => {
    // §7.1 — honeypot. A filled value is a bot; answer 201 so it learns nothing.
    if (req.body.website) {
      logger.warn({ ip: req.ip }, 'honeypot triggered on public lead')
      res.status(201).json({ data: { ok: true } })
      return
    }

    // TODO (Phase 6): verify the Cloudflare Turnstile token and require a valid
    // SMS OTP before accepting. Both need accounts the client must supply (§31 Q5).

    const { lead, isReturning } = await createPublicLead(req.body, { ip: req.ip })

    res.status(201).json({
      data: { id: lead.id, status: lead.status, isReturning },
    })
  }),
)

publicRouter.post(
  '/contact',
  submitLimiter,
  validateBody(contactSchema),
  asyncRoute(async (req, res) => {
    if (req.body.website) {
      res.status(201).json({ data: { ok: true } })
      return
    }
    // Contact messages become a lead with source 'other' so nothing is lost in
    // an inbox nobody reads — the manager sees them on the same kanban (§7.2).
    const { lead } = await createPublicLead(
      {
        fullName: req.body.fullName,
        phone: req.body.phone,
        courseSlug: 'aloqa',
        comment: req.body.message,
        consent: true,
        locale: 'uz',
      } as never,
      { ip: req.ip },
    )
    res.status(201).json({ data: { id: lead.id } })
  }),
)

/** §23 — `GET /public/branches`. The site will read branches from here instead of fixtures. */
publicRouter.get(
  '/branches',
  asyncRoute(async (_req, res) => {
    const branches = await Branch.find({ isActive: true, deletedAt: null })
      .select('slug name city address phones workingHours geo accentHue openedAt')
      .sort({ createdAt: 1 })
      .lean()
    res.json({ data: branches })
  }),
)

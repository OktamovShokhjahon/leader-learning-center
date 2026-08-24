import { Router } from 'express'
import { z } from 'zod'
import { upsertSettingSchema, isSettingKey, type SettingKey } from '@leader/shared/settings'
import { ApiError } from '@leader/shared/errors'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js'
import { listSettings, setSetting, clearSetting, settingsHealth } from './settings.service.js'

/**
 * TZ §21.1 — `SETTINGS (superadmin)`.
 *
 * `requireRole('superadmin')` at mount level rather than a per-route
 * permission, for the same reason §4.3 gives the finance router one: these keys
 * set discount ceilings and expense approval limits, so a mistake in a single
 * controller here is a mistake about money.
 */
export const settingsRouter = Router()

settingsRouter.use(requireAuth)
settingsRouter.use(requireRole('superadmin'))

const scopeQuerySchema = z.object({
  branchId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'invalidBranchId')
    .optional(),
})

settingsRouter.get(
  '/',
  validateQuery(scopeQuerySchema),
  asyncRoute(async (_req, res) => {
    res.json({ data: await listSettings(res.locals.query.branchId) })
  }),
)

settingsRouter.get(
  '/health',
  asyncRoute(async (_req, res) => {
    res.json({ data: await settingsHealth() })
  }),
)

settingsRouter.patch(
  '/',
  validateBody(upsertSettingSchema),
  asyncRoute(async (req, res) => {
    const value = await setSetting(
      currentUser(req),
      req.body.key as SettingKey,
      req.body.value,
      req.body.branchId,
      req,
    )
    res.json({ data: { key: req.body.key, value } })
  }),
)

/** Deleting an override, not the key — it falls back to the centre-wide value. */
settingsRouter.delete(
  '/:key',
  validateQuery(scopeQuerySchema),
  asyncRoute(async (req, res) => {
    const key = String(req.params.key)
    if (!isSettingKey(key)) throw ApiError.notFound('Unknown setting')

    const value = await clearSetting(currentUser(req), key, res.locals.query.branchId, req)
    res.json({ data: { key, value } })
  }),
)

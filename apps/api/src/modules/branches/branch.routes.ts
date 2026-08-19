import { Router } from 'express'
import { paginationSchema, createBranchSchema, updateBranchSchema } from '@leader/shared/schemas'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requirePermission, currentUser } from '../../middleware/auth.js'
import {
  listBranches,
  getBranch,
  createBranch,
  updateBranch,
  archiveBranch,
} from './branch.service.js'

/**
 * TZ §23 — `BRANCHES (superadmin)`.
 *
 * Reading is *not* superadmin-only: an Admin needs their own branch's address
 * and settings to do their job, and the service narrows the list to the branches
 * they hold a role in. Every mutation carries `branch.manage`, which §4.2 grants
 * to SuperAdmin alone.
 */
export const branchRouter = Router()

branchRouter.use(requireAuth)

branchRouter.get(
  '/',
  validateQuery(paginationSchema),
  asyncRoute(async (req, res) => {
    res.json({ data: await listBranches(currentUser(req), res.locals.query) })
  }),
)

branchRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    res.json({ data: await getBranch(currentUser(req), String(req.params.id)) })
  }),
)

branchRouter.post(
  '/',
  requirePermission('branch.manage'),
  validateBody(createBranchSchema),
  asyncRoute(async (req, res) => {
    const branch = await createBranch(currentUser(req), req.body, req)
    res.status(201).json({ data: branch })
  }),
)

branchRouter.patch(
  '/:id',
  requirePermission('branch.manage'),
  validateBody(updateBranchSchema),
  asyncRoute(async (req, res) => {
    const branch = await updateBranch(currentUser(req), String(req.params.id), req.body, req)
    res.json({ data: branch })
  }),
)

/** §4.2 calls this "archive" — it is a soft delete, never a destructive one. */
branchRouter.delete(
  '/:id',
  requirePermission('branch.manage'),
  asyncRoute(async (req, res) => {
    await archiveBranch(currentUser(req), String(req.params.id), req)
    res.json({ data: { archived: true } })
  }),
)

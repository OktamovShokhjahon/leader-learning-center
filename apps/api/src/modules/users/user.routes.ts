import { Router } from 'express'
import { z } from 'zod'
import {
  paginationSchema,
  createUserSchema,
  updateUserSchema,
  updateRolesSchema,
  resetPasswordSchema,
} from '@leader/shared/schemas'
import { ROLES } from '@leader/shared/permissions'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requirePermission, currentUser } from '../../middleware/auth.js'
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  updateRoles,
  resetPassword,
  deactivateUser,
} from './user.service.js'

/**
 * TZ §23 — `STAFF`.
 *
 * The route guard is `staff.createTeacher`, the weakest grant in the §4.2 Staff
 * block, so an Admin gets through the door; the service then decides which roles
 * they may actually hand out. Putting that decision in the service is deliberate
 * — it depends on the role in the request body, which a route guard cannot see.
 */
export const userRouter = Router()

userRouter.use(requireAuth)

const listQuerySchema = paginationSchema.extend({ role: z.enum(ROLES).optional() })

userRouter.get(
  '/',
  requirePermission('staff.createTeacher'),
  validateQuery(listQuerySchema),
  asyncRoute(async (req, res) => {
    res.json({ data: await listUsers(currentUser(req), res.locals.query) })
  }),
)

userRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    // No permission guard: the service already limits this to the actor
    // themselves, or to someone sharing a branch with them.
    res.json({ data: await getUser(currentUser(req), String(req.params.id)) })
  }),
)

userRouter.post(
  '/',
  requirePermission('staff.createTeacher'),
  validateBody(createUserSchema),
  asyncRoute(async (req, res) => {
    const user = await createUser(currentUser(req), req.body, req)
    res.status(201).json({ data: user })
  }),
)

userRouter.patch(
  '/:id',
  requirePermission('staff.createTeacher'),
  validateBody(updateUserSchema),
  asyncRoute(async (req, res) => {
    res.json({ data: await updateUser(currentUser(req), String(req.params.id), req.body, req) })
  }),
)

userRouter.patch(
  '/:id/roles',
  requirePermission('staff.createTeacher'),
  validateBody(updateRolesSchema),
  asyncRoute(async (req, res) => {
    const user = await updateRoles(currentUser(req), String(req.params.id), req.body.roles, req)
    res.json({ data: user })
  }),
)

userRouter.post(
  '/:id/password',
  requirePermission('staff.createTeacher'),
  validateBody(resetPasswordSchema),
  asyncRoute(async (req, res) => {
    await resetPassword(currentUser(req), String(req.params.id), req.body, req)
    res.json({ data: { ok: true } })
  }),
)

const deactivateSchema = z.object({ reason: z.string().trim().max(500).optional() })

userRouter.delete(
  '/:id',
  requirePermission('staff.createTeacher'),
  validateBody(deactivateSchema),
  asyncRoute(async (req, res) => {
    await deactivateUser(currentUser(req), String(req.params.id), req.body.reason, req)
    res.json({ data: { deactivated: true } })
  }),
)

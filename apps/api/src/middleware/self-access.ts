import type { RequestHandler, Request } from 'express'
import { ApiError } from '@leader/shared/errors'
import { can, type Action } from '@leader/shared/permissions'
import { Student } from '../modules/students/student.model.js'
import { currentUser } from './auth.js'

/**
 * TZ §4.2 — a student and a parent hold `attendance.viewOwn`, not
 * `student.manage`. They must be able to open their own cabinet and nothing
 * else.
 *
 * `requirePermission('student.manage')` alone locks a learner out of their own
 * record; dropping the guard opens everyone's. This resolves the middle case:
 * the request is allowed if the caller holds the staff permission **or** the
 * record being asked for is the caller's own.
 */

/** The student record linked to this login, if there is one. Cached per request. */
async function ownStudentId(req: Request): Promise<string | null> {
  const cached = (req as Request & { _ownStudentId?: string | null })._ownStudentId
  if (cached !== undefined) return cached

  const user = currentUser(req)
  const student = await Student.findOne({ userId: user._id, deletedAt: null })
    .select('_id')
    .lean()

  const id = student?._id.toString() ?? null
  ;(req as Request & { _ownStudentId?: string | null })._ownStudentId = id
  return id
}

/**
 * Allows the request when the caller holds `action`, or when the student being
 * addressed is the caller's own record.
 *
 * `resolveTarget` says where the student id lives on this route — the path for
 * `/students/:id`, the query for `/attendance/history?studentId=`.
 */
export function allowSelfOr(
  action: Action,
  resolveTarget: (req: Request) => string | undefined,
): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      const user = currentUser(req)
      const roles = user.roles.map((assignment) => assignment.role)

      if (roles.some((role) => can(role, action))) return next()

      const target = resolveTarget(req)
      const own = await ownStudentId(req)

      // No target means "everything", which self-access never grants.
      if (!target || !own || target !== own) {
        return next(ApiError.forbidden('You may only view your own record'))
      }

      next()
    })().catch(next)
  }
}

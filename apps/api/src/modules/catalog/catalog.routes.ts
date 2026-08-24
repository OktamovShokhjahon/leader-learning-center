import { Router } from 'express'
import {
  createCourseSchema,
  updateCourseSchema,
  courseQuerySchema,
  createRoomSchema,
  updateRoomSchema,
  paginationSchema,
  parseSort,
} from '@leader/shared/schemas'
import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import {
  requireAuth,
  requirePermission,
  requireFullGrant,
  requireSingleBranch,
  currentUser,
} from '../../middleware/auth.js'
import { getScope } from '../../middleware/branch-scope.js'
import { recordAudit, diff } from '../audit/audit.service.js'
import { Course, Room, Group } from '../groups/group.model.js'
import { Branch } from '../branches/branch.model.js'
import { isSuperadmin, branchIdsOf } from '../users/user.model.js'

/**
 * TZ §21.1 — "Courses and prices · Rooms".
 *
 * Both were readable and neither was writable: `Course` had a single
 * `GET /groups/catalog/courses`, and `Room` had no route at all, so a room could
 * only be referenced by an id nobody had a way to create. The group form and
 * the schedule grid both need these to exist first, which is why they land here
 * rather than alongside the screens that consume them.
 *
 * Courses are **not** branch-scoped — a course is the centre's catalogue and the
 * per-branch price lives on the group (§5.3). Rooms are, because a room is a
 * physical thing in one building.
 */
export const courseRouter = Router()
export const roomRouter = Router()

courseRouter.use(requireAuth)
roomRouter.use(requireAuth)

/* ── Courses ──────────────────────────────────────────────────────────────
 * Reading is open to any signed-in account: a teacher picking a course for a
 * test module and a manager building a group both need the list. Writing is
 * `content.manage`, which §4.2 gives to SuperAdmin. A teacher holds it
 * `limited` — for their own group material folder (note 7), not for the
 * centre's catalogue — so these carry `requireFullGrant`, not `requirePermission`.
 */

courseRouter.get(
  '/',
  validateQuery(courseQuerySchema),
  asyncRoute(async (_req, res) => {
    const query = res.locals.query
    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.isPublic !== undefined) filter.isPublic = query.isPublic
    if (query.search) {
      const term = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { 'name.uz': { $regex: term, $options: 'i' } },
        { 'name.ru': { $regex: term, $options: 'i' } },
        { slug: { $regex: term, $options: 'i' } },
      ]
    }

    const [items, total] = await Promise.all([
      Course.find(filter)
        .sort(parseSort(query.sort === '-createdAt' ? 'order' : query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Course.countDocuments(filter),
    ])

    res.json({
      data: { items, total, page: query.page, limit: query.limit, pages: Math.max(1, Math.ceil(total / query.limit)) },
    })
  }),
)

courseRouter.post(
  '/',
  requireFullGrant('content.manage'),
  validateBody(createCourseSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    if (await Course.exists({ slug: req.body.slug, deletedAt: null })) {
      throw ApiError.conflict('A course with this address already exists', { slug: req.body.slug })
    }

    const course = await Course.create({ ...req.body, createdBy: actor._id })
    await recordAudit({
      action: 'course.create',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Course',
      entityId: course._id,
      after: { slug: course.slug, name: course.name },
      req,
    })
    res.status(201).json({ data: course })
  }),
)

courseRouter.patch(
  '/:id',
  requireFullGrant('content.manage'),
  validateBody(updateCourseSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const course = await Course.findOne({ _id: req.params.id, deletedAt: null })
    if (!course) throw ApiError.notFound('Course not found')

    if (req.body.slug && req.body.slug !== course.slug) {
      if (await Course.exists({ slug: req.body.slug, deletedAt: null })) {
        throw ApiError.conflict('A course with this address already exists')
      }
    }

    const before = course.toObject()
    course.set({ ...req.body, updatedBy: actor._id })
    await course.save()

    const changes = diff(before as Record<string, unknown>, req.body)
    await recordAudit({
      action: 'course.update',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Course',
      entityId: course._id,
      before: changes.before,
      after: changes.after,
      req,
    })
    res.json({ data: course })
  }),
)

/**
 * Soft delete, and refused while groups still teach it — a dangling `courseId`
 * on a live group would break the group list rather than tidy the catalogue.
 */
courseRouter.delete(
  '/:id',
  requireFullGrant('content.manage'),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const course = await Course.findOne({ _id: req.params.id, deletedAt: null })
    if (!course) throw ApiError.notFound('Course not found')

    const inUse = await Group.countDocuments({
      courseId: course._id,
      deletedAt: null,
      status: { $in: ['planned', 'active'] },
    })
    if (inUse > 0) {
      throw ApiError.conflict(`${inUse} active group(s) still teach this course`, { groups: inUse })
    }

    course.deletedAt = new Date()
    course.updatedBy = actor._id
    await course.save()

    await recordAudit({
      action: 'course.delete',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Course',
      entityId: course._id,
      req,
    })
    res.json({ data: { deleted: true } })
  }),
)

/* ── Rooms ────────────────────────────────────────────────────────────────
 * Branch-scoped, so the plugin filters reads and stamps the branch on writes.
 * Guarded by `group.manage`, because a room exists to be timetabled.
 */

roomRouter.get(
  '/',
  validateQuery(paginationSchema),
  asyncRoute(async (req, res) => {
    const query = res.locals.query
    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.search) {
      filter.name = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    }

    // §5.1 — the scope plugin fills in the active branch, but an explicit
    // `branchId` in the filter wins. That is how the boss reads one branch's
    // rooms from the branches screen while sitting in the consolidated scope.
    // Anyone else asking after a branch they hold no role in simply keeps their
    // own: the picker on that screen never offers them another.
    if (query.branchId) {
      const actor = currentUser(req)
      if (isSuperadmin(actor) || branchIdsOf(actor).includes(query.branchId)) {
        filter.branchId = query.branchId
      }
    }

    const [items, total] = await Promise.all([
      Room.find(filter)
        .sort(parseSort(query.sort === '-createdAt' ? 'name' : query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Room.countDocuments(filter),
    ])

    res.json({
      data: { items, total, page: query.page, limit: query.limit, pages: Math.max(1, Math.ceil(total / query.limit)) },
    })
  }),
)

/**
 * `requireSingleBranch` is deliberately not mounted here.
 *
 * It would be the right guard if the active branch were the only way to say
 * where a room goes, but the boss adds rooms from the branches screen while in
 * the consolidated `'ALL'` scope, naming the branch per room. So the branch is
 * resolved from the body first and the scope second, and the request is refused
 * only when neither answers.
 */
roomRouter.post(
  '/',
  requirePermission('group.manage'),
  validateBody(createRoomSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const scope = getScope()?.branchId
    const branchId = req.body.branchId ?? (scope && scope !== 'ALL' ? scope : undefined)

    if (!branchId) {
      throw new ApiError(
        400,
        ERROR_CODES.BRANCH_SCOPE_REQUIRED,
        'Select a branch, or name one on the room',
      )
    }
    // Naming someone else's branch is the boss's privilege alone.
    if (!isSuperadmin(actor) && !branchIdsOf(actor).includes(branchId)) {
      throw ApiError.forbidden('You can only add rooms to your own branch')
    }
    if (!(await Branch.exists({ _id: branchId, deletedAt: null }))) {
      throw ApiError.badRequest('Unknown branch')
    }

    const room = await Room.create({ ...req.body, branchId, createdBy: actor._id })

    await recordAudit({
      action: 'room.create',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Room',
      entityId: room._id,
      after: { name: room.name, capacity: room.capacity },
      req,
    })
    res.status(201).json({ data: room })
  }),
)

roomRouter.patch(
  '/:id',
  requirePermission('group.manage'),
  validateBody(updateRoomSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const room = await Room.findOne({ _id: req.params.id, deletedAt: null })
    if (!room) throw ApiError.notFound('Room not found')

    const before = room.toObject()
    room.set({ ...req.body, updatedBy: actor._id })
    await room.save()

    const changes = diff(before as Record<string, unknown>, req.body)
    await recordAudit({
      action: 'room.update',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Room',
      entityId: room._id,
      before: changes.before,
      after: changes.after,
      req,
    })
    res.json({ data: room })
  }),
)

roomRouter.delete(
  '/:id',
  requirePermission('group.manage'),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const room = await Room.findOne({ _id: req.params.id, deletedAt: null })
    if (!room) throw ApiError.notFound('Room not found')

    const inUse = await Group.countDocuments({
      roomId: room._id,
      deletedAt: null,
      status: { $in: ['planned', 'active'] },
    })
    if (inUse > 0) {
      throw ApiError.conflict(`${inUse} active group(s) are timetabled in this room`, {
        groups: inUse,
      })
    }

    room.deletedAt = new Date()
    await room.save()

    await recordAudit({
      action: 'room.delete',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Room',
      entityId: room._id,
      req,
    })
    res.json({ data: { deleted: true } })
  }),
)

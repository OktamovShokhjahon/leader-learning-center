import { Router } from 'express'
import {
  createMaterialSchema,
  updateMaterialSchema,
  materialQuerySchema,
  parseSort,
} from '@leader/shared/schemas'
import { ApiError } from '@leader/shared/errors'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { asyncRoute } from '../../middleware/error-handler.js'
import { requireAuth, requireRole, currentUser } from '../../middleware/auth.js'
import { recordAudit, diff } from '../audit/audit.service.js'
import { Material } from './material.model.js'
import { Course, Enrollment, Group } from '../groups/group.model.js'
import { Student } from '../students/student.model.js'

export const materialRouter = Router()

materialRouter.use(requireAuth)

async function watchableCourseIds(userId: unknown): Promise<string[]> {
  const student = await Student.findOne({ userId, deletedAt: null }).select('_id').lean()
  if (!student) return []

  const enrolments = await Enrollment.find({ studentId: student._id, status: 'active' })
    .select('groupId')
    .lean()
  if (enrolments.length === 0) return []

  const groups = await Group.find({ _id: { $in: enrolments.map((e) => e.groupId) } })
    .select('courseId')
    .lean()
  return groups.map((group) => group.courseId?.toString()).filter(Boolean) as string[]
}

/** Student library — published items for their courses (or free). */
materialRouter.get(
  '/mine',
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const courseIds = await watchableCourseIds(actor._id)

    const materials = await Material.find({
      deletedAt: null,
      isPublished: true,
      $or: [{ isFree: true }, { courseIds: { $in: courseIds } }, { courseIds: { $size: 0 } }],
    })
      .sort({ section: 1, order: 1 })
      .lean()

    const courses = await Course.find({
      _id: { $in: materials.flatMap((m) => m.courseIds ?? []) },
    })
      .select('name slug')
      .lean()

    res.json({
      data: materials.map((material) => ({
        ...material,
        courses: (material.courseIds ?? [])
          .map((id) => courses.find((c) => c._id.toString() === id?.toString()))
          .filter(Boolean),
      })),
    })
  }),
)

const bossOnly = requireRole('superadmin')

materialRouter.get(
  '/',
  bossOnly,
  validateQuery(materialQuerySchema),
  asyncRoute(async (_req, res) => {
    const query = res.locals.query
    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.type) filter.type = query.type
    if (query.section) filter.section = query.section
    if (query.isPublished !== undefined) filter.isPublished = query.isPublished

    const [items, total] = await Promise.all([
      Material.find(filter)
        .sort(parseSort(query.sort === '-createdAt' ? 'order' : query.sort))
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Material.countDocuments(filter),
    ])

    res.json({
      data: {
        items,
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    })
  }),
)

materialRouter.post(
  '/',
  bossOnly,
  validateBody(createMaterialSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const material = await Material.create({ ...req.body, createdBy: actor._id })
    await recordAudit({
      action: 'material.create',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Material',
      entityId: material._id,
      after: { title: material.title?.uz, type: material.type },
      req,
    })
    res.status(201).json({ data: material })
  }),
)

materialRouter.patch(
  '/:id',
  bossOnly,
  validateBody(updateMaterialSchema),
  asyncRoute(async (req, res) => {
    const actor = currentUser(req)
    const material = await Material.findOne({ _id: req.params.id, deletedAt: null })
    if (!material) throw ApiError.notFound('Material not found')

    const before = material.toObject()
    material.set({ ...req.body, updatedBy: actor._id })
    await material.save()

    const changes = diff(before as Record<string, unknown>, req.body)
    await recordAudit({
      action: 'material.update',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Material',
      entityId: material._id,
      before: changes.before,
      after: changes.after,
      req,
    })
    res.json({ data: material })
  }),
)

materialRouter.delete(
  '/:id',
  bossOnly,
  asyncRoute(async (req, res) => {
    const material = await Material.findOne({ _id: req.params.id, deletedAt: null })
    if (!material) throw ApiError.notFound('Material not found')

    material.deletedAt = new Date()
    await material.save()

    await recordAudit({
      action: 'material.delete',
      actorId: currentUser(req)._id,
      actorName: currentUser(req).fullName,
      entity: 'Material',
      entityId: material._id,
      req,
    })
    res.json({ data: { deleted: true } })
  }),
)

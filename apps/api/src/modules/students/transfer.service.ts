import { Types } from 'mongoose'
import { ApiError } from '@leader/shared/errors'
import { Student } from './student.model.js'
import { Group, Enrollment } from '../groups/group.model.js'
import { Invoice } from '../payments/invoice.model.js'
import { Branch } from '../branches/branch.model.js'
import { withAllBranches } from '../../middleware/branch-scope.js'
import { recordAudit, type RequestMeta } from '../audit/audit.service.js'
import type { UserDocument } from '../users/user.model.js'

/**
 * TZ §23 — `POST /students/:id/transfer  { toBranchId | toGroupId }`, and §4.2
 * "Move student between groups / branches".
 *
 * This is in a service rather than the controller because it is the only
 * operation in the codebase that deliberately writes *across* a branch
 * boundary, and §5.1 requires every such crossing to be explicit and logged.
 * Burying that in a route handler would hide the one place the scope rule bends.
 *
 * What moves and what does not is the whole design:
 *
 * - **The student record moves.** Their history moves with it, because the
 *   history hangs off the student id, not off a branch column.
 * - **Open enrollments close.** A group belongs to one branch; a student cannot
 *   keep attending it from another. They are dropped with an end date, never
 *   deleted, so attendance already taken still reconciles.
 * - **Unpaid invoices follow the student. Settled ones do not.** A debt is owed
 *   to the centre and should chase the person; a payment already taken is a fact
 *   about the branch that took it, and moving it would silently rewrite that
 *   branch's collected revenue for a month that is already closed (§15).
 */

export type TransferInput = {
  toBranchId?: string
  toGroupId?: string
  reason?: string
}

export async function transferStudent(
  actor: UserDocument,
  studentId: string,
  input: TransferInput,
  req: RequestMeta,
) {
  if (!input.toBranchId && !input.toGroupId) {
    throw ApiError.badRequest('Name a target branch or a target group')
  }

  const student = await Student.findOne({ _id: studentId, deletedAt: null })
  if (!student) throw ApiError.notFound('Student not found')

  const fromBranchId = student.branchId?.toString()

  /* ── Group-only move, inside the same branch ─────────────────────────── */
  if (input.toGroupId && !input.toBranchId) {
    const group = await Group.findOne({ _id: input.toGroupId, deletedAt: null })
    if (!group) throw ApiError.notFound('Target group not found')
    if (group.branchId?.toString() !== fromBranchId) {
      throw ApiError.badRequest('That group is in another branch — transfer the branch instead')
    }

    const moved = await moveEnrollments(
      student._id,
      { _id: group._id, price: group.price, capacity: group.capacity },
      fromBranchId,
    )

    await recordAudit({
      action: 'student.transfer',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Student',
      entityId: student._id,
      branchId: student.branchId,
      before: { groups: moved.closed },
      after: { groupId: group.id, groupName: group.name },
      reason: input.reason,
      req,
    })

    return { student, movedInvoices: 0, closedEnrollments: moved.closed.length }
  }

  /* ── Branch move ─────────────────────────────────────────────────────── */
  const target = await Branch.findOne({ _id: input.toBranchId, deletedAt: null })
  if (!target) throw ApiError.notFound('Target branch not found')
  if (target._id.toString() === fromBranchId) {
    throw ApiError.badRequest('The student is already in that branch')
  }

  // §5.1 — the one documented crossing, and it is logged on every use.
  return withAllBranches(`student ${student.id} transferred to branch ${target.id}`, async () => {
    // Close every open enrollment: those groups stay in the old branch.
    const openEnrollments = await Enrollment.find({
      studentId: student._id,
      status: 'active',
    })
    const closedNames: string[] = []
    for (const enrollment of openEnrollments) {
      enrollment.status = 'dropped'
      enrollment.endDate = new Date()
      await enrollment.save()
      closedNames.push(enrollment.groupId?.toString() ?? '')
    }

    // Unpaid balances follow the person; settled invoices stay where the money
    // was actually taken, so no closed month is rewritten.
    const outstanding = await Invoice.updateMany(
      {
        studentId: student._id,
        status: { $in: ['pending', 'partial', 'overdue'] },
        deletedAt: null,
      },
      { $set: { branchId: target._id, groupId: null } },
    )

    student.branchId = target._id as unknown as Types.ObjectId
    student.updatedBy = actor._id
    await student.save()

    // If a target group was named too, enrol into it now that the branch matches.
    let joined: string | null = null
    if (input.toGroupId) {
      const group = await Group.findOne({ _id: input.toGroupId, deletedAt: null })
      if (!group) throw ApiError.notFound('Target group not found')
      if (group.branchId?.toString() !== target._id.toString()) {
        throw ApiError.badRequest('That group is not in the target branch')
      }
      await Enrollment.create({
        branchId: target._id,
        studentId: student._id,
        groupId: group._id,
        startDate: new Date(),
        price: group.price,
        status: 'active',
        createdBy: actor._id,
      })
      joined = group.name
    }

    await recordAudit({
      action: 'student.transfer',
      actorId: actor._id,
      actorName: actor.fullName,
      entity: 'Student',
      entityId: student._id,
      branchId: target._id,
      before: { branchId: fromBranchId, openEnrollments: closedNames.length },
      after: {
        branchId: target.id,
        movedInvoices: outstanding.modifiedCount,
        joinedGroup: joined,
      },
      reason: input.reason,
      req,
    })

    return {
      student,
      movedInvoices: outstanding.modifiedCount,
      closedEnrollments: closedNames.length,
    }
  })
}

/** Closes the student's current enrollments and opens one on `group`. */
async function moveEnrollments(
  studentId: Types.ObjectId,
  group: { _id: Types.ObjectId; price: number; capacity: number },
  branchId: string | undefined,
) {
  const enrolled = await Enrollment.countDocuments({ groupId: group._id, status: 'active' })
  if (enrolled >= group.capacity) throw ApiError.conflict('That group is full')

  const open = await Enrollment.find({ studentId, status: 'active' })
  const closed: string[] = []
  for (const enrollment of open) {
    if (enrollment.groupId?.toString() === group._id.toString()) continue
    enrollment.status = 'dropped'
    enrollment.endDate = new Date()
    await enrollment.save()
    closed.push(enrollment.groupId?.toString() ?? '')
  }

  const already = open.some((e) => e.groupId?.toString() === group._id.toString())
  if (!already) {
    await Enrollment.create({
      branchId,
      studentId,
      groupId: group._id,
      startDate: new Date(),
      price: group.price,
      status: 'active',
    })
  }

  return { closed }
}

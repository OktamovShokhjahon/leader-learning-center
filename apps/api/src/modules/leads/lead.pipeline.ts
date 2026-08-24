import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import type { UpdateLeadInput, ConvertLeadInput } from '@leader/shared/schemas'
import { Lead } from './lead.model.js'
import { Student } from '../students/student.model.js'
import { Group } from '../groups/group.model.js'
import { User } from '../users/user.model.js'
import { enrollStudent } from '../groups/group.service.js'
import { hashPassword } from '../auth/password.service.js'
import { recordAudit, type RequestMeta } from '../audit/audit.service.js'
import type { UserDocument } from '../users/user.model.js'

/**
 * TZ §7.2 — the lead pipeline's write side.
 *
 * Until now `leads` was read-only: an application could arrive and be listed,
 * and nothing could be done with it. §4.1 calls a Manager "reception /
 * call-centre, works with leads and payments", so this is the half of their job
 * that had no endpoints.
 *
 * Everything here appends to `history[]` rather than overwriting a field. The
 * funnel report (§20 Sales) is computed from that trail — time to first contact,
 * per-stage conversion, cost per lead — and a status field alone cannot answer
 * any of those questions.
 */

/** §7.2 — the statuses that mean this lead is finished with, either way. */
const TERMINAL: readonly string[] = ['oquvchi_boldi', 'rad_etdi']

export async function updateLead(
  actor: UserDocument,
  leadId: string,
  input: UpdateLeadInput,
  req: RequestMeta,
) {
  const lead = await Lead.findOne({ _id: leadId, deletedAt: null })
  if (!lead) throw ApiError.notFound('Lead not found')

  const before = {
    status: lead.status,
    assignedTo: lead.assignedTo?.toString(),
    nextActionAt: lead.nextActionAt,
  }

  if (input.status && input.status !== lead.status) {
    if (lead.status === 'oquvchi_boldi') {
      // Reopening a converted lead would let the same person be enrolled twice.
      throw ApiError.conflict('This lead has already become a student')
    }
    if (input.status === 'rad_etdi' && !input.rejectReason) {
      // §20 Sales — a refusal without a reason is a hole in the churn report.
      throw ApiError.badRequest('A reason is required when refusing a lead')
    }
    if (input.status === 'oquvchi_boldi') {
      // Conversion creates a student record, so it has its own endpoint rather
      // than being reachable by dragging a card into the last column.
      throw ApiError.badRequest('Use the convert action to turn a lead into a student')
    }

    lead.status = input.status
    lead.history.push({
      at: new Date(),
      actorId: actor._id,
      action: `status:${input.status}`,
      note: input.rejectReason ?? input.comment,
    })
  }

  if (input.assignedTo !== undefined) {
    if (input.assignedTo) {
      const owner = await User.findOne({ _id: input.assignedTo, deletedAt: null, isActive: true })
      if (!owner) throw ApiError.badRequest('That account cannot own a lead')
      lead.assignedTo = owner._id
    } else {
      lead.assignedTo = undefined
    }
    lead.history.push({
      at: new Date(),
      actorId: actor._id,
      action: input.assignedTo ? 'assigned' : 'unassigned',
    })
  }

  if (input.nextActionAt !== undefined) {
    lead.nextActionAt = input.nextActionAt ?? undefined
  }

  if (input.comment && !input.status) {
    lead.history.push({
      at: new Date(),
      actorId: actor._id,
      action: 'comment',
      note: input.comment,
    })
  }

  lead.updatedBy = actor._id
  await lead.save()

  await recordAudit({
    action: 'lead.update',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'Lead',
    entityId: lead._id,
    branchId: lead.branchId,
    before,
    after: { status: lead.status, assignedTo: lead.assignedTo?.toString() },
    req,
  })

  return lead
}

/** §7.2 — booking the trial lesson, and the status change that goes with it. */
export async function scheduleTrial(
  actor: UserDocument,
  leadId: string,
  input: { at: Date; groupId?: string; note?: string },
  req: RequestMeta,
) {
  const lead = await Lead.findOne({ _id: leadId, deletedAt: null })
  if (!lead) throw ApiError.notFound('Lead not found')
  if (TERMINAL.includes(lead.status)) {
    throw ApiError.conflict('This lead is already closed')
  }

  if (input.groupId && !(await Group.exists({ _id: input.groupId, deletedAt: null }))) {
    throw ApiError.badRequest('Unknown group')
  }

  lead.status = 'sinov_darsiga_yozildi'
  lead.nextActionAt = input.at
  lead.history.push({
    at: new Date(),
    actorId: actor._id,
    action: 'trial:scheduled',
    note: input.note ?? input.at.toISOString(),
  })
  lead.updatedBy = actor._id
  await lead.save()

  await recordAudit({
    action: 'lead.trial',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'Lead',
    entityId: lead._id,
    branchId: lead.branchId,
    after: { at: input.at, groupId: input.groupId },
    req,
  })

  return lead
}

/**
 * §23 — `POST /leads/:id/convert`.
 *
 * Idempotent by construction: a lead already carrying `convertedStudentId`
 * returns that student rather than minting a second one. A double-clicked
 * Convert button on a slow connection is the ordinary case, not the exotic one,
 * and two student records for one child is a mess that takes a human to unpick.
 */
export async function convertLead(
  actor: UserDocument,
  leadId: string,
  input: ConvertLeadInput,
  req: RequestMeta,
) {
  const lead = await Lead.findOne({ _id: leadId, deletedAt: null })
  if (!lead) throw ApiError.notFound('Lead not found')

  if (lead.convertedStudentId) {
    const existing = await Student.findById(lead.convertedStudentId)
    if (existing) return { student: existing, replayed: true }
  }

  // The phone is how the centre recognises a person; if a student already has
  // it, link rather than duplicate.
  const duplicate = await Student.findOne({ phone: lead.phone, deletedAt: null })
  if (duplicate) {
    lead.convertedStudentId = duplicate._id
    lead.status = 'oquvchi_boldi'
    lead.history.push({ at: new Date(), actorId: actor._id, action: 'converted:linked' })
    await lead.save()
    return { student: duplicate, replayed: true }
  }

  let group = null
  if (input.groupId) {
    group = await Group.findOne({ _id: input.groupId, deletedAt: null })
    if (!group) throw ApiError.badRequest('Unknown group')
  }

  const student = await Student.create({
    branchId: lead.branchId,
    fullName: lead.fullName,
    phone: lead.phone,
    age: lead.age,
    schoolClass: lead.schoolClass,
    status: 'pending',
    source: lead.source,
    joinedAt: new Date(),
    monthlyFee: input.monthlyFee ?? group?.price ?? 0,
    createdBy: actor._id,
  })

  if (group) {
    await enrollStudent(group.id, { studentId: student.id })
  }

  // §10.2 — a cabinet login, when the manager asked for one.
  if (input.createLogin && input.password) {
    if (await User.exists({ phone: lead.phone })) {
      throw new ApiError(
        409,
        ERROR_CODES.DUPLICATE_PHONE,
        'An account with this phone already exists',
      )
    }
    const account = await User.create({
      fullName: lead.fullName,
      phone: lead.phone,
      passwordHash: await hashPassword(input.password),
      roles: [{ role: 'student', branchId: lead.branchId }],
      locale: lead.locale ?? 'uz',
      createdBy: actor._id,
    })
    student.userId = account._id
    await student.save()
  }

  lead.convertedStudentId = student._id
  lead.status = 'oquvchi_boldi'
  lead.history.push({ at: new Date(), actorId: actor._id, action: 'converted' })
  lead.updatedBy = actor._id
  await lead.save()

  await recordAudit({
    action: 'lead.convert',
    actorId: actor._id,
    actorName: actor.fullName,
    entity: 'Lead',
    entityId: lead._id,
    branchId: lead.branchId,
    after: { studentId: student.id, groupId: group?.id, login: input.createLogin },
    req,
  })

  return { student, replayed: false }
}

/**
 * §20 Sales — leads by source and by manager, per-stage conversion, and time to
 * first contact.
 *
 * "Time to first contact" is read off `history[]` rather than stored, because
 * the moment that matters is the first entry that is not the creation itself,
 * and back-filling that as a column would make every existing lead look instant.
 */
export async function leadReport(from?: Date, to?: Date) {
  const match: Record<string, unknown> = { deletedAt: null }
  if (from || to) {
    match.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) }
  }

  const [bySource, byOwner, byStatus, leads] = await Promise.all([
    Lead.aggregate([{ $match: match }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$assignedTo', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.find(match).select('createdAt history status').lean(),
  ])

  const contactDelays = leads
    .map((lead) => {
      const firstTouch = lead.history?.find((entry) => entry.action !== 'created')
      if (!firstTouch?.at) return null
      return (new Date(firstTouch.at).getTime() - new Date(lead.createdAt).getTime()) / 3_600_000
    })
    .filter((hours): hours is number => hours !== null && Number.isFinite(hours))

  const total = leads.length
  const converted = leads.filter((lead) => lead.status === 'oquvchi_boldi').length

  return {
    total,
    converted,
    conversionRate: total > 0 ? Math.round((converted / total) * 1000) / 10 : 0,
    medianHoursToContact: median(contactDelays),
    bySource: bySource.map((row) => ({ source: row._id ?? 'unknown', count: row.count })),
    byOwner: byOwner.map((row) => ({ ownerId: row._id?.toString() ?? null, count: row.count })),
    byStatus: byStatus.map((row) => ({ status: row._id, count: row.count })),
  }
}

/** Median, not mean: one lead contacted after a three-week holiday skews a mean. */
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const value =
    sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
  return Math.round(value * 10) / 10
}

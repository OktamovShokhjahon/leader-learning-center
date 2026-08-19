import { ApiError, ERROR_CODES } from '@leader/shared/errors'
import type { QuickLeadInput, LeadInput } from '@leader/shared/schemas'
import { Lead } from './lead.model.js'
import { Branch } from '../branches/branch.model.js'
import { logger } from '../../config/logger.js'

type IncomingLead = (QuickLeadInput | LeadInput) & { phone: string; locale?: 'uz' | 'ru' | 'en' }

/**
 * TZ §7.1 — creating a lead from the public site.
 *
 * Duplicate detection: if the phone already exists as a lead, the record is
 * *merged, not duplicated*, and the manager sees "returning applicant".
 */
export async function createPublicLead(input: IncomingLead, meta: { ip?: string }) {
  const branchSlug = 'branchSlug' in input && input.branchSlug ? input.branchSlug : undefined

  // A branch is mandatory on every operational document (§5.1). The quick form
  // does not ask for one, so fall back to the first active branch.
  const branch = branchSlug
    ? await Branch.findOne({ slug: branchSlug, isActive: true })
    : await Branch.findOne({ isActive: true }).sort({ createdAt: 1 })

  if (!branch) {
    throw new ApiError(
      503,
      'NO_BRANCH_CONFIGURED',
      'No active branch is configured. Seed branches before accepting applications.',
    )
  }

  const existing = await Lead.findOne({ phone: input.phone, branchId: branch._id, deletedAt: null })

  if (existing) {
    existing.isReturning = true
    existing.fullName = input.fullName
    existing.courseSlug = input.courseSlug
    if (input.locale) existing.locale = input.locale
    existing.history.push({
      at: new Date(),
      action: 'reapplied',
      note: `Re-applied from the public site for ${input.courseSlug}`,
    })
    // A returning applicant goes back to the top of the funnel for the manager.
    if (existing.status === 'rad_etdi') existing.status = 'yangi'
    await existing.save()

    logger.info({ leadId: existing.id, phone: existing.phone }, 'returning applicant merged')
    return { lead: existing, isReturning: true }
  }

  const lead = await Lead.create({
    branchId: branch._id,
    branchSlug: branch.slug,
    fullName: input.fullName,
    phone: input.phone,
    courseSlug: input.courseSlug,
    ...('age' in input ? { age: input.age } : {}),
    ...('schoolClass' in input ? { schoolClass: input.schoolClass } : {}),
    ...('preferredDays' in input ? { preferredDays: input.preferredDays } : {}),
    ...('preferredTime' in input ? { preferredTime: input.preferredTime } : {}),
    ...('source' in input ? { source: input.source } : {}),
    ...('comment' in input ? { comment: input.comment } : {}),
    utm: input.utm,
    locale: input.locale ?? 'uz',
    status: 'yangi',
    ip: meta.ip,
    history: [{ at: new Date(), action: 'created', note: 'Submitted from the public site' }],
  })

  logger.info({ leadId: lead.id, branch: branch.slug }, 'lead created')

  // TODO (Phase 6, needs §31 Q5): notify branch managers in-app + Telegram and
  // send the applicant an SMS confirmation. Both require provider accounts.

  return { lead, isReturning: false }
}

export { ERROR_CODES }

import { AuditLog } from './audit.model.js'
import { getScope } from '../../middleware/branch-scope.js'
import { logger } from '../../config/logger.js'

/**
 * TZ §21.3 — the audit trail.
 *
 * Writing an audit entry must never break the action it records: a full disk or
 * a dropped connection should not turn a successful payment into a 500. Failures
 * are logged loudly and swallowed.
 */

/** Fields that must never reach the audit log even if a caller passes them. */
const REDACTED = new Set([
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'confirmPassword',
  'pin',
  'pinCodeHash',
  'secret',
  'token',
  'tokenHash',
  'otpCode',
  'totpCode',
  'recoveryCodes',
])

/**
 * The slice of a request the audit trail needs: IP and user-agent (§8).
 * Structural rather than `express.Request`, so services can be called from a
 * cron job or a migration with a hand-made object.
 */
export type RequestMeta = {
  ip?: string | undefined
  headers: { 'user-agent'?: string | string[] | undefined }
}

type AuditInput = {
  action: string
  entity?: string
  entityId?: unknown
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  branchId?: unknown
  actorId?: unknown
  actorName?: string
  outcome?: 'success' | 'failure'
  reason?: string
  req?: RequestMeta
}

function sanitize(value: Record<string, unknown> | undefined) {
  if (!value) return undefined
  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    output[key] = REDACTED.has(key) ? '[redacted]' : entry
  }
  return output
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const scope = getScope()
  try {
    await AuditLog.create({
      actorId: input.actorId ?? scope?.userId,
      role: scope?.role,
      actorName: input.actorName,
      branchId:
        input.branchId ??
        (scope?.branchId && scope.branchId !== 'ALL' ? scope.branchId : undefined),
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: sanitize(input.before),
      after: sanitize(input.after),
      ip: input.req?.ip,
      userAgent: [input.req?.headers['user-agent']].flat()[0],
      outcome: input.outcome ?? 'success',
      reason: input.reason,
      at: new Date(),
    })
  } catch (error) {
    logger.error({ err: error, action: input.action }, 'failed to write audit log')
  }
}

/**
 * Only the fields that actually changed, so an audit entry stays readable and
 * does not duplicate whole documents. Keys absent from `after` are ignored, which
 * makes this safe to call with a PATCH body.
 */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const changedBefore: Record<string, unknown> = {}
  const changedAfter: Record<string, unknown> = {}

  for (const key of Object.keys(after)) {
    const previous = before[key]
    const next = after[key]
    if (JSON.stringify(previous) === JSON.stringify(next)) continue
    changedBefore[key] = previous
    changedAfter[key] = next
  }

  return { before: changedBefore, after: changedAfter }
}

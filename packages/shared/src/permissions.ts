/**
 * TZ §4.2 / §4.3 — the single permission map, shared by the Next.js app and the
 * Express API so the two can never drift.
 *
 * The API is the source of truth. Hiding a button in the UI is a convenience,
 * never a security control: every controller runs `can()` before touching the
 * database, and finance routers additionally carry a hard superadmin guard.
 *
 * **The `admin` role of §4.1 no longer exists** — the centre asked for it to be
 * dropped and for SuperAdmin to absorb its duties, with Manager taking over the
 * front-desk half. See docs/adr/0004-remove-admin-role.md for what moved where.
 */

export const ROLES = ['superadmin', 'manager', 'teacher', 'student', 'parent'] as const
export type Role = (typeof ROLES)[number]

/** full = ✅ · limited = 🟡 (see LIMITS) · none = ❌ */
export type Grant = 'full' | 'limited' | 'none'

export const ACTIONS = [
  // Branches
  'branch.manage',
  'branch.switch',
  'branch.viewConsolidated',
  // Staff
  'staff.createManager',
  'staff.createTeacher',
  // Students & groups
  'student.manage',
  'group.manage',
  'student.transfer',
  // Leads
  'lead.manage',
  // Attendance
  'attendance.mark',
  'attendance.editAfter48h',
  'attendance.viewOwn',
  // Payments
  'payment.accept',
  'payment.approve',
  'debtor.view',
  'payment.refund',
  'student.setFee',
  'discount.give',
  // Fines
  'fine.configureRules',
  'fine.issue',
  'fine.cancel',
  'fine.viewOwn',
  // Expenses
  'expense.create',
  'expense.approve',
  'expense.viewBranchTotal',
  // Finance
  'finance.view',
  'salary.viewAny',
  'salary.viewOwn',
  'finance.compareBranches',
  // Content
  'content.manage',
  'test.manage',
  'content.consume',
  // Site
  'site.edit',
  // System
  'audit.view',
] as const
export type Action = (typeof ACTIONS)[number]

const F: Grant = 'full'
const L: Grant = 'limited'
const N: Grant = 'none'

/**
 * The §4.2 table, with the Admin column removed.
 *
 * Every ✅ Admin held is now SuperAdmin's alone, *except* the three the centre
 * moved to Manager: full group management, the lead pipeline, and payment
 * approval. Every 🟡 Admin held collapsed to SuperAdmin-only, because a limited
 * grant with nobody to hold it is just a footnote.
 */
export const PERMISSIONS: Record<Action, Record<Role, Grant>> = {
  'branch.manage': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'branch.switch': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'branch.viewConsolidated': { superadmin: F, manager: N, teacher: N, student: N, parent: N },

  /** §4.2 "Create Admin / Manager accounts: SuperAdmin only", minus the Admin. */
  'staff.createManager': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  /**
   * A Manager holds this as `limited`: the door is open, and `GRANTABLE_ROLES`
   * decides what may walk through it — teacher, student and parent accounts in
   * their own branch, never another Manager (note 11).
   */
  'staff.createTeacher': { superadmin: F, manager: L, teacher: N, student: N, parent: N },

  'student.manage': { superadmin: F, manager: F, teacher: N, student: N, parent: N },
  /**
   * Was 🟡 for a Manager — "may create a group but cannot set its price" (note
   * 1). The centre lifted that: a Manager assembles the group, so they set what
   * it costs too.
   */
  'group.manage': { superadmin: F, manager: F, teacher: N, student: N, parent: N },
  'student.transfer': { superadmin: F, manager: N, teacher: N, student: N, parent: N },

  /**
   * §4.1 calls a Manager "reception / call-centre, works with leads and
   * payments", so the funnel is theirs: status, owner, trial lesson, and the
   * conversion into a student.
   */
  'lead.manage': { superadmin: F, manager: F, teacher: N, student: N, parent: N },

  'attendance.mark': { superadmin: F, manager: F, teacher: F, student: N, parent: N },
  /** Deliberately not given to a Manager — a late edit rewrites history. */
  'attendance.editAfter48h': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'attendance.viewOwn': { superadmin: N, manager: N, teacher: N, student: F, parent: F },

  'payment.accept': { superadmin: F, manager: F, teacher: N, student: N, parent: N },
  'debtor.view': { superadmin: F, manager: F, teacher: L, student: N, parent: N },
  /**
   * Approving is an operational act on one payment, and with the Admin gone it
   * would otherwise land on the boss alone — so the front desk keeps it. §15
   * revenue, profit and payroll stay SuperAdmin-only, enforced separately by the
   * hard router guard, so approving a payment still reveals no centre finances.
   */
  'payment.approve': { superadmin: F, manager: F, teacher: N, student: N, parent: N },
  'payment.refund': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'student.setFee': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'discount.give': { superadmin: F, manager: N, teacher: N, student: N, parent: N },

  'fine.configureRules': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'fine.issue': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'fine.cancel': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'fine.viewOwn': { superadmin: N, manager: F, teacher: F, student: F, parent: F },

  'expense.create': { superadmin: F, manager: L, teacher: N, student: N, parent: N },
  'expense.approve': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'expense.viewBranchTotal': { superadmin: F, manager: N, teacher: N, student: N, parent: N },

  'finance.view': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'salary.viewAny': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
  'salary.viewOwn': { superadmin: F, manager: F, teacher: F, student: N, parent: N },
  'finance.compareBranches': { superadmin: F, manager: N, teacher: N, student: N, parent: N },

  'content.manage': { superadmin: F, manager: N, teacher: L, student: N, parent: N },
  /**
   * Online test modules are uploaded by the people who teach them and by the
   * boss. A teacher is `limited`: only for a course they actually teach (note 10).
   */
  'test.manage': { superadmin: F, manager: N, teacher: L, student: N, parent: N },
  'content.consume': { superadmin: F, manager: F, teacher: F, student: F, parent: N },

  'site.edit': { superadmin: F, manager: N, teacher: N, student: N, parent: N },

  'audit.view': { superadmin: F, manager: N, teacher: N, student: N, parent: N },
}

/**
 * The §4.2 notes that still have a holder. A `limited` grant is not a free pass:
 * these are the conditions the service layer must additionally enforce.
 *
 * Notes 1, 3, 4, 6, 8 and 9 are gone with the Admin role — each described a
 * limit on a grant nobody holds any more.
 */
export const LIMITS: Partial<Record<Action, string>> = {
  'debtor.view':
    'Teacher sees only a debt flag on students in their own groups — no amounts (note 2).',
  'expense.create':
    'Manager only from a whitelist of petty categories, under a per-transaction ceiling (note 5).',
  'content.manage':
    'Teacher may upload only to their own group material folder, subject to moderation (note 7).',
  'test.manage':
    'Teacher may author and publish test modules only for a course they teach (note 10).',
  'staff.createTeacher':
    'Manager may open teacher, student and parent accounts in their own branch, never another Manager (note 11).',
}

/** Defaults for the configurable ceilings referenced above; branch settings override them. */
export const DEFAULT_LIMITS = {
  discountCeilingPercent: 20,
  attendanceEditWindowHours: 48,
  overdueGraceDays: 3,
  lowAttendanceThresholdPercent: 70,
  teacherShare: 0.6,
} as const

/**
 * Deliberately tolerant of a role that is not in the map.
 *
 * `can()` is `grantFor(...) !== 'none'`, so a bare `PERMISSIONS[action][role]`
 * returning `undefined` for an unknown role would read as **true for every
 * action** — a retired role like `admin` sitting on an unmigrated account would
 * be promoted past every `requirePermission` check rather than locked out.
 * Falling back to `'none'` makes an unrecognised role powerless, which is the
 * only safe direction to fail.
 */
export function grantFor(role: Role, action: Action): Grant {
  return PERMISSIONS[action]?.[role] ?? 'none'
}

/** True for full and limited alike — a limited grant still needs its §4.2 note checked. */
export function can(role: Role, action: Action): boolean {
  return grantFor(role, action) !== 'none'
}

export function canFully(role: Role, action: Action): boolean {
  return grantFor(role, action) === 'full'
}

export function isLimited(role: Role, action: Action): boolean {
  return grantFor(role, action) === 'limited'
}

/**
 * §15 — every finance surface is guarded at the router level rather than per
 * controller, so a mistake in one controller cannot leak money data.
 */
export const SUPERADMIN_ONLY_ROUTE_PREFIXES = ['/finance', '/payroll', '/fine-rules'] as const

/** Documented exception: everyone sees their own payslip (§14.2). */
export const SUPERADMIN_ROUTE_EXCEPTIONS = ['/payroll/me'] as const

export function isSuperadminOnlyPath(path: string): boolean {
  if (SUPERADMIN_ROUTE_EXCEPTIONS.some((exception) => path.startsWith(exception))) return false
  return SUPERADMIN_ONLY_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/**
 * §4.2 Staff, plus note 11 — which roles each role may hand out.
 *
 * `staff.createTeacher` only opens the door; *this* decides what may walk
 * through it, and it lives here rather than in the API service so the "new
 * account" form offers exactly the roles the API would accept. The API still
 * checks it on every request — the form is a convenience, never the control.
 */
export const GRANTABLE_ROLES_MAP: Record<Role, readonly Role[]> = {
  // The boss account: every role, a second SuperAdmin included, in any branch.
  superadmin: ROLES,
  // Note 11 — a Manager enrols groups, so they open the teacher and student
  // accounts that go with them. Never another Manager: the people who could
  // then administer *them* are the boss's call alone.
  manager: ['teacher', 'student', 'parent'],
  teacher: [],
  student: [],
  parent: [],
}

/**
 * Same reasoning as `grantFor`: an unknown role hands out nothing, rather than
 * reading as `undefined` and blowing up in `.includes()` at the call site.
 */
export const GRANTABLE_ROLES: Record<Role, readonly Role[]> = new Proxy(GRANTABLE_ROLES_MAP, {
  get: (target, key: string) => target[key as Role] ?? [],
})

/**
 * How far up the ladder a role sits.
 *
 * Granting a role and administering an *existing* account are two different
 * questions, and `GRANTABLE_ROLES` only answers the first. Without a rank, a
 * Manager who may reach `PATCH /users/:id` could reset the password of another
 * Manager in the same branch — an escalation the grant check never sees,
 * because no role is being handed out.
 *
 * Student and parent share a rank: neither administers anyone.
 */
export const ROLE_RANK: Record<Role, number> = {
  superadmin: 4,
  manager: 3,
  teacher: 2,
  student: 1,
  parent: 1,
}

/** The rank an account acts at — the highest of the roles it holds. */
export function highestRank(roles: readonly Role[]): number {
  return roles.reduce((highest, role) => Math.max(highest, ROLE_RANK[role] ?? 0), 0)
}

/**
 * May an account holding `actorRoles` administer one holding `targetRoles`?
 *
 * Strictly below their own rank, and a SuperAdmin may act on anyone at all,
 * another SuperAdmin included. Acting on one's *own* account is a separate
 * question the caller answers — `updateRoles` and `deactivateUser` forbid it,
 * a profile edit allows it.
 */
export function mayAdminister(actorRoles: readonly Role[], targetRoles: readonly Role[]): boolean {
  if (actorRoles.includes('superadmin')) return true
  if (targetRoles.includes('superadmin')) return false
  return highestRank(targetRoles) < highestRank(actorRoles)
}

/** Which panel a role lands in after login (§24.1 route groups). */
export const HOME_PANEL: Record<Role, string> = {
  superadmin: '/boss',
  manager: '/crm',
  teacher: '/crm',
  student: '/cabinet',
  parent: '/cabinet',
}

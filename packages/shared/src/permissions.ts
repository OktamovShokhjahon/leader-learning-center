/**
 * TZ §4.2 / §4.3 — the single permission map, shared by the Next.js app and the
 * Express API so the two can never drift.
 *
 * The API is the source of truth. Hiding a button in the UI is a convenience,
 * never a security control: every controller runs `can()` before touching the
 * database, and finance routers additionally carry a hard superadmin guard.
 */

export const ROLES = ['superadmin', 'admin', 'manager', 'teacher', 'student', 'parent'] as const
export type Role = (typeof ROLES)[number]

/** full = ✅ · limited = 🟡 (see LIMITS) · none = ❌ */
export type Grant = 'full' | 'limited' | 'none'

export const ACTIONS = [
  // Branches
  'branch.manage',
  'branch.switch',
  'branch.viewConsolidated',
  // Staff
  'staff.createAdminOrManager',
  'staff.createTeacher',
  // Students & groups
  'student.manage',
  'group.manage',
  'student.transfer',
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

/** Reproduces the §4.2 table row for row. */
export const PERMISSIONS: Record<Action, Record<Role, Grant>> = {
  'branch.manage': { superadmin: F, admin: N, manager: N, teacher: N, student: N, parent: N },
  'branch.switch': { superadmin: F, admin: N, manager: N, teacher: N, student: N, parent: N },
  'branch.viewConsolidated': {
    superadmin: F,
    admin: N,
    manager: N,
    teacher: N,
    student: N,
    parent: N,
  },

  'staff.createAdminOrManager': {
    superadmin: F,
    admin: N,
    manager: N,
    teacher: N,
    student: N,
    parent: N,
  },
  /**
   * §4.2 gives this to SuperAdmin and Admin. The centre asked for a Manager to
   * be able to open teacher and student accounts as well — they are the people
   * who actually enrol a group — so a Manager holds it as `limited`: the door is
   * open, and `ROLES_GRANTABLE_BY` in the user service decides what they may
   * hand out through it (note 11).
   */
  'staff.createTeacher': { superadmin: F, admin: F, manager: L, teacher: N, student: N, parent: N },

  'student.manage': { superadmin: F, admin: F, manager: F, teacher: N, student: N, parent: N },
  'group.manage': { superadmin: F, admin: F, manager: L, teacher: N, student: N, parent: N },
  'student.transfer': { superadmin: F, admin: F, manager: N, teacher: N, student: N, parent: N },

  'attendance.mark': { superadmin: F, admin: F, manager: F, teacher: F, student: N, parent: N },
  'attendance.editAfter48h': {
    superadmin: F,
    admin: F,
    manager: N,
    teacher: N,
    student: N,
    parent: N,
  },
  'attendance.viewOwn': { superadmin: N, admin: N, manager: N, teacher: N, student: F, parent: F },

  'payment.accept': { superadmin: F, admin: F, manager: F, teacher: N, student: N, parent: N },
  'debtor.view': { superadmin: F, admin: F, manager: F, teacher: L, student: N, parent: N },
  /**
   * The client's rule: an Admin approves payments but never sees the centre's
   * finances. Approving is an operational act on one payment; §15 revenue,
   * profit and payroll stay SuperAdmin-only, and the router guard enforces that
   * separately from this map.
   */
  'payment.approve': { superadmin: F, admin: F, manager: N, teacher: N, student: N, parent: N },
  'payment.refund': { superadmin: F, admin: L, manager: N, teacher: N, student: N, parent: N },
  'student.setFee': { superadmin: F, admin: F, manager: N, teacher: N, student: N, parent: N },
  'discount.give': { superadmin: F, admin: L, manager: N, teacher: N, student: N, parent: N },

  'fine.configureRules': { superadmin: F, admin: N, manager: N, teacher: N, student: N, parent: N },
  'fine.issue': { superadmin: F, admin: F, manager: N, teacher: N, student: N, parent: N },
  'fine.cancel': { superadmin: F, admin: L, manager: N, teacher: N, student: N, parent: N },
  'fine.viewOwn': { superadmin: N, admin: F, manager: F, teacher: F, student: F, parent: F },

  'expense.create': { superadmin: F, admin: F, manager: L, teacher: N, student: N, parent: N },
  'expense.approve': { superadmin: F, admin: L, manager: N, teacher: N, student: N, parent: N },
  'expense.viewBranchTotal': {
    superadmin: F,
    admin: F,
    manager: N,
    teacher: N,
    student: N,
    parent: N,
  },

  'finance.view': { superadmin: F, admin: N, manager: N, teacher: N, student: N, parent: N },
  'salary.viewAny': { superadmin: F, admin: N, manager: N, teacher: N, student: N, parent: N },
  'salary.viewOwn': { superadmin: F, admin: F, manager: F, teacher: F, student: N, parent: N },
  'finance.compareBranches': {
    superadmin: F,
    admin: N,
    manager: N,
    teacher: N,
    student: N,
    parent: N,
  },

  'content.manage': { superadmin: F, admin: F, manager: N, teacher: L, student: N, parent: N },
  /**
   * Online test modules are uploaded by the people who teach them and by the
   * boss — the client was explicit that an Admin does not author tests.
   * A teacher is `limited`: only for a course they actually teach (note 10).
   */
  'test.manage': { superadmin: F, admin: N, manager: N, teacher: L, student: N, parent: N },
  'content.consume': { superadmin: F, admin: F, manager: F, teacher: F, student: F, parent: N },

  'site.edit': { superadmin: F, admin: L, manager: N, teacher: N, student: N, parent: N },

  'audit.view': { superadmin: F, admin: L, manager: N, teacher: N, student: N, parent: N },
}

/**
 * Notes 1–11 of §4.2. A `limited` grant is not a free pass: these are the
 * conditions the service layer must additionally enforce.
 */
export const LIMITS: Partial<Record<Action, string>> = {
  'group.manage': 'Manager may create a group but cannot set its price (note 1).',
  'debtor.view':
    'Teacher sees only a debt flag on students in their own groups — no amounts (note 2).',
  'payment.refund':
    'Admin only within the current calendar month; older records need SuperAdmin (note 3).',
  'fine.cancel':
    'Admin only within the current calendar month; older records need SuperAdmin (note 3).',
  'discount.give':
    'Admin up to a percentage ceiling configured by SuperAdmin, default 20% (note 4).',
  'expense.create':
    'Manager only from a whitelist of petty categories, under a per-transaction ceiling (note 5).',
  'expense.approve':
    'Admin approves up to a SuperAdmin-set ceiling; above it SuperAdmin approval is required (note 6).',
  'content.manage':
    'Teacher may upload only to their own group material folder, subject to admin moderation (note 7).',
  'site.edit':
    'Admin edits only their own branch page fragment: address, phone, photos, staff (note 8).',
  'audit.view': 'Admin sees only actions performed inside their own branch (note 9).',
  'test.manage':
    'Teacher may author and publish test modules only for a course they teach (note 10).',
  'staff.createTeacher':
    'Manager may open teacher, student and parent accounts in their own branch, never an Admin or a Manager (note 11).',
}

/** Defaults for the configurable ceilings referenced above; branch settings override them. */
export const DEFAULT_LIMITS = {
  discountCeilingPercent: 20,
  attendanceEditWindowHours: 48,
  overdueGraceDays: 3,
  lowAttendanceThresholdPercent: 70,
  teacherShare: 0.6,
} as const

export function grantFor(role: Role, action: Action): Grant {
  return PERMISSIONS[action][role]
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
export const GRANTABLE_ROLES: Record<Role, readonly Role[]> = {
  // The boss account: every role, a second SuperAdmin included, in any branch.
  superadmin: ROLES,
  // §4.2 grants an Admin `staff.createTeacher` and nothing above it. Students
  // and parents are accounts too, and creating those is part of enrolment.
  admin: ['teacher', 'student', 'parent'],
  // Note 11 — a Manager enrols groups, so they open the teacher and student
  // accounts that go with them. Never an Admin or another Manager: the people
  // who could then administer *them* are the boss's call alone.
  manager: ['teacher', 'student', 'parent'],
  teacher: [],
  student: [],
  parent: [],
}

/**
 * How far up the ladder a role sits.
 *
 * Granting a role and administering an *existing* account are two different
 * questions, and `GRANTABLE_ROLES` only answers the first. Without a rank, a
 * Manager who may now reach `PATCH /users/:id` could reset the password of the
 * Admin sitting in the same branch — an escalation the grant check never sees,
 * because no role is being handed out.
 *
 * Student and parent share a rank: neither administers anyone.
 */
export const ROLE_RANK: Record<Role, number> = {
  superadmin: 5,
  admin: 4,
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
export function mayAdminister(
  actorRoles: readonly Role[],
  targetRoles: readonly Role[],
): boolean {
  if (actorRoles.includes('superadmin')) return true
  if (targetRoles.includes('superadmin')) return false
  return highestRank(targetRoles) < highestRank(actorRoles)
}

/** Which panel a role lands in after login (§24.1 route groups). */
export const HOME_PANEL: Record<Role, string> = {
  superadmin: '/boss',
  admin: '/crm',
  manager: '/crm',
  teacher: '/crm',
  student: '/cabinet',
  parent: '/cabinet',
}

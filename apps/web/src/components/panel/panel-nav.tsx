'use client'

import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Wallet,
  AlertTriangle,
  CalendarCheck,
  PieChart,
  BadgeCheck,
  FileCheck2,
  UserRound,
  Video,
  UserSquare2,
  UsersRound,
  Inbox,
  Receipt,
  Gavel,
  BookOpen,
  Banknote,
  Building2,
  SlidersHorizontal,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'
import { can, canFully, type Role, type Action } from '@leader/shared/permissions'
import { Link, usePathname } from '@/i18n/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { BranchSwitcher } from './branch-switcher'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  key: string
  Icon: LucideIcon
  /** Shown only if the signed-in role holds this permission (§4.2). */
  action?: Action
  /** Require a *full* grant — a `limited` one is not enough for this section. */
  full?: boolean
  /** Or only to these roles outright. */
  roles?: Role[]
}

/**
 * TZ §1 — "every day-to-day action must be reachable in at most 2 clicks from
 * the dashboard". That is what this nav is for: the four things a person
 * actually does all day are top-level, not buried in a settings tree.
 *
 * Visibility is derived from the same `can()` map the API enforces with, so a
 * link never appears for someone who would get a 403 by following it. Hiding it
 * is a convenience, never the control (§4.3).
 */
const ITEMS: NavItem[] = [
  { href: '/crm', key: 'dashboard', Icon: LayoutDashboard, roles: ['manager', 'teacher'] },
  { href: '/crm/groups', key: 'groups', Icon: CalendarCheck, action: 'attendance.mark' },
  { href: '/crm/students', key: 'students', Icon: Users, action: 'student.manage' },
  { href: '/crm/payments', key: 'payments', Icon: Wallet, action: 'payment.accept' },
  { href: '/crm/debtors', key: 'debtors', Icon: AlertTriangle, action: 'debtor.view' },
  { href: '/crm/approvals', key: 'approvals', Icon: BadgeCheck, action: 'payment.approve' },
  { href: '/crm/tests', key: 'tests', Icon: FileCheck2, action: 'test.manage' },
  // §23 STAFF — the boss, an Admin and (note 11) a Manager all land on the same
  // screen; the API decides which accounts each of them gets back.
  { href: '/crm/leads', key: 'leads', Icon: Inbox, action: 'lead.manage' },
  { href: '/crm/expenses', key: 'expenses', Icon: Receipt, action: 'expense.create' },
  { href: '/crm/fines', key: 'fines', Icon: Gavel, action: 'fine.issue' },
  // §4.2 note 7 — a teacher's `content.manage` is for their own materials, not
  // for the centre's catalogue, so this one asks for the full grant.
  { href: '/crm/courses', key: 'courses', Icon: BookOpen, action: 'content.manage', full: true },
  { href: '/crm/staff', key: 'staff', Icon: UsersRound, action: 'staff.createTeacher' },
  // §21.1 / §14 / §21.3 / §5.3 — the boss's own corner.
  // §17.3 — the video lesson catalogue, and §21.1 the public teacher cards.
  // Both are the boss's alone, enforced at the router mount on the API.
  { href: '/boss/lessons', key: 'lessons', Icon: Video, roles: ['superadmin'] },
  { href: '/boss/library', key: 'libraryBoss', Icon: BookOpen, roles: ['superadmin'] },
  { href: '/boss/teachers', key: 'teacherProfiles', Icon: UserSquare2, roles: ['superadmin'] },
  { href: '/boss/payroll', key: 'payroll', Icon: Banknote, roles: ['superadmin'] },
  { href: '/boss/branches', key: 'branches', Icon: Building2, roles: ['superadmin'] },
  { href: '/boss/settings', key: 'settings', Icon: SlidersHorizontal, roles: ['superadmin'] },
  { href: '/boss/audit', key: 'audit', Icon: ScrollText, roles: ['superadmin'] },
  { href: '/boss', key: 'finance', Icon: PieChart, roles: ['superadmin'] },
  { href: '/cabinet', key: 'cabinet', Icon: GraduationCap, roles: ['student', 'parent'] },
  { href: '/cabinet/library', key: 'library', Icon: BookOpen, roles: ['student', 'parent'] },
  { href: '/cabinet/lessons', key: 'videoLessons', Icon: Video, roles: ['student', 'parent'] },
  { href: '/account', key: 'account', Icon: UserRound },
]

export function PanelNav() {
  const t = useTranslations('panel.nav')
  const pathname = usePathname()
  const { user } = useAuth()

  if (!user) return null
  const roles = user.roles.map((assignment) => assignment.role)

  const visible = ITEMS.filter((item) => {
    if (item.roles && !item.roles.some((role) => roles.includes(role))) return false
    if (item.action) {
      const check = item.full ? canFully : can
      if (!roles.some((role) => check(role, item.action!))) return false
    }
    return true
  })

  return (
    <nav
      aria-label={t('label')}
      className="sticky top-20 z-30 border-b border-border-subtle bg-background/88 backdrop-blur-xl"
    >
      <div className="container-site flex items-center gap-3 py-2">
        <div className="flex flex-1 gap-1 overflow-x-auto">
        {visible.map((item) => {
          // `/crm` must not light up on `/crm/students`, nor `/boss` on
          // `/boss/payroll` — both are section roots with siblings of their own.
          // A leaf like `/crm/students` still lights up on `/crm/students/42`.
          const isSectionRoot = item.href === '/crm' || item.href === '/boss'
          const active =
            pathname === item.href ||
            (!isSectionRoot && pathname.startsWith(`${item.href}/`))

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-pill px-4 py-2.5 text-xs font-medium transition-colors duration-200',
                active
                  ? 'bg-navy-600 text-white'
                  : 'text-ink-soft hover:bg-navy-50 hover:text-navy-700 dark:text-navy-200 dark:hover:bg-navy-800 dark:hover:text-white',
              )}
            >
              <item.Icon className="size-4" aria-hidden />
              {t(item.key)}
            </Link>
          )
        })}
        </div>

        {/* §5.2 — pinned outside the scroller: the branch in force has to stay
            visible while paging through the sections it scopes. */}
        <BranchSwitcher />
      </div>
    </nav>
  )
}

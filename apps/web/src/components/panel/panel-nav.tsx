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
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { can, type Role, type Action } from '@leader/shared/permissions'
import { Link, usePathname } from '@/i18n/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  key: string
  Icon: LucideIcon
  /** Shown only if the signed-in role holds this permission (§4.2). */
  action?: Action
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
  { href: '/crm', key: 'dashboard', Icon: LayoutDashboard, roles: ['admin', 'manager', 'teacher'] },
  { href: '/crm/groups', key: 'groups', Icon: CalendarCheck, action: 'attendance.mark' },
  { href: '/crm/students', key: 'students', Icon: Users, action: 'student.manage' },
  { href: '/crm/payments', key: 'payments', Icon: Wallet, action: 'payment.accept' },
  { href: '/crm/debtors', key: 'debtors', Icon: AlertTriangle, action: 'debtor.view' },
  { href: '/crm/approvals', key: 'approvals', Icon: BadgeCheck, action: 'payment.approve' },
  { href: '/crm/tests', key: 'tests', Icon: FileCheck2, action: 'test.manage' },
  // §23 STAFF — the boss, an Admin and (note 11) a Manager all land on the same
  // screen; the API decides which accounts each of them gets back.
  { href: '/crm/staff', key: 'staff', Icon: UsersRound, action: 'staff.createTeacher' },
  { href: '/boss', key: 'finance', Icon: PieChart, roles: ['superadmin'] },
  { href: '/cabinet', key: 'cabinet', Icon: GraduationCap, roles: ['student', 'parent'] },
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
    if (item.action && !roles.some((role) => can(role, item.action!))) return false
    return true
  })

  return (
    <nav
      aria-label={t('label')}
      className="sticky top-20 z-30 border-b border-border-subtle bg-background/88 backdrop-blur-xl"
    >
      <div className="container-site flex gap-1 overflow-x-auto py-2">
        {visible.map((item) => {
          // `/crm` must not light up on `/crm/students`, but `/crm/students/42` should.
          const active =
            pathname === item.href ||
            (item.href !== '/crm' && pathname.startsWith(`${item.href}/`))

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
    </nav>
  )
}

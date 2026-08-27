'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Wallet,
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  PieChart,
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
  Menu,
  X,
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

/** A labelled run of links. `key` resolves under `panel.navGroups`. */
type NavGroup = { key: string; items: NavItem[] }

/**
 * TZ §1 — "every day-to-day action must be reachable in at most 2 clicks from
 * the dashboard".
 *
 * This started as one horizontal strip of every link the role could see, which
 * worked at eight items and stopped working at twenty-four: the row scrolled
 * sideways, so half the product was behind a gesture with no affordance, and
 * `Payroll` sat between `Branches` and `Settings` for no reason a person could
 * name. Grouping the same links down a sidebar puts every one of them on
 * screen at once and says what each cluster is *for* — money, teaching,
 * content — which is the part a flat list cannot express.
 *
 * Visibility is derived from the same `can()` map the API enforces with, so a
 * link never appears for someone who would get a 403 by following it. Hiding it
 * is a convenience, never the control (§4.3).
 */
const GROUPS: NavGroup[] = [
  {
    key: 'overview',
    items: [
      { href: '/crm', key: 'dashboard', Icon: LayoutDashboard, roles: ['manager', 'teacher'] },
      { href: '/boss', key: 'finance', Icon: PieChart, roles: ['superadmin'] },
    ],
  },
  {
    key: 'academic',
    items: [
      { href: '/crm/groups', key: 'groups', Icon: CalendarCheck, action: 'attendance.mark' },
      { href: '/crm/schedule', key: 'schedule', Icon: CalendarClock, action: 'attendance.mark' },
      { href: '/crm/students', key: 'students', Icon: Users, action: 'student.manage' },
      { href: '/crm/tests', key: 'tests', Icon: FileCheck2, action: 'test.manage' },
    ],
  },
  {
    key: 'money',
    items: [
      { href: '/crm/payments', key: 'payments', Icon: Wallet, action: 'payment.accept' },
      { href: '/crm/debtors', key: 'debtors', Icon: AlertTriangle, action: 'debtor.view' },
      { href: '/crm/expenses', key: 'expenses', Icon: Receipt, action: 'expense.create' },
      { href: '/crm/fines', key: 'fines', Icon: Gavel, action: 'fine.issue' },
      { href: '/boss/payroll', key: 'payroll', Icon: Banknote, roles: ['superadmin'] },
    ],
  },
  {
    key: 'sales',
    items: [{ href: '/crm/leads', key: 'leads', Icon: Inbox, action: 'lead.manage' }],
  },
  {
    key: 'content',
    items: [
      // §4.2 note 7 — a teacher's `content.manage` is for their own materials, not
      // for the centre's catalogue, so this one asks for the full grant.
      { href: '/crm/courses', key: 'courses', Icon: BookOpen, action: 'content.manage', full: true },
      // §17.3 the video lesson catalogue, §21.1 the public teacher cards — both
      // the boss's alone, enforced at the router mount on the API.
      { href: '/boss/lessons', key: 'lessons', Icon: Video, roles: ['superadmin'] },
      { href: '/boss/library', key: 'libraryBoss', Icon: BookOpen, roles: ['superadmin'] },
      { href: '/boss/teachers', key: 'teacherProfiles', Icon: UserSquare2, roles: ['superadmin'] },
    ],
  },
  {
    key: 'cabinet',
    items: [
      { href: '/cabinet', key: 'cabinet', Icon: GraduationCap, roles: ['student', 'parent'] },
      { href: '/cabinet/library', key: 'library', Icon: BookOpen, roles: ['student', 'parent'] },
      { href: '/cabinet/lessons', key: 'videoLessons', Icon: Video, roles: ['student', 'parent'] },
    ],
  },
  {
    key: 'system',
    items: [
      // §23 STAFF — the boss and (note 11) a Manager land on the same screen;
      // the API decides which accounts each of them gets back.
      { href: '/crm/staff', key: 'staff', Icon: UsersRound, action: 'staff.createTeacher' },
      { href: '/boss/branches', key: 'branches', Icon: Building2, roles: ['superadmin'] },
      { href: '/boss/settings', key: 'settings', Icon: SlidersHorizontal, roles: ['superadmin'] },
      { href: '/boss/audit', key: 'audit', Icon: ScrollText, roles: ['superadmin'] },
      { href: '/account', key: 'account', Icon: UserRound },
    ],
  },
]

export function PanelNav() {
  const t = useTranslations('panel.nav')
  const tg = useTranslations('panel.navGroups')
  const pathname = usePathname()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  // Following a link on a phone should leave the drawer behind, not on top of
  // the page it just opened.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  if (!user) return null
  const roles = user.roles.map((assignment) => assignment.role)

  const allowed = (item: NavItem) => {
    if (item.roles && !item.roles.some((role) => roles.includes(role))) return false
    if (item.action) {
      const check = item.full ? canFully : can
      if (!roles.some((role) => check(role, item.action!))) return false
    }
    return true
  }

  // An empty group would otherwise render a heading with nothing under it.
  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(allowed),
  })).filter((group) => group.items.length > 0)

  const isActive = (href: string) => {
    // `/crm` must not light up on `/crm/students`, nor `/boss` on
    // `/boss/payroll` — both are section roots with siblings of their own.
    // A leaf like `/crm/students` still lights up on `/crm/students/42`.
    const isSectionRoot = href === '/crm' || href === '/boss'
    return pathname === href || (!isSectionRoot && pathname.startsWith(`${href}/`))
  }

  const links = (
    <div className="flex flex-col gap-6 px-3 py-5">
      {visibleGroups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1">
          <h2 className="px-3 pb-1 text-2xs font-medium uppercase tracking-[0.14em] text-ink-muted">
            {tg(group.key)}
          </h2>
          {group.items.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2.5 rounded-input px-3 py-2.5 text-xs font-medium transition-colors duration-200',
                  active
                    ? 'bg-navy-600 text-white'
                    : 'text-ink-soft hover:bg-navy-50 hover:text-navy-700 dark:text-navy-200 dark:hover:bg-navy-800 dark:hover:text-white',
                )}
              >
                <item.Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{t(item.key)}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )

  return (
    <>
      {/* Phones and small tablets: a slim bar under the header carrying the
          drawer toggle and — §5.2 — the branch in force, which has to stay
          visible whether or not the drawer is open. */}
      <div className="sticky top-20 z-30 border-b border-border-subtle bg-background/88 backdrop-blur-xl lg:hidden">
        <div className="container-site flex items-center gap-3 py-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="panel-nav-drawer"
            className="inline-flex h-10 items-center gap-2 rounded-pill border border-border-subtle px-3.5 text-2xs font-medium text-ink-soft dark:text-navy-200"
          >
            <Menu className="size-4" aria-hidden />
            {tg('menu')}
          </button>
          <span className="flex-1" />
          <BranchSwitcher />
        </div>
      </div>

      {/* Desktop: the sidebar itself, pinned below the fixed header. */}
      <nav
        aria-label={t('label')}
        className="fixed inset-y-0 left-0 top-20 z-30 hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border-subtle bg-surface/60 lg:flex"
      >
        <div className="border-b border-border-subtle px-4 py-3">
          <BranchSwitcher />
        </div>
        {links}
      </nav>

      {/* Mobile drawer. */}
      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label={tg('close')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-ink/50 backdrop-blur-sm"
          />
          <nav
            id="panel-nav-drawer"
            aria-label={t('label')}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-surface shadow-float"
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <BranchSwitcher />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tg('close')}
                className="inline-flex size-9 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {links}
          </nav>
        </div>
      ) : null}
    </>
  )
}

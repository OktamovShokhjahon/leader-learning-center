'use client'

import { useTranslations } from 'next-intl'
import { Wallet, AlertTriangle, CalendarCheck, Users, ArrowRight } from 'lucide-react'
import { can } from '@leader/shared/permissions'
import { useQuery, type Paginated } from '@/lib/api/use-api'
import { useAuth } from '@/lib/auth/auth-context'
import { Link } from '@/i18n/navigation'
import { Panel, Money, Loading, Empty, StatusPill, overdueTone } from './primitives'
import { GirihStar } from '@/components/ui/girih-star'
import { cn } from '@/lib/utils'

type Group = { _id: string; name: string; enrolled: number; capacity: number; schedule?: { startTime: string; endTime: string } }
type DebtorList = { items: { invoiceId?: string; studentId: string; studentName: string; due?: number; daysOverdue?: number }[]; total: number; totalDebt?: number }

/**
 * TZ §1 — "Every day-to-day action must be reachable in at most 2 clicks from
 * the dashboard and completable in under 15 seconds."
 *
 * So this is not a wall of charts. It is the two or three things the person in
 * front of it does today: mark a lesson, take a payment, chase a debtor. Each
 * tile is one click from doing it.
 */
export function CrmDashboard() {
  const t = useTranslations('panel.dashboard')
  const { user } = useAuth()
  const roles = user?.roles.map((assignment) => assignment.role) ?? []

  const mayTakePayment = roles.some((role) => can(role, 'payment.accept'))
  const maySeeDebtors = roles.some((role) => can(role, 'debtor.view'))
  const mayMark = roles.some((role) => can(role, 'attendance.mark'))

  const groups = useQuery<Paginated<Group>>(mayMark ? '/groups?limit=6&status=active' : null)
  const debtors = useQuery<DebtorList>(maySeeDebtors ? '/payments/debtors?limit=5' : null)

  return (
    <div className="flex flex-col gap-6">
      {/* The daily actions, as full-width targets rather than buried links. */}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mayTakePayment ? (
          <Action
            href="/crm/payments"
            Icon={Wallet}
            label={t('takePayment')}
            hint={t('takePaymentHint')}
            primary
          />
        ) : null}
        {mayMark ? (
          <Action
            href="/crm/groups"
            Icon={CalendarCheck}
            label={t('markAttendance')}
            hint={t('markAttendanceHint')}
          />
        ) : null}
        {maySeeDebtors ? (
          <Action
            href="/crm/debtors"
            Icon={AlertTriangle}
            label={t('chaseDebtors')}
            hint={
              debtors.data?.totalDebt !== undefined
                ? t('chaseDebtorsHint', { n: debtors.data.total })
                : t('chaseDebtorsHintPlain')
            }
          />
        ) : null}
      </ul>

      <div className="grid gap-5 lg:grid-cols-2">
        {mayMark ? (
          <Panel
            title={t('myGroups')}
            action={
              <Link
                href="/crm/groups"
                className="text-2xs font-medium text-glaze-700 hover:underline dark:text-glaze-300"
              >
                {t('seeAll')}
              </Link>
            }
          >
            {groups.loading ? (
              <div className="p-5">
                <Loading />
              </div>
            ) : (groups.data?.items.length ?? 0) === 0 ? (
              <div className="p-5">
                <Empty title={t('noGroups')} Icon={Users} />
              </div>
            ) : (
              <ul>
                {groups.data!.items.map((group) => (
                  <li key={group._id} className="border-b border-border-subtle last:border-b-0">
                    <Link
                      href={`/crm/groups/${group._id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-navy-50/60 dark:hover:bg-navy-800/50"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <GirihStar className="size-2.5 shrink-0 text-clay-500" strokeWidth={2.6} />
                        <span className="truncate text-xs font-medium text-ink dark:text-white">
                          {group.name}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        {group.schedule ? (
                          <span className="font-mono text-2xs text-ink-muted">
                            {group.schedule.startTime}
                          </span>
                        ) : null}
                        <span className="rounded-pill bg-glaze-50 px-2 py-0.5 font-mono text-2xs text-glaze-800 dark:bg-navy-800 dark:text-glaze-200">
                          {group.enrolled}/{group.capacity}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}

        {maySeeDebtors ? (
          <Panel
            title={t('topDebtors')}
            action={
              debtors.data?.totalDebt !== undefined ? (
                <Money amount={debtors.data.totalDebt} compact className="text-2xs text-danger" />
              ) : null
            }
          >
            {debtors.loading ? (
              <div className="p-5">
                <Loading />
              </div>
            ) : (debtors.data?.items.length ?? 0) === 0 ? (
              <div className="p-5">
                <Empty title={t('noDebtors')} />
              </div>
            ) : (
              <ul>
                {debtors.data!.items.map((row) => (
                  <li
                    key={row.invoiceId ?? row.studentId}
                    className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3.5 last:border-b-0"
                  >
                    <span className="truncate text-xs text-ink dark:text-white">
                      {row.studentName}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {row.daysOverdue !== undefined && row.daysOverdue > 0 ? (
                        <span className={cn('font-mono text-2xs', overdueTone(row.daysOverdue))}>
                          {t('daysLate', { n: row.daysOverdue })}
                        </span>
                      ) : null}
                      {row.due !== undefined ? (
                        <Money amount={row.due} compact className="text-2xs font-medium text-danger" />
                      ) : (
                        <StatusPill status="overdue" label={t('hasDebt')} />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}
      </div>
    </div>
  )
}

function Action({
  href,
  Icon,
  label,
  hint,
  primary = false,
}: {
  href: string
  Icon: typeof Wallet
  label: string
  hint: string
  primary?: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'group flex h-full items-center gap-4 rounded-card p-5 transition-all duration-200 hover:-translate-y-1',
          primary
            ? 'gradient-glaze text-white shadow-raise hover:shadow-float'
            : 'panel-frame-ink bg-surface hover:shadow-float',
        )}
      >
        <span
          className={cn(
            'inline-flex size-12 shrink-0 items-center justify-center rounded-input',
            primary ? 'bg-white/15 text-white' : 'bg-glaze-50 text-glaze-700 dark:bg-navy-800 dark:text-glaze-300',
          )}
        >
          <Icon className="size-5.5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              'font-display text-sm tracking-[-0.01em]',
              primary ? 'text-white' : 'text-ink dark:text-white',
            )}
          >
            {label}
          </span>
          <span className={cn('text-2xs', primary ? 'text-white/75' : 'text-ink-muted')}>
            {hint}
          </span>
        </span>
        <ArrowRight
          className={cn(
            'size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1',
            primary ? 'text-white/80' : 'text-glaze-600',
          )}
          aria-hidden
        />
      </Link>
    </li>
  )
}

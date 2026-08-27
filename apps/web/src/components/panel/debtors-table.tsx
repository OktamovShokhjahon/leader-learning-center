'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Phone,
  Send,
  CheckCircle2,
  Search,
  Download,
  Wallet,
  AlertTriangle,
  Users,
  Clock,
  CircleDollarSign,
} from 'lucide-react'
import { useQuery, openAuthenticatedFile, openBlankTab } from '@/lib/api/use-api'
import { useAuth } from '@/lib/auth/auth-context'
import { Link } from '@/i18n/navigation'
import {
  Panel,
  TableShell,
  Th,
  Td,
  Money,
  Loading,
  ErrorBox,
  Empty,
  overdueTone,
} from './primitives'
import { CeramicTile, initials } from '@/components/ui/ceramic-tile'
import { DonutChart } from './donut-chart'
import { cn } from '@/lib/utils'

type DebtorRow = {
  invoiceId: string
  studentId: string
  studentName: string
  phone?: string
  parentPhone?: string
  groupId?: string
  groupName?: string
  courseId?: string
  period: string
  due: number
  daysOverdue: number
  paidAmount?: number
  finalAmount?: number
  /** Present only for a teacher, who never sees amounts (§4.2 note 2). */
  hasDebt?: boolean
}

type DebtorList = {
  items: DebtorRow[]
  total: number
  totalDebt?: number
  unpaidCount?: number
  criticalCount?: number
  band1to3Count?: number
  band4to9Count?: number
  page: number
  pages: number
}

/**
 * TZ §11.3 — "Qarzdorlar", an explicit client requirement.
 *
 * Full-featured debtor management workspace: live search, KPI metric tiles,
 * overdue bands, quick payment routing, WhatsApp/Telegram reminders, and CSV export.
 */
export function DebtorsTable() {
  const t = useTranslations('panel.debtors')
  const { getToken } = useAuth()
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [minDays, setMinDays] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const query = new URLSearchParams({ page: String(page), limit: '50' })
  if (search.trim().length >= 2) query.set('search', search.trim())
  if (minDays) query.set('minDaysOverdue', String(minDays))

  const path = unpaidOnly
    ? `/payments/debtors/unpaid?${query}`
    : `/payments/debtors?${query}`

  const { data, loading, error } = useQuery<DebtorList>(path)

  const bands: { label: string; value: number | null }[] = [
    { label: t('bandAll'), value: null },
    { label: t('band1'), value: 1 },
    { label: t('band4'), value: 4 },
    { label: t('band10'), value: 11 },
  ]

  const handleExport = () => {
    const exportQuery = new URLSearchParams()
    if (search.trim().length >= 2) exportQuery.set('search', search.trim())
    if (minDays) exportQuery.set('minDaysOverdue', String(minDays))
    if (unpaidOnly) exportQuery.set('unpaidOnly', 'true')
    // The route needs the bearer token (§8), so this has to fetch the file
    // itself rather than pointing the browser at the URL directly — a bare
    // `window.open` here would 401 since the access token is never a cookie.
    // The tab opens synchronously, before the token lookup, so the popup
    // blocker doesn't mistake this click for the source of an unsolicited pop-up.
    const tab = openBlankTab()
    void getToken().then((token) =>
      openAuthenticatedFile(`/payments/debtors/export?${exportQuery}`, token, tab),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Overview Tiles */}
      {data && data.totalDebt !== undefined ? (
        <ul className="panel-frame-ink grid grid-cols-2 overflow-hidden rounded-card bg-surface lg:grid-cols-4">
          <KpiTile
            label={t('kpiTotalDebtors')}
            value={data.total}
            Icon={Users}
            tone="default"
          />
          <KpiTile
            label={t('kpiTotalDebt')}
            value={<Money amount={data.totalDebt} className="text-danger" />}
            Icon={CircleDollarSign}
            tone="danger"
          />
          <KpiTile
            label={t('kpiUnpaid')}
            value={data.unpaidCount ?? 0}
            Icon={AlertTriangle}
            tone="warning"
          />
          <KpiTile
            label={t('kpiCritical')}
            value={data.criticalCount ?? 0}
            Icon={Clock}
            tone="danger"
            last
          />
        </ul>
      ) : null}

      {/* G5 — the overdue-band breakdown as a donut, alongside the KPI tiles above. */}
      {data && data.total > 0 ? (
        <Panel title={t('overdueBreakdown')}>
          <div className="p-4">
            <DonutChart
              total={data.total}
              data={[
                { key: 'band1to3', label: t('band1'), value: data.band1to3Count ?? 0, color: 'var(--color-info)' },
                { key: 'band4to9', label: t('band4'), value: data.band4to9Count ?? 0, color: 'var(--color-warning)' },
                { key: 'band10plus', label: t('band10'), value: data.criticalCount ?? 0, color: 'var(--color-danger)' },
              ]}
            />
          </div>
        </Panel>
      ) : null}

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-64 flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('searchPlaceholder')}
            className="h-12 w-full rounded-input border border-border-subtle bg-surface pl-11 pr-4 text-sm text-ink outline-none focus:border-glaze-500 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-pill border border-border-subtle bg-surface p-1">
            {[false, true].map((mode) => (
              <button
                key={String(mode)}
                type="button"
                onClick={() => {
                  setUnpaidOnly(mode)
                  setPage(1)
                }}
                className={cn(
                  'rounded-pill px-3.5 py-1.5 text-2xs font-medium transition-colors',
                  unpaidOnly === mode
                    ? 'bg-navy-600 text-white'
                    : 'text-ink-soft hover:text-navy-700 dark:text-navy-200',
                )}
              >
                {mode ? t('tabUnpaid') : t('tabAll')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {bands.map((band) => (
              <button
                key={band.label}
                type="button"
                onClick={() => {
                  setMinDays(band.value)
                  setPage(1)
                }}
                className={cn(
                  'rounded-pill border px-3 py-1.5 text-2xs font-medium transition-colors',
                  minDays === band.value
                    ? 'border-transparent bg-navy-50 text-navy-700 dark:bg-navy-800 dark:text-white'
                    : 'border-border-subtle bg-surface text-ink-muted hover:text-navy-700 dark:hover:text-white',
                )}
              >
                {band.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-border-subtle bg-surface px-3.5 text-2xs font-medium text-ink-soft transition-colors hover:border-glaze-500 hover:text-glaze-700 dark:text-navy-200"
          >
            <Download className="size-3.5" aria-hidden />
            {t('export')}
          </button>
        </div>
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}

      {data && data.items.length === 0 && !loading ? (
        <Empty title={t('none')} Icon={CheckCircle2} />
      ) : null}

      {data && data.items.length > 0 ? (
        <Panel action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}>
          <TableShell>
            <thead>
              <tr>
                <Th>{t('student')}</Th>
                <Th>{t('group')}</Th>
                <Th>{t('period')}</Th>
                <Th className="text-right">{t('due')}</Th>
                <Th className="text-right">{t('daysOverdue')}</Th>
                <Th className="text-right">{t('contact')}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const targetPhone = row.parentPhone ?? row.phone
                const rawCleanPhone = targetPhone ? targetPhone.replace(/\D/g, '') : ''
                const groupNameStr =
                  typeof row.groupName === 'object' && row.groupName !== null
                    ? (row.groupName as { uz?: string }).uz ?? ''
                    : (row.groupName ?? '')

                const telegramText = t('telegramReminder', {
                  name: row.studentName,
                  group: groupNameStr,
                  amount: row.due ? row.due.toLocaleString() : '',
                })

                return (
                  <tr
                    key={row.invoiceId ?? row.studentId}
                    className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40"
                  >
                    <Td>
                      <Link
                        href={`/crm/students/${row.studentId}`}
                        className="flex items-center gap-3 font-medium text-ink hover:text-glaze-700 dark:text-white dark:hover:text-glaze-300"
                      >
                        <CeramicTile
                          seed={row.studentId}
                          label={initials(row.studentName)}
                          dense
                          className="size-8 shrink-0 rounded-input"
                        />
                        <span className="truncate">{row.studentName}</span>
                      </Link>
                    </Td>
                    <Td className="text-ink-soft dark:text-navy-200">
                      {groupNameStr || '—'}
                    </Td>
                    <Td className="font-mono text-2xs text-ink-muted">{row.period ?? '—'}</Td>
                    <Td className="text-right">
                      {row.due === undefined ? (
                        <span className="rounded-pill bg-danger/12 px-2.5 py-1 text-2xs font-medium text-danger">
                          {t('hasDebt')}
                        </span>
                      ) : (
                        <Money amount={row.due} className="font-medium text-danger" />
                      )}
                    </Td>
                    <Td className="text-right">
                      {row.daysOverdue === undefined ? (
                        '—'
                      ) : (
                        <span className={cn('font-mono font-medium', overdueTone(row.daysOverdue))}>
                          {row.daysOverdue}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span className="flex items-center justify-end gap-1.5">
                        {row.phone ? (
                          <a
                            href={`tel:${row.phone}`}
                            aria-label={t('call')}
                            title={t('call')}
                            className="inline-flex size-8 items-center justify-center rounded-pill text-glaze-700 transition-colors hover:bg-glaze-50 dark:text-glaze-300 dark:hover:bg-navy-800"
                          >
                            <Phone className="size-3.5" aria-hidden />
                          </a>
                        ) : null}
                        {rawCleanPhone ? (
                          <a
                            href={`https://t.me/+${rawCleanPhone}?text=${encodeURIComponent(telegramText)}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={t('telegram')}
                            title={t('telegram')}
                            className="inline-flex size-8 items-center justify-center rounded-pill text-glaze-700 transition-colors hover:bg-glaze-50 dark:text-glaze-300 dark:hover:bg-navy-800"
                          >
                            <Send className="size-3.5" aria-hidden />
                          </a>
                        ) : null}
                        {row.due !== undefined ? (
                          <Link
                            href={`/crm/payments?studentId=${row.studentId}`}
                            title={t('quickPay')}
                            className="inline-flex h-8 items-center gap-1 rounded-pill bg-clay-500/15 px-2.5 text-2xs font-medium text-clay-700 transition-colors hover:bg-clay-500 hover:text-white dark:text-clay-300"
                          >
                            <Wallet className="size-3" aria-hidden />
                            {t('takePayment')}
                          </Link>
                        ) : null}
                      </span>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      {data && data.pages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            className="h-10 rounded-pill border border-border-subtle px-4 text-xs disabled:opacity-40"
          >
            ←
          </button>
          <span className="font-mono text-2xs text-ink-muted">
            {page} / {data.pages}
          </span>
          <button
            type="button"
            disabled={page >= data.pages}
            onClick={() => setPage((current) => current + 1)}
            className="h-10 rounded-pill border border-border-subtle px-4 text-xs disabled:opacity-40"
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  )
}

function KpiTile({
  label,
  value,
  Icon,
  tone = 'default',
  last = false,
}: {
  label: string
  value: React.ReactNode
  Icon: typeof Users
  tone?: 'default' | 'danger' | 'warning'
  last?: boolean
}) {
  return (
    <li
      className={cn(
        'flex flex-col gap-2 border-b border-border-subtle p-5 lg:border-b-0',
        !last && 'lg:border-r',
      )}
    >
      <span className="flex items-center justify-between text-2xs uppercase tracking-[0.1em] text-ink-muted">
        {label}
        <Icon
          className={cn(
            'size-4',
            tone === 'danger' && 'text-danger',
            tone === 'warning' && 'text-warning',
            tone === 'default' && 'text-glaze-600',
          )}
          aria-hidden
        />
      </span>
      <span className="font-display text-xl tracking-[-0.02em] text-ink dark:text-white">
        {value}
      </span>
    </li>
  )
}

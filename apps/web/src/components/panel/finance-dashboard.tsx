'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { TrendingUp, TrendingDown, Eye, EyeOff, Users, Percent } from 'lucide-react'
import { useQuery } from '@/lib/api/use-api'
import {
  Panel,
  TableShell,
  Th,
  Td,
  Money,
  Loading,
  ErrorBox,
  Empty,
} from './primitives'
import { cn } from '@/lib/utils'

type Overview = {
  period: string
  revenue: { collected: number; previous: number; changePercent: number | null }
  invoiced: number
  collectionRate: number | null
  receivables: { outstanding: number; buckets: { range: string; total: number; count: number }[] }
  averageCheque: number
  activeStudents: number
}

type Revenue = {
  period: string
  byCourse: { _id: string; courseName?: string; invoiced: number; collected: number; students: number }[]
  trend: { period: string; collected: number }[]
}

type Comparison = {
  period: string
  branches: {
    branchId: string
    name: string
    collected: number
    debt: number
    collectionRate: number | null
    students: number
    groups: number
  }[]
}

/**
 * TZ §15 — the finance dashboard, SuperAdmin only.
 *
 * The API enforces that with a router-level guard (§4.3); this component simply
 * assumes it is reachable. Nothing here re-checks a role, because a UI check
 * would be theatre next to the 403 the API already returns.
 *
 * §15.3 — the "hide amounts" toggle blurs every sum, for opening the panel in
 * public. It is deliberately not persisted: it should default to *showing*, so
 * nobody is misled into thinking figures are hidden when they are not.
 */
export function FinanceDashboard() {
  const t = useTranslations('panel.finance')
  const [hidden, setHidden] = useState(false)

  const overview = useQuery<Overview>('/finance/overview')
  const revenue = useQuery<Revenue>('/finance/revenue')
  const comparison = useQuery<Comparison>('/finance/branches-comparison')

  if (overview.loading) return <Loading />
  if (overview.error) return <ErrorBox code={overview.error.code} message={overview.error.message} />
  if (!overview.data) return null

  const data = overview.data
  const blur = hidden ? 'blur-sm select-none' : ''
  const peak = Math.max(...(revenue.data?.trend.map((point) => point.collected) ?? [1]), 1)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-ink-muted">{data.period}</span>
        <button
          type="button"
          onClick={() => setHidden((value) => !value)}
          className="inline-flex h-11 items-center gap-2 rounded-pill border border-navy-600/25 px-4 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
        >
          {hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          {hidden ? t('show') : t('hide')}
        </button>
      </div>

      {/* §15.1 — the headline widgets */}
      <ul className="panel-frame-ink grid grid-cols-2 overflow-hidden rounded-card bg-surface lg:grid-cols-4">
        <Stat
          label={t('collected')}
          value={<Money amount={data.revenue.collected} />}
          blur={blur}
          foot={
            data.revenue.changePercent !== null ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-2xs font-medium',
                  data.revenue.changePercent >= 0 ? 'text-success' : 'text-danger',
                )}
              >
                {data.revenue.changePercent >= 0 ? (
                  <TrendingUp className="size-3.5" aria-hidden />
                ) : (
                  <TrendingDown className="size-3.5" aria-hidden />
                )}
                {data.revenue.changePercent}% {t('vsLastMonth')}
              </span>
            ) : null
          }
        />
        <Stat
          label={t('collectionRate')}
          value={
            <span className="tabular-nums">
              {data.collectionRate === null ? '—' : `${data.collectionRate}%`}
            </span>
          }
          blur={blur}
          foot={
            <span className="inline-flex items-center gap-1 text-2xs text-ink-muted">
              <Percent className="size-3.5" aria-hidden />
              {t('ofInvoiced')}
            </span>
          }
        />
        <Stat
          label={t('receivables')}
          value={<Money amount={data.receivables.outstanding} className="text-danger" />}
          blur={blur}
        />
        <Stat
          label={t('averageCheque')}
          value={<Money amount={data.averageCheque} />}
          blur={blur}
          foot={
            <span className="inline-flex items-center gap-1 text-2xs text-ink-muted">
              <Users className="size-3.5" aria-hidden />
              {t('activeStudents', { n: data.activeStudents })}
            </span>
          }
          last
        />
      </ul>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* §15.1 — six-month trend. A bar list rather than a chart library: it is
            four hundred bytes, needs no client chart runtime, and reads the same. */}
        <Panel title={t('trend')}>
          <ul className="flex flex-col gap-3 p-5">
            {(revenue.data?.trend ?? []).map((point) => (
              <li key={point.period} className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-mono text-2xs text-ink-muted">
                  {point.period}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-pill bg-navy-50 dark:bg-navy-800">
                  <span
                    className="gradient-glaze block h-full rounded-pill transition-[width] duration-500"
                    style={{ width: `${Math.max(2, (point.collected / peak) * 100)}%` }}
                  />
                </span>
                <Money
                  amount={point.collected}
                  compact
                  className={cn('w-24 shrink-0 text-right text-2xs text-ink-soft', blur)}
                />
              </li>
            ))}
          </ul>
        </Panel>

        {/* §15.1 — receivables ageing buckets */}
        <Panel title={t('ageing')}>
          {data.receivables.buckets.length === 0 ? (
            <div className="p-5">
              <Empty title={t('noDebt')} />
            </div>
          ) : (
            <ul className="flex flex-col">
              {data.receivables.buckets.map((bucket) => (
                <li
                  key={bucket.range}
                  className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3.5 last:border-b-0"
                >
                  <span className="text-xs text-ink-soft dark:text-navy-200">
                    {t(`bucket_${bucket.range}` as 'bucket_30+', { default: bucket.range })}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="font-mono text-2xs text-ink-muted">
                      {t('invoices', { n: bucket.count })}
                    </span>
                    <Money amount={bucket.total} className={cn('text-xs font-medium', blur)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* §15.1 — revenue by course */}
      <Panel title={t('byCourse')}>
        {(revenue.data?.byCourse.length ?? 0) === 0 ? (
          <div className="p-5">
            <Empty title={t('noData')} />
          </div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>{t('course')}</Th>
                <Th className="text-right">{t('students')}</Th>
                <Th className="text-right">{t('invoiced')}</Th>
                <Th className="text-right">{t('collected')}</Th>
              </tr>
            </thead>
            <tbody>
              {(revenue.data?.byCourse ?? []).map((row) => (
                <tr key={row._id ?? 'unknown'}>
                  <Td className="font-medium text-ink dark:text-white">
                    {row.courseName ?? row._id ?? '—'}
                  </Td>
                  <Td className="text-right font-mono text-ink-soft">{row.students}</Td>
                  <Td className={cn('text-right', blur)}>
                    <Money amount={row.invoiced} compact />
                  </Td>
                  <Td className={cn('text-right', blur)}>
                    <Money amount={row.collected} compact className="font-medium text-success" />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      {/* §15.1 — branch comparison, the one legitimate cross-branch read */}
      <Panel title={t('branches')}>
        <TableShell>
          <thead>
            <tr>
              <Th>{t('branch')}</Th>
              <Th className="text-right">{t('students')}</Th>
              <Th className="text-right">{t('groups')}</Th>
              <Th className="text-right">{t('collected')}</Th>
              <Th className="text-right">{t('debt')}</Th>
              <Th className="text-right">{t('rate')}</Th>
            </tr>
          </thead>
          <tbody>
            {(comparison.data?.branches ?? []).map((branch) => (
              <tr key={branch.branchId}>
                <Td className="font-medium text-ink dark:text-white">{branch.name}</Td>
                <Td className="text-right font-mono text-ink-soft">{branch.students}</Td>
                <Td className="text-right font-mono text-ink-soft">{branch.groups}</Td>
                <Td className={cn('text-right', blur)}>
                  <Money amount={branch.collected} compact />
                </Td>
                <Td className={cn('text-right', blur)}>
                  <Money amount={branch.debt} compact className="text-danger" />
                </Td>
                <Td className="text-right font-mono">
                  {branch.collectionRate === null ? '—' : `${branch.collectionRate}%`}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Panel>
    </div>
  )
}

function Stat({
  label,
  value,
  foot,
  blur,
  last = false,
}: {
  label: string
  value: React.ReactNode
  foot?: React.ReactNode
  blur: string
  last?: boolean
}) {
  return (
    <li
      className={cn(
        'flex flex-col gap-1.5 border-b border-border-subtle px-6 py-6 lg:border-b-0',
        !last && 'lg:border-r',
      )}
    >
      <span className="text-2xs uppercase tracking-[0.12em] text-ink-muted">{label}</span>
      <span className={cn('font-display text-xl tracking-[-0.02em] text-ink dark:text-white', blur)}>
        {value}
      </span>
      {foot}
    </li>
  )
}

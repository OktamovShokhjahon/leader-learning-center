'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Users,
  Percent,
  GraduationCap,
  BookOpen,
  UserSquare2,
  Wallet,
  Receipt,
  Scale,
} from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
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
import { DonutChart, type DonutSlice } from './donut-chart'
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

type Statistics = {
  period: string
  income: { total: number; count: number }
  expenses: {
    total: number
    byCategory: {
      categoryId: string | null
      name: Record<string, string> | string | null
      slug: string | null
      color: string | null
      total: number
      count: number
    }[]
  }
  profit: { net: number; marginPercent: number | null }
  counts: { students: number; groups: number; courses: number; teachers: number }
}

/**
 * A palette for expense categories, used only when a category carries no
 * colour of its own. Category colours are author-chosen (§13.2), so they are
 * respected first; this is the fallback so a fresh install still reads as a
 * chart rather than a row of identical wedges.
 */
const CATEGORY_FALLBACK = [
  'var(--color-navy-600)',
  'var(--color-glaze-600)',
  'var(--color-clay-500)',
  'var(--color-aqua-500)',
  'var(--color-navy-400)',
  'var(--color-glaze-400)',
  'var(--color-clay-700)',
  'var(--color-aqua-700)',
]

/**
 * TZ §15 — the statistics dashboard, SuperAdmin only.
 *
 * The API enforces that with a router-level guard (§4.3); this component simply
 * assumes it is reachable. Nothing here re-checks a role, because a UI check
 * would be theatre next to the 403 the API already returns.
 *
 * The screen is deliberately split into named sections — the school, then the
 * money, then the detail — because "finance" had grown into one undifferentiated
 * column where a headcount sat next to a collection rate with nothing saying
 * they answer different questions.
 *
 * §15.3 — the "hide amounts" toggle blurs every sum, for opening the panel in
 * public. It is deliberately not persisted: it should default to *showing*, so
 * nobody is misled into thinking figures are hidden when they are not.
 */
export function FinanceDashboard() {
  const t = useTranslations('panel.finance')
  const locale = useLocale() as Locale
  const [hidden, setHidden] = useState(false)

  const overview = useQuery<Overview>('/finance/overview')
  const revenue = useQuery<Revenue>('/finance/revenue')
  const comparison = useQuery<Comparison>('/finance/branches-comparison')
  const stats = useQuery<Statistics>('/finance/statistics')

  if (overview.loading) return <Loading />
  if (overview.error) return <ErrorBox code={overview.error.code} message={overview.error.message} />
  if (!overview.data) return null

  const data = overview.data
  const blur = hidden ? 'blur-sm select-none' : ''
  const peak = Math.max(...(revenue.data?.trend.map((point) => point.collected) ?? [1]), 1)

  const localized = (value: Record<string, string> | string | null): string | null => {
    if (!value) return null
    if (typeof value === 'string') return value
    return value[locale] || value.uz || null
  }

  // Income vs expense, as one donut — the two halves of the same month.
  const flowSlices: DonutSlice[] = stats.data
    ? [
        {
          key: 'income',
          label: t('income'),
          value: stats.data.income.total,
          color: 'var(--color-success)',
        },
        {
          key: 'expenses',
          label: t('expenses'),
          value: stats.data.expenses.total,
          color: 'var(--color-danger)',
        },
      ]
    : []

  const expenseSlices: DonutSlice[] = (stats.data?.expenses.byCategory ?? []).map(
    (row, index) => ({
      key: row.categoryId ?? row.slug ?? String(index),
      label: localized(row.name) ?? row.slug ?? t('uncategorised'),
      value: row.total,
      color: row.color ?? CATEGORY_FALLBACK[index % CATEGORY_FALLBACK.length]!,
    }),
  )

  return (
    <div className="flex flex-col gap-8">
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

      {/* ── The school itself: how big is it? ───────────────────────────── */}
      <Section title={t('sectionSchool')}>
        <ul className="panel-frame-ink grid grid-cols-2 overflow-hidden rounded-card bg-surface lg:grid-cols-4">
          <Stat
            label={t('countStudents')}
            value={<span className="tabular-nums">{stats.data?.counts.students ?? '—'}</span>}
            blur=""
            foot={<Foot Icon={GraduationCap} text={t('countStudentsHint')} />}
          />
          <Stat
            label={t('countGroups')}
            value={<span className="tabular-nums">{stats.data?.counts.groups ?? '—'}</span>}
            blur=""
            foot={<Foot Icon={Users} text={t('countGroupsHint')} />}
          />
          <Stat
            label={t('countCourses')}
            value={<span className="tabular-nums">{stats.data?.counts.courses ?? '—'}</span>}
            blur=""
            foot={<Foot Icon={BookOpen} text={t('countCoursesHint')} />}
          />
          <Stat
            label={t('countTeachers')}
            value={<span className="tabular-nums">{stats.data?.counts.teachers ?? '—'}</span>}
            blur=""
            foot={<Foot Icon={UserSquare2} text={t('countTeachersHint')} />}
            last
          />
        </ul>
      </Section>

      {/* ── The money in and out ────────────────────────────────────────── */}
      <Section title={t('sectionMoney')}>
        <ul className="panel-frame-ink grid grid-cols-2 overflow-hidden rounded-card bg-surface lg:grid-cols-3">
          <Stat
            label={t('income')}
            value={<Money amount={stats.data?.income.total ?? 0} className="text-success" />}
            blur={blur}
            foot={<Foot Icon={Wallet} text={t('incomeHint')} />}
          />
          <Stat
            label={t('expenses')}
            value={<Money amount={stats.data?.expenses.total ?? 0} className="text-danger" />}
            blur={blur}
            foot={<Foot Icon={Receipt} text={t('expensesHint')} />}
          />
          <Stat
            label={t('profit')}
            value={
              <Money
                amount={stats.data?.profit.net ?? 0}
                className={(stats.data?.profit.net ?? 0) >= 0 ? 'text-success' : 'text-danger'}
              />
            }
            blur={blur}
            foot={
              stats.data?.profit.marginPercent !== null &&
              stats.data?.profit.marginPercent !== undefined ? (
                <Foot Icon={Scale} text={t('margin', { n: stats.data.profit.marginPercent })} />
              ) : (
                <Foot Icon={Scale} text={t('profitHint')} />
              )
            }
            last
          />
        </ul>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title={t('incomeVsExpense')}>
            <div className={cn('p-4', blur)}>
              {flowSlices.length === 0 || (stats.data?.income.total ?? 0) + (stats.data?.expenses.total ?? 0) === 0 ? (
                <Empty title={t('noData')} />
              ) : (
                <DonutChart data={flowSlices} />
              )}
            </div>
          </Panel>

          <Panel title={t('expenseBreakdown')}>
            <div className={cn('p-4', blur)}>
              {expenseSlices.length === 0 ? (
                <Empty title={t('noExpenses')} />
              ) : (
                <DonutChart data={expenseSlices} />
              )}
            </div>
          </Panel>
        </div>
      </Section>

      {/* ── Collection: are the invoices actually being paid? ───────────── */}
      <Section title={t('sectionCollection')}>
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
            foot={<Foot Icon={Percent} text={t('ofInvoiced')} />}
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
            foot={<Foot Icon={Users} text={t('activeStudents', { n: data.activeStudents })} />}
            last
          />
        </ul>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* §15.1 — six-month trend. A bar list rather than a chart: it reads
              the same, and a donut cannot show a sequence. */}
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
      </Section>

      {/* ── Detail tables ───────────────────────────────────────────────── */}
      <Section title={t('sectionDetail')}>
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

        {/* Expenses spelled out beside their donut — a wedge is a proportion,
            and the person signing them off also needs the actual sums. */}
        <Panel title={t('expensesByCategory')}>
          {expenseSlices.length === 0 ? (
            <div className="p-5">
              <Empty title={t('noExpenses')} />
            </div>
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>{t('category')}</Th>
                  <Th className="text-right">{t('records')}</Th>
                  <Th className="text-right">{t('amount')}</Th>
                  <Th className="text-right">{t('share')}</Th>
                </tr>
              </thead>
              <tbody>
                {(stats.data?.expenses.byCategory ?? []).map((row, index) => (
                  <tr key={row.categoryId ?? row.slug ?? index}>
                    <Td className="font-medium text-ink dark:text-white">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block size-2.5 shrink-0 rounded-pill"
                          style={{
                            background:
                              row.color ?? CATEGORY_FALLBACK[index % CATEGORY_FALLBACK.length],
                          }}
                        />
                        {localized(row.name) ?? row.slug ?? t('uncategorised')}
                      </span>
                    </Td>
                    <Td className="text-right font-mono text-ink-soft">{row.count}</Td>
                    <Td className={cn('text-right', blur)}>
                      <Money amount={row.total} compact className="text-danger" />
                    </Td>
                    <Td className="text-right font-mono text-ink-soft">
                      {(stats.data?.expenses.total ?? 0) > 0
                        ? `${Math.round((row.total / stats.data!.expenses.total) * 100)}%`
                        : '—'}
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
      </Section>
    </div>
  )
}

/** A titled run of panels, so the page reads as parts rather than one column. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-3 text-2xs font-medium uppercase tracking-[0.14em] text-ink-muted">
        {title}
        <span className="h-px flex-1 bg-border-subtle" aria-hidden />
      </h2>
      {children}
    </section>
  )
}

function Foot({ Icon, text }: { Icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-ink-muted">
      <Icon className="size-3.5" />
      {text}
    </span>
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

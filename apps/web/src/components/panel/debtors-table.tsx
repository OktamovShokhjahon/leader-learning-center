'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Phone, Send, CheckCircle2 } from 'lucide-react'
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
  overdueTone,
} from './primitives'
import { cn } from '@/lib/utils'

type DebtorRow = {
  invoiceId: string
  studentId: string
  studentName: string
  phone?: string
  parentPhone?: string
  groupName?: string
  period: string
  due: number
  daysOverdue: number
  /** Present only for a teacher, who never sees amounts (§4.2 note 2). */
  hasDebt?: boolean
}

type DebtorList = {
  items: DebtorRow[]
  total: number
  totalDebt?: number
  page: number
  pages: number
}

/**
 * TZ §11.3 — "Qarzdorlar", an explicit client requirement.
 *
 * Two tabs, exactly as specified: everyone past due, and the separate "Kurs puli
 * to'lamaganlar" for students who have paid *nothing* this period rather than
 * merely too little.
 *
 * A teacher reaching this component gets rows with `hasDebt` and no sums — the
 * API strips the amounts, so this renders a flag and never a number it was not
 * given.
 */
export function DebtorsTable() {
  const t = useTranslations('panel.debtors')
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [minDays, setMinDays] = useState<number | null>(null)

  const query = new URLSearchParams({ limit: '50' })
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-pill border border-border-subtle p-1">
          {[false, true].map((mode) => (
            <button
              key={String(mode)}
              type="button"
              onClick={() => setUnpaidOnly(mode)}
              className={cn(
                'rounded-pill px-4 py-2 text-xs font-medium transition-colors',
                unpaidOnly === mode
                  ? 'bg-navy-600 text-white'
                  : 'text-ink-soft hover:text-navy-700 dark:text-navy-200',
              )}
            >
              {mode ? t('tabUnpaid') : t('tabAll')}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {bands.map((band) => (
            <button
              key={band.label}
              type="button"
              onClick={() => setMinDays(band.value)}
              className={cn(
                'rounded-pill border px-3 py-2 text-2xs font-medium transition-colors',
                minDays === band.value
                  ? 'border-transparent bg-navy-50 text-navy-700 dark:bg-navy-800 dark:text-white'
                  : 'border-border-subtle text-ink-muted hover:text-navy-700 dark:hover:text-white',
              )}
            >
              {band.label}
            </button>
          ))}
        </div>

        {data?.totalDebt !== undefined ? (
          <span className="ml-auto flex items-baseline gap-2 text-xs text-ink-soft dark:text-navy-200">
            {t('totalDebt')}
            <Money amount={data.totalDebt} className="text-sm font-medium text-danger" />
          </span>
        ) : null}
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}

      {data && data.items.length === 0 ? (
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
              {data.items.map((row) => (
                <tr key={row.invoiceId ?? row.studentId} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <Td>
                    <span className="font-medium text-ink dark:text-white">{row.studentName}</span>
                  </Td>
                  <Td className="text-ink-soft dark:text-navy-200">
                    {typeof row.groupName === 'object' && row.groupName !== null
                      ? (row.groupName as { uz?: string }).uz ?? '—'
                      : (row.groupName ?? '—')}
                  </Td>
                  <Td className="font-mono text-2xs text-ink-muted">{row.period ?? '—'}</Td>
                  <Td className="text-right">
                    {/* A teacher is sent `hasDebt` and no amount — render the flag. */}
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
                    <span className="flex items-center justify-end gap-1">
                      {row.phone ? (
                        <a
                          href={`tel:${row.phone}`}
                          aria-label={t('call')}
                          className="inline-flex size-9 items-center justify-center rounded-pill text-glaze-700 transition-colors hover:bg-glaze-50 dark:text-glaze-300 dark:hover:bg-navy-800"
                        >
                          <Phone className="size-4" aria-hidden />
                        </a>
                      ) : null}
                      {row.parentPhone ? (
                        <a
                          href={`https://t.me/+${row.parentPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={t('telegram')}
                          className="inline-flex size-9 items-center justify-center rounded-pill text-glaze-700 transition-colors hover:bg-glaze-50 dark:text-glaze-300 dark:hover:bg-navy-800"
                        >
                          <Send className="size-4" aria-hidden />
                        </a>
                      ) : null}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}
    </div>
  )
}

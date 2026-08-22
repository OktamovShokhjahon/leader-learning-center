'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Users } from 'lucide-react'
import { STUDENT_STATUSES } from '@leader/shared/schemas'
import { useQuery, type Paginated } from '@/lib/api/use-api'
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
  StatusPill,
} from './primitives'
import { CeramicTile, initials } from '@/components/ui/ceramic-tile'
import { cn } from '@/lib/utils'

type Student = {
  _id: string
  fullName: string
  phone?: string
  parentPhone?: string
  status: string
  monthlyFee: number
  balance: number
}

/** TZ §9.1 — the student list, filterable by the workbook's `Status` column. */
export function StudentsTable() {
  const t = useTranslations('panel.students')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const query = new URLSearchParams({ page: String(page), limit: '25' })
  if (search.trim().length >= 2) query.set('search', search.trim())
  if (status) query.set('status', status)

  const { data, loading, error } = useQuery<Paginated<Student>>(`/students?${query}`)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
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

        <div className="flex flex-wrap gap-1.5">
          <FilterChip label={t('all')} active={status === null} onClick={() => setStatus(null)} />
          {STUDENT_STATUSES.map((option) => (
            <FilterChip
              key={option}
              label={t(`status.${option}`)}
              active={status === option}
              onClick={() => {
                setStatus(option)
                setPage(1)
              }}
            />
          ))}
        </div>
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}

      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={Users} /> : null}

      {data && data.items.length > 0 ? (
        <Panel action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}>
          <TableShell>
            <thead>
              <tr>
                <Th>{t('student')}</Th>
                <Th>{t('phone')}</Th>
                <Th>{t('statusLabel')}</Th>
                <Th className="text-right">{t('fee')}</Th>
                <Th className="text-right">{t('balance')}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((student) => (
                <tr key={student._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <Td>
                    <Link
                      href={`/crm/students/${student._id}`}
                      className="flex items-center gap-3 font-medium text-ink hover:text-glaze-700 dark:text-white dark:hover:text-glaze-300"
                    >
                      <CeramicTile
                        seed={student._id}
                        label={initials(student.fullName)}
                        dense
                        className="size-9 shrink-0 rounded-input"
                      />
                      {student.fullName}
                    </Link>
                  </Td>
                  <Td className="font-mono text-2xs text-ink-soft dark:text-navy-200">
                    {student.phone ?? student.parentPhone ?? '—'}
                  </Td>
                  <Td>
                    <StatusPill status={student.status} label={t(`status.${student.status}`)} />
                  </Td>
                  <Td className="text-right">
                    <Money amount={student.monthlyFee} compact />
                  </Td>
                  <Td className="text-right">
                    {student.balance > 0 ? (
                      <Money amount={student.balance} compact className="text-success" />
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </Td>
                </tr>
              ))}
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
            className="h-11 rounded-pill border border-border-subtle px-4 text-xs disabled:opacity-40"
          >
            {t('prev')}
          </button>
          <span className="font-mono text-2xs text-ink-muted">
            {page} / {data.pages}
          </span>
          <button
            type="button"
            disabled={page >= data.pages}
            onClick={() => setPage((current) => current + 1)}
            className="h-11 rounded-pill border border-border-subtle px-4 text-xs disabled:opacity-40"
          >
            {t('next')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-pill border px-3 py-2 text-2xs font-medium transition-colors',
        active
          ? 'border-transparent bg-navy-600 text-white'
          : 'border-border-subtle text-ink-muted hover:text-navy-700 dark:hover:text-white',
      )}
    >
      {label}
    </button>
  )
}

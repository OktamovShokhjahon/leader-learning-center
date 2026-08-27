'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Users, Pencil, Wallet, AlertTriangle } from 'lucide-react'
import { STUDENT_STATUSES } from '@leader/shared/schemas'
import { useQuery, type Paginated } from '@/lib/api/use-api'
import { NewButton, RowAction } from './table-kit'
import { StudentDialog, type PanelStudent } from './student-dialog'
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
  overdueTone,
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
  debt?: number
  daysOverdue?: number
  isDebtor?: boolean
}

/** TZ §9.1 — the student list, filterable by status and debtors. */
export function StudentsTable() {
  const t = useTranslations('panel.students')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [onlyDebtors, setOnlyDebtors] = useState(false)
  const [page, setPage] = useState(1)

  const query = new URLSearchParams({ page: String(page), limit: '25' })
  if (search.trim().length >= 2) query.set('search', search.trim())
  if (onlyDebtors) query.set('status', 'overdue')
  else if (status) query.set('status', status)

  const { data, loading, error, refetch } = useQuery<Paginated<Student>>(`/students?${query}`)
  const [editing, setEditing] = useState<PanelStudent | 'new' | null>(null)

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

        <NewButton label={t('create')} onClick={() => setEditing('new')} />

        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label={t('all')}
            active={status === null && !onlyDebtors}
            onClick={() => {
              setStatus(null)
              setOnlyDebtors(false)
              setPage(1)
            }}
          />
          <button
            type="button"
            onClick={() => {
              setOnlyDebtors((v) => !v)
              if (!onlyDebtors) setStatus(null)
              setPage(1)
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-pill border px-3 py-2 text-2xs font-medium transition-colors',
              onlyDebtors
                ? 'border-transparent bg-danger text-white'
                : 'border-border-subtle text-danger hover:border-danger/40 dark:border-danger/30',
            )}
          >
            <AlertTriangle className="size-3" aria-hidden />
            {t('onlyDebtors')}
          </button>
          {STUDENT_STATUSES.map((option) => (
            <FilterChip
              key={option}
              label={t(`status.${option}`)}
              active={status === option && !onlyDebtors}
              onClick={() => {
                setStatus(option)
                setOnlyDebtors(false)
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
                <Th className="text-right">{t('debt')}</Th>
                <Th className="text-right" />
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
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{student.fullName}</span>
                        {student.isDebtor ? (
                          <span className="text-2xs font-medium text-danger">{t('debtorBadge')}</span>
                        ) : null}
                      </span>
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
                  <Td className="text-right">
                    {student.debt && student.debt > 0 ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <Money amount={student.debt} compact className="font-medium text-danger" />
                        {student.daysOverdue && student.daysOverdue > 0 ? (
                          <span
                            className={cn(
                              'font-mono text-3xs font-medium',
                              overdueTone(student.daysOverdue),
                            )}
                          >
                            {t('daysLate', { n: student.daysOverdue })}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {student.debt && student.debt > 0 ? (
                        <Link
                          href={`/crm/payments?studentId=${student._id}`}
                          title={t('takePayment')}
                          className="inline-flex h-8 items-center gap-1 rounded-pill bg-clay-500/15 px-2.5 text-2xs font-medium text-clay-700 transition-colors hover:bg-clay-500 hover:text-white dark:text-clay-300"
                        >
                          <Wallet className="size-3" aria-hidden />
                          {t('takePayment')}
                        </Link>
                      ) : null}
                      <RowAction
                        label={t('edit')}
                        Icon={Pencil}
                        onClick={() => setEditing(student as unknown as PanelStudent)}
                      />
                    </div>
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

      <StudentsDialogs editing={editing} setEditing={setEditing} refetch={refetch} />
    </div>
  )
}

function StudentsDialogs({
  editing,
  setEditing,
  refetch,
}: {
  editing: PanelStudent | 'new' | null
  setEditing: (value: PanelStudent | 'new' | null) => void
  refetch: () => void
}) {
  if (!editing) return null
  return (
    <StudentDialog
      student={editing === 'new' ? null : editing}
      onClose={() => setEditing(null)}
      onSaved={() => {
        setEditing(null)
        refetch()
      }}
    />
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

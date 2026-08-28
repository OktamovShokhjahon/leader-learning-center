'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Users, Pencil, Wallet, Download } from 'lucide-react'
import { STUDENT_STATUSES } from '@leader/shared/schemas'
import { useQuery, downloadAuthenticatedFile, type Paginated } from '@/lib/api/use-api'
import { useAuth } from '@/lib/auth/auth-context'
import { NewButton, RowAction, FilterSelect } from './table-kit'
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

/**
 * TZ §9.1 — the student list.
 *
 * One status filter, not two: "Debtors" had its own button beside a `overdue`
 * chip that issued the identical query, so the same list was reachable two ways
 * and neither told you the other was on.
 */
export function StudentsTable() {
  const t = useTranslations('panel.students')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const query = new URLSearchParams({ page: String(page), limit: '25' })
  if (search.trim().length >= 2) query.set('search', search.trim())
  if (status) query.set('status', status)

  const { data, loading, error, refetch } = useQuery<Paginated<Student>>(`/students?${query}`)
  const [editing, setEditing] = useState<PanelStudent | 'new' | null>(null)
  const { getToken } = useAuth()

  const [exporting, setExporting] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)

  /**
   * Downloads the list as it is filtered, not the whole table — the same
   * `search` and `status` go to the export route, minus the paging.
   *
   * The route needs the bearer token (§8 keeps tokens out of cookies), so the
   * workbook is fetched with the header and handed to the browser as an
   * `<a download>` — no popup for a blocker to refuse, and the file keeps the
   * name the route dated it with.
   */
  const exportWorkbook = async () => {
    const params = new URLSearchParams()
    if (search.trim().length >= 2) params.set('search', search.trim())
    if (status) params.set('status', status)
    setExporting(true)
    setExportFailed(false)
    const token = await getToken()
    const saved = await downloadAuthenticatedFile(
      `/students/export?${params}`,
      token,
      'students.xlsx',
    )
    setExporting(false)
    // A workbook that never arrives used to fail in silence.
    setExportFailed(!saved)
  }

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

        <FilterSelect
          label={t('statusLabel')}
          value={status}
          allLabel={t('statusAll')}
          // Debtors is the list this screen is opened for, so the control wears
          // the alarm rather than hiding it behind a closed dropdown.
          tone={status === 'overdue' ? 'danger' : 'default'}
          options={STUDENT_STATUSES.map((option) => ({
            value: option,
            label: t(`status.${option}`),
          }))}
          onChange={(next) => {
            setStatus(next)
            setPage(1)
          }}
        />

        <button
          type="button"
          onClick={() => void exportWorkbook()}
          disabled={exporting}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-pill border border-border-subtle bg-surface px-4 text-xs font-medium text-ink-soft transition-colors hover:border-glaze-500 hover:text-glaze-700 disabled:cursor-wait disabled:opacity-60 dark:text-navy-200"
        >
          <Download className="size-4" aria-hidden />
          {t('export')}
        </button>

        {exportFailed ? (
          <span role="alert" className="text-2xs text-danger">
            {t('exportFailed')}
          </span>
        ) : null}
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

'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Inbox } from 'lucide-react'
import { LEAD_STATUSES } from '@leader/shared/schemas'
import type { Locale } from '@leader/shared/locales'
import { useQuery, type Paginated } from '@/lib/api/use-api'
import { formatDate } from '@/lib/date'
import { Panel, TableShell, Th, Td, Loading, ErrorBox, Empty, StatusPill } from './primitives'
import { FilterChip, Pagination } from './table-kit'
import type { Lead } from './leads-board'

/**
 * E1 — "Applicants page as a list/table": search, filter, sort and pagination,
 * alongside the kanban rather than instead of it — dragging a card between
 * stages is still the fastest way to work the funnel day to day, but a sales
 * manager scanning fifty rows for "who hasn't been contacted since Monday"
 * wants a sortable column, not six scrolling lanes.
 */
export function LeadsTable({ search, onOpen }: { search: string; onOpen: (lead: Lead) => void }) {
  const t = useTranslations('panel.leads')
  const locale = useLocale() as Locale
  const [status, setStatus] = useState<string | null>(null)
  const [sort, setSort] = useState('-createdAt')
  const [page, setPage] = useState(1)

  const query = new URLSearchParams({ page: String(page), limit: '25', sort })
  if (search.trim().length >= 2) query.set('search', search.trim())
  if (status) query.set('status', status)

  const { data, loading, error } = useQuery<Paginated<Lead>>(`/leads?${query}`)

  const sortableHeader = (label: string, field: string) => (
    <button
      type="button"
      onClick={() => {
        setSort((current) => (current === field ? `-${field}` : field))
        setPage(1)
      }}
      className="inline-flex items-center gap-1"
    >
      {label}
      {sort.replace('-', '') === field ? (sort.startsWith('-') ? ' ↓' : ' ↑') : ''}
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          label={t('all')}
          active={status === null}
          onClick={() => {
            setStatus(null)
            setPage(1)
          }}
        />
        {LEAD_STATUSES.map((option) => (
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

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={Inbox} /> : null}

      {data && data.items.length > 0 ? (
        <Panel action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}>
          <TableShell>
            <thead>
              <tr>
                <Th>{sortableHeader(t('fullName'), 'fullName')}</Th>
                <Th>{t('phone')}</Th>
                <Th>{t('source')}</Th>
                <Th>{t('course')}</Th>
                <Th>{t('statusLabel')}</Th>
                <Th>{sortableHeader(t('createdAt'), 'createdAt')}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((lead) => (
                <tr
                  key={lead._id}
                  onClick={() => onOpen(lead)}
                  className="cursor-pointer hover:bg-navy-50/50 dark:hover:bg-navy-800/40"
                >
                  <Td className="font-medium text-ink dark:text-white">{lead.fullName}</Td>
                  <Td className="font-mono text-2xs text-ink-muted">{lead.phone}</Td>
                  <Td className="text-2xs text-ink-muted">{lead.source ? t(`sourceOption.${lead.source}`) : '—'}</Td>
                  <Td className="text-2xs text-ink-muted">{lead.courseSlug ?? '—'}</Td>
                  <Td>
                    <StatusPill status={lead.status} label={t(`status.${lead.status}`)} />
                  </Td>
                  <Td className="font-mono text-2xs text-ink-muted">
                    {formatDate(lead.createdAt, locale)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      <Pagination page={page} pages={data?.pages ?? 1} onChange={setPage} />
    </div>
  )
}

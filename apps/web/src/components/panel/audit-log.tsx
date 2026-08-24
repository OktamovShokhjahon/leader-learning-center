'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ScrollText, ShieldAlert } from 'lucide-react'
import { useQuery, type Paginated } from '@/lib/api/use-api'
import { Panel, TableShell, Th, Td, Loading, ErrorBox, Empty } from './primitives'
import { SearchBox, FilterChip, Pagination, useDebounced } from './table-kit'
import { DateField } from './form-kit'
import { cn } from '@/lib/utils'

type Entry = {
  _id: string
  at: string
  action: string
  actorName?: string
  role?: string
  entity?: string
  entityId?: string
  entityKey?: string
  path?: string
  outcome?: string
  reason?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

/**
 * TZ §21.3 — the audit log, "searchable and filterable by actor, entity,
 * period", and **not deletable from the UI by anyone, including SuperAdmin**.
 *
 * So there is no delete control here, deliberately, and there is no API route
 * that would answer one.
 *
 * The before/after diff expands on demand rather than rendering inline: most
 * rows are read for *what happened*, and a wall of JSON on every one of them
 * buries exactly the row someone came looking for.
 */
export function AuditLog() {
  const t = useTranslations('panel.audit')

  const [search, setSearch] = useState('')
  const [family, setFamily] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  const term = useDebounced(search)
  const query = new URLSearchParams({ page: String(page), limit: '50' })
  if (term.trim().length >= 2) query.set('search', term.trim())
  if (family) query.set('action', family)
  if (outcome) query.set('outcome', outcome)
  if (from) query.set('from', new Date(from).toISOString())
  if (to) query.set('to', new Date(`${to}T23:59:59`).toISOString())

  const { data, loading, error } = useQuery<Paginated<Entry>>(`/audit?${query}`)
  const { data: facets } = useQuery<{ families: string[] }>('/audit/facets')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder={t('searchPlaceholder')}
        />
        <div className="flex items-center gap-2">
          <DateField value={from} onChange={setFrom} max={to || undefined} />
          <span className="text-2xs text-ink-muted">—</span>
          <DateField value={to} onChange={setTo} min={from || undefined} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <FilterChip label={t('allActions')} active={family === null} onClick={() => setFamily(null)} />
        {(facets?.families ?? []).map((option) => (
          <FilterChip
            key={option}
            label={option}
            active={family === option}
            onClick={() => {
              setFamily(option)
              setPage(1)
            }}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-border-subtle" aria-hidden />
        {/* §30.2 — a denied finance request is the entry worth finding fastest. */}
        <FilterChip
          label={t('denied')}
          active={outcome === 'failure'}
          onClick={() => {
            setOutcome(outcome === 'failure' ? null : 'failure')
            setPage(1)
          }}
        />
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={ScrollText} /> : null}

      {data && data.items.length > 0 ? (
        <Panel action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}>
          <TableShell>
            <thead>
              <tr>
                <Th>{t('when')}</Th>
                <Th>{t('who')}</Th>
                <Th>{t('action')}</Th>
                <Th>{t('entity')}</Th>
                <Th>{t('outcome')}</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => {
                const open = expanded === entry._id
                const hasDiff = Boolean(entry.before || entry.after || entry.reason)

                return (
                  <tr
                    key={entry._id}
                    onClick={() => hasDiff && setExpanded(open ? null : entry._id)}
                    className={cn(
                      'hover:bg-navy-50/50 dark:hover:bg-navy-800/40',
                      hasDiff && 'cursor-pointer',
                    )}
                  >
                    <Td className="whitespace-nowrap font-mono text-2xs text-ink-muted">
                      {new Date(entry.at).toLocaleString()}
                    </Td>
                    <Td>
                      <span className="text-ink dark:text-white">{entry.actorName ?? '—'}</span>
                      {entry.role ? (
                        <span className="ml-2 text-2xs text-ink-muted">{entry.role}</span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="font-mono text-2xs text-navy-700 dark:text-aqua-300">
                        {entry.action}
                      </span>
                      {open ? (
                        <pre className="mt-2 max-w-md overflow-x-auto rounded-input bg-navy-50/60 p-2 text-2xs leading-relaxed text-ink-soft dark:bg-navy-800/50 dark:text-navy-200">
                          {entry.reason ? `${entry.reason}\n` : ''}
                          {entry.before ? `- ${JSON.stringify(entry.before)}\n` : ''}
                          {entry.after ? `+ ${JSON.stringify(entry.after)}` : ''}
                        </pre>
                      ) : null}
                    </Td>
                    <Td className="text-2xs text-ink-muted">
                      {entry.entity ?? entry.path ?? '—'}
                      {entry.entityKey ? (
                        <span className="ml-1.5 font-mono opacity-70">{entry.entityKey}</span>
                      ) : null}
                    </Td>
                    <Td>
                      {entry.outcome === 'failure' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-pill bg-danger/12 px-2.5 py-1 text-2xs font-medium text-danger">
                          <ShieldAlert className="size-3" aria-hidden />
                          {t('denied')}
                        </span>
                      ) : (
                        <span className="text-2xs text-ink-muted">—</span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      <Pagination page={page} pages={data?.pages ?? 1} onChange={setPage} />

      <p className="text-2xs text-ink-muted">{t('retentionNote')}</p>
    </div>
  )
}

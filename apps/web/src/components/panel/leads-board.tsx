'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Phone, Send, CalendarClock, UserCheck, Inbox, LayoutGrid, Table2 } from 'lucide-react'
import { LEAD_STATUSES, LEAD_SOURCES, formatPhone } from '@leader/shared/schemas'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { formatDate } from '@/lib/date'
import { Loading, ErrorBox, Empty } from './primitives'
import { Dialog, Field, INPUT, Select, MoneyInput, DateField, Action, DialogError } from './form-kit'
import { NewButton, SearchBox, useDebounced } from './table-kit'
import { LeadsTable } from './leads-table'
import { CeramicTile, initials } from '@/components/ui/ceramic-tile'
import { cn } from '@/lib/utils'

export type Lead = {
  _id: string
  fullName: string
  phone: string
  age?: number
  schoolClass?: string
  courseSlug?: string
  source?: string
  status: string
  comment?: string
  nextActionAt?: string
  isReturning?: boolean
  assignedTo?: string
  createdAt: string
}

type Group = { _id: string; name: string; price: number }
type Course = { _id: string; slug: string; name: Record<string, string> }

/**
 * TZ §7.2 — the lead kanban.
 *
 * Columns are the §7.2 stages in the client's own words. Moving a card is a
 * `PATCH` of one field, not a re-save of the whole lead: two managers working
 * the same list at the front desk is the normal case, and sending the entire
 * record back on every drag is how one of them silently undoes the other.
 *
 * `oquvchi_boldi` is not a column you can drop into. Converting writes a
 * Student — and sometimes an Enrollment and a login — so it has its own dialog
 * that asks for the group and the fee.
 */
export function LeadsBoard() {
  const t = useTranslations('panel.leads')
  const locale = useLocale() as Locale
  const [converting, setConverting] = useState<Lead | null>(null)
  const [detail, setDetail] = useState<Lead | null>(null)
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)

  const query = new URLSearchParams({ limit: '100' })
  if (debouncedSearch.trim().length >= 2) query.set('search', debouncedSearch.trim())

  const { data, loading, error, refetch } = useQuery<Paginated<Lead>>(`/leads?${query}`)
  const { data: funnel } = useQuery<Record<string, number>>('/leads/funnel')

  const move = useMutation<{ status: string; rejectReason?: string }, Lead>(
    () => `/leads/${detail?._id ?? ''}`,
    'PATCH',
  )

  // `oquvchi_boldi` and `rad_etdi` are outcomes; they get their own quieter columns.
  const columns = LEAD_STATUSES

  return (
    <div className="flex flex-col gap-5">
      {/* E1 — search plus a table view alongside the kanban; E2 — add one by hand. */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder={t('searchPlaceholder')} />
        <NewButton label={t('createNew')} onClick={() => setCreating(true)} />
        <div className="inline-flex gap-1 rounded-pill border border-border-subtle p-1">
          <button
            type="button"
            onClick={() => setView('kanban')}
            className={cn(
              'inline-flex items-center gap-2 rounded-pill px-3 py-2 text-2xs font-medium transition-colors',
              view === 'kanban' ? 'bg-navy-600 text-white' : 'text-ink-soft dark:text-navy-200',
            )}
          >
            <LayoutGrid className="size-3.5" aria-hidden />
            {t('viewKanban')}
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={cn(
              'inline-flex items-center gap-2 rounded-pill px-3 py-2 text-2xs font-medium transition-colors',
              view === 'table' ? 'bg-navy-600 text-white' : 'text-ink-soft dark:text-navy-200',
            )}
          >
            <Table2 className="size-3.5" aria-hidden />
            {t('viewTable')}
          </button>
        </div>
      </div>

      {creating ? (
        <NewLeadDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            void refetch()
          }}
        />
      ) : null}

      {view === 'table' ? (
        <LeadsTable search={debouncedSearch} onOpen={setDetail} />
      ) : loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox code={error.code} message={error.message} />
      ) : !data || data.items.length === 0 ? (
        <Empty title={t('none')} Icon={Inbox} />
      ) : (
      <div className="grid gap-4 overflow-x-auto pb-2 lg:grid-cols-3 xl:grid-cols-6">
        {columns.map((status) => {
          const cards = data.items.filter((lead) => lead.status === status)
          return (
            <section key={status} className="flex min-w-56 flex-col gap-3">
              <header className="flex items-center justify-between gap-2 border-b border-border-subtle pb-2">
                <h2 className="text-2xs font-medium uppercase tracking-[0.1em] text-ink-muted">
                  {t(`status.${status}`)}
                </h2>
                <span className="font-mono text-2xs text-ink-muted">
                  {funnel?.[status] ?? cards.length}
                </span>
              </header>

              <ul className="flex flex-col gap-2">
                {cards.map((lead) => (
                  <li key={lead._id}>
                    <button
                      type="button"
                      onClick={() => setDetail(lead)}
                      className="flex w-full flex-col gap-2 rounded-card border border-border-subtle bg-surface p-3 text-left transition-colors hover:border-glaze-300"
                    >
                      <span className="flex items-center gap-2.5">
                        <CeramicTile
                          seed={lead._id}
                          label={initials(lead.fullName)}
                          dense
                          className="size-8 shrink-0 rounded-input"
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-xs font-medium text-ink dark:text-white">
                            {lead.fullName}
                          </span>
                          <span className="font-mono text-2xs text-ink-muted">
                            {formatPhone(lead.phone)}
                          </span>
                        </span>
                      </span>

                      <span className="flex flex-wrap items-center gap-1.5">
                        {lead.courseSlug ? (
                          <span className="rounded-pill bg-glaze-50 px-2 py-0.5 text-2xs text-glaze-800 dark:bg-navy-800 dark:text-glaze-200">
                            {lead.courseSlug}
                          </span>
                        ) : null}
                        {lead.isReturning ? (
                          <span className="rounded-pill bg-warning/15 px-2 py-0.5 text-2xs text-warning">
                            {t('returning')}
                          </span>
                        ) : null}
                        {lead.nextActionAt ? (
                          <span className="inline-flex items-center gap-1 text-2xs text-ink-muted">
                            <CalendarClock className="size-3" aria-hidden />
                            {formatDate(lead.nextActionAt, locale)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      )}

      {detail ? (
        <LeadDetail
          lead={detail}
          onClose={() => setDetail(null)}
          onConvert={() => {
            setConverting(detail)
            setDetail(null)
          }}
          onSaved={() => {
            setDetail(null)
            void refetch()
          }}
          move={move}
        />
      ) : null}

      {converting ? (
        <ConvertDialog
          lead={converting}
          onClose={() => setConverting(null)}
          onSaved={() => {
            setConverting(null)
            void refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function LeadDetail({
  lead,
  onClose,
  onConvert,
  onSaved,
  move,
}: {
  lead: Lead
  onClose: () => void
  onConvert: () => void
  onSaved: () => void
  move: ReturnType<typeof useMutation<{ status: string; rejectReason?: string }, Lead>>
}) {
  const t = useTranslations('panel.leads')
  const [status, setStatus] = useState(lead.status)
  const [rejectReason, setRejectReason] = useState('')
  const [nextActionAt, setNextActionAt] = useState((lead.nextActionAt ?? '').slice(0, 10))

  const trial = useMutation<{ at: string }, Lead>(`/leads/${lead._id}/trial`)
  const patch = useMutation<Record<string, unknown>, Lead>(`/leads/${lead._id}`, 'PATCH')

  // §7.2 — a refusal without a reason is a hole in the churn report, and the API
  // refuses it, so the form asks first.
  const needsReason = status === 'rad_etdi' && rejectReason.trim().length === 0

  return (
    <Dialog title={lead.fullName} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 text-2xs">
          <div>
            <dt className="text-ink-muted">{t('phone')}</dt>
            <dd className="font-mono text-ink dark:text-white">{formatPhone(lead.phone)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('source')}</dt>
            <dd className="text-ink dark:text-white">{lead.source ?? '—'}</dd>
          </div>
          {lead.age ? (
            <div>
              <dt className="text-ink-muted">{t('age')}</dt>
              <dd className="text-ink dark:text-white">{lead.age}</dd>
            </div>
          ) : null}
          {lead.courseSlug ? (
            <div>
              <dt className="text-ink-muted">{t('course')}</dt>
              <dd className="text-ink dark:text-white">{lead.courseSlug}</dd>
            </div>
          ) : null}
        </dl>

        {lead.comment ? (
          <p className="rounded-input bg-navy-50/60 p-3 text-2xs text-ink-soft dark:bg-navy-800/50 dark:text-navy-200">
            {lead.comment}
          </p>
        ) : null}

        <div className="flex gap-2">
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-pill border border-border-subtle text-xs font-medium text-ink-soft hover:border-navy-600/40 dark:text-navy-200"
          >
            <Phone className="size-4" aria-hidden />
            {t('call')}
          </a>
          <a
            href={`https://t.me/${lead.phone.replace('+', '')}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-pill border border-border-subtle text-xs font-medium text-ink-soft hover:border-navy-600/40 dark:text-navy-200"
          >
            <Send className="size-4" aria-hidden />
            {t('telegram')}
          </a>
        </div>

        <Field label={t('statusLabel')}>
          <Select
            value={status}
            onChange={setStatus}
            options={LEAD_STATUSES.filter((option) => option !== 'oquvchi_boldi').map((option) => ({
              value: option,
              label: t(`status.${option}`),
            }))}
          />
        </Field>

        {status === 'rad_etdi' ? (
          <Field label={t('rejectReason')} required>
            <input
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className={INPUT}
            />
          </Field>
        ) : null}

        <Field label={t('nextAction')} hint={t('nextActionHint')}>
          <DateField value={nextActionAt} onChange={setNextActionAt} />
        </Field>

        {patch.error ? <DialogError error={patch.error} /> : null}

        <Action
          label={t('save')}
          tone="primary"
          pending={patch.pending || move.pending}
          disabled={needsReason}
          onClick={async () => {
            const result = await patch.mutate({
              ...(status !== lead.status ? { status } : {}),
              ...(rejectReason.trim() ? { rejectReason: rejectReason.trim() } : {}),
              nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null,
            })
            if (result) onSaved()
          }}
        />

        <Action
          label={t('scheduleTrial')}
          Icon={CalendarClock}
          pending={trial.pending}
          disabled={!nextActionAt}
          onClick={async () => {
            const result = await trial.mutate({ at: new Date(nextActionAt).toISOString() })
            if (result) onSaved()
          }}
        />

        <Action label={t('convert')} Icon={UserCheck} onClick={onConvert} />
      </div>
    </Dialog>
  )
}

/** §23 — `POST /leads/:id/convert`. Replays return the original student. */
function ConvertDialog({
  lead,
  onClose,
  onSaved,
}: {
  lead: Lead
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.leads')
  const [groupId, setGroupId] = useState('')
  const [monthlyFee, setMonthlyFee] = useState<number | null>(null)
  const [createLogin, setCreateLogin] = useState(false)
  const [password, setPassword] = useState('')

  const { data: groups } = useQuery<Paginated<Group>>('/groups?limit=100&status=active')
  const convert = useMutation<Record<string, unknown>, unknown>(`/leads/${lead._id}/convert`)

  return (
    <Dialog title={t('convertTitle', { name: lead.fullName })} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label={t('group')} hint={t('groupHint')}>
          <Select
            value={groupId}
            onChange={(next) => {
              setGroupId(next)
              const group = groups?.items.find((item) => item._id === next)
              if (group && !monthlyFee) setMonthlyFee(group.price)
            }}
            placeholder={t('noGroup')}
            options={(groups?.items ?? []).map((group) => ({
              value: group._id,
              label: group.name,
            }))}
          />
        </Field>

        <Field label={t('monthlyFee')}>
          <MoneyInput value={monthlyFee} onChange={setMonthlyFee} />
        </Field>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={createLogin}
            onChange={(event) => setCreateLogin(event.target.checked)}
            className="mt-0.5 size-4 rounded border-border-subtle text-navy-600"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-ink dark:text-white">{t('createLogin')}</span>
            <span className="text-2xs text-ink-muted">{t('createLoginHint')}</span>
          </span>
        </label>

        {createLogin ? (
          <Field label={t('password')} hint={t('passwordHint')}>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={cn(INPUT, 'font-mono')}
            />
          </Field>
        ) : null}

        {convert.error ? <DialogError error={convert.error} /> : null}

        <Action
          label={t('convert')}
          Icon={UserCheck}
          tone="primary"
          pending={convert.pending}
          disabled={createLogin && password.length < 8}
          onClick={async () => {
            const result = await convert.mutate({
              ...(groupId ? { groupId } : {}),
              ...(monthlyFee !== null ? { monthlyFee } : {}),
              createLogin,
              ...(createLogin ? { password } : {}),
            })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}

/** E2 — "New Applicant" creation for Manager & SuperAdmin, `POST /leads`. */
export function NewLeadDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('panel.leads')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [courseSlug, setCourseSlug] = useState('')
  const [source, setSource] = useState('')
  const [comment, setComment] = useState('')

  const { data: courses } = useQuery<Paginated<Course>>('/courses?limit=100&sort=order')
  const create = useMutation<Record<string, unknown>, Lead>('/leads')

  const ready = fullName.trim().length >= 3 && phone.trim().length >= 9 && courseSlug

  return (
    <Dialog title={t('createNew')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label={t('fullName')} required>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} className={INPUT} />
        </Field>
        <Field label={t('phone')} required>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+998 90 123 45 67"
            className={cn(INPUT, 'font-mono')}
          />
        </Field>
        <Field label={t('course')} required>
          <Select
            value={courseSlug}
            onChange={setCourseSlug}
            placeholder={t('chooseCourse')}
            options={(courses?.items ?? []).map((course) => ({
              value: course.slug,
              label: course.name?.uz || course.slug,
            }))}
          />
        </Field>
        <Field label={t('sourceLabel')}>
          <Select
            value={source}
            onChange={setSource}
            placeholder={t('chooseSource')}
            options={LEAD_SOURCES.map((option) => ({ value: option, label: t(`sourceOption.${option}`) }))}
          />
        </Field>
        <Field label={t('comment')}>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            className={INPUT}
          />
        </Field>

        {create.error ? <DialogError error={create.error} /> : null}

        <Action
          label={t('createNew')}
          tone="primary"
          pending={create.pending}
          disabled={!ready}
          onClick={async () => {
            const result = await create.mutate({
              fullName: fullName.trim(),
              phone: phone.trim(),
              courseSlug,
              ...(source ? { source } : {}),
              ...(comment.trim() ? { comment: comment.trim() } : {}),
            })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}

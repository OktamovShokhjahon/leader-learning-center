'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Gavel, Ban, Plus } from 'lucide-react'
import { FINE_TARGETS, FINE_STATUSES } from '@leader/shared/schemas'
import type { Locale } from '@leader/shared/locales'
import { can } from '@leader/shared/permissions'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { formatDate } from '@/lib/date'
import { useAuth } from '@/lib/auth/auth-context'
import { Panel, TableShell, Th, Td, Money, Loading, ErrorBox, Empty, StatusPill } from './primitives'
import { FilterChip, Pagination, RowAction } from './table-kit'
import { Dialog, Field, INPUT, Select, MoneyInput, Action, DialogError } from './form-kit'
import { cn } from '@/lib/utils'

type Fine = {
  _id: string
  targetType: 'student' | 'employee'
  targetId: string
  targetName?: string | null
  amount: number
  reason: string
  status: string
  appliedTo?: string
  createdAt: string
}

type Person = { _id: string; fullName: string }

const STATUS_TONE: Record<string, string> = {
  issued: 'overdue',
  paid: 'paid',
  cancelled: 'cancelled',
  appealed: 'partial',
  waived: 'frozen',
}

/**
 * TZ §12 — `jarima`, for students and employees alike.
 *
 * Issuing records the debt; it does not charge it. A student fine becomes a line
 * on their next invoice and an employee fine a payslip deduction, both applied
 * by the run that generates those — which is what stops a fine being charged
 * twice when either run is repeated.
 */
export function FinesTable() {
  const t = useTranslations('panel.fines')
  const locale = useLocale() as Locale
  const { user } = useAuth()

  const [targetType, setTargetType] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [issuing, setIssuing] = useState(false)
  const [cancelling, setCancelling] = useState<Fine | null>(null)

  const query = new URLSearchParams({ page: String(page), limit: '25' })
  if (targetType) query.set('targetType', targetType)
  if (status) query.set('status', status)

  const { data, loading, error, refetch } = useQuery<Paginated<Fine> & { totalAmount: number }>(
    `/fines?${query}`,
  )

  const roles = user?.roles.map((assignment) => assignment.role) ?? []
  const mayIssue = roles.some((role) => can(role, 'fine.issue'))
  const mayCancel = roles.some((role) => can(role, 'fine.cancel'))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label={t('allTargets')}
            active={targetType === null}
            onClick={() => setTargetType(null)}
          />
          {FINE_TARGETS.map((option) => (
            <FilterChip
              key={option}
              label={t(`targets.${option}`)}
              active={targetType === option}
              onClick={() => {
                setTargetType(option)
                setPage(1)
              }}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-border-subtle" aria-hidden />
          {FINE_STATUSES.map((option) => (
            <FilterChip
              key={option}
              label={t(`statuses.${option}`)}
              active={status === option}
              onClick={() => {
                setStatus(status === option ? null : option)
                setPage(1)
              }}
            />
          ))}
        </div>

        <span className="flex-1" />

        {data ? (
          <span className="text-2xs text-ink-muted">
            {t('total')} <Money amount={data.totalAmount} className="text-ink dark:text-white" />
          </span>
        ) : null}

        {mayIssue ? (
          <button
            type="button"
            onClick={() => setIssuing(true)}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-pill bg-clay-500 px-5 text-xs font-medium text-white hover:bg-clay-400"
          >
            <Plus className="size-4" aria-hidden />
            {t('issue')}
          </button>
        ) : null}
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={Gavel} /> : null}

      {data && data.items.length > 0 ? (
        <Panel action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}>
          <TableShell>
            <thead>
              <tr>
                <Th>{t('date')}</Th>
                <Th>{t('target')}</Th>
                <Th>{t('reason')}</Th>
                <Th className="text-right">{t('amount')}</Th>
                <Th>{t('statusLabel')}</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((fine) => (
                <tr key={fine._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <Td className="whitespace-nowrap font-mono text-2xs text-ink-muted">
                    {formatDate(fine.createdAt, locale)}
                  </Td>
                  <Td>
                    <span className="font-medium text-ink dark:text-white">
                      {fine.targetName ?? '—'}
                    </span>
                    <span className="ml-2 text-2xs text-ink-muted">
                      {t(`targets.${fine.targetType}`)}
                    </span>
                  </Td>
                  <Td className="max-w-xs truncate text-2xs text-ink-soft dark:text-navy-200">
                    {fine.reason}
                  </Td>
                  <Td className="text-right">
                    <Money amount={fine.amount} compact />
                  </Td>
                  <Td>
                    <StatusPill
                      status={STATUS_TONE[fine.status] ?? 'pending'}
                      label={t(`statuses.${fine.status}`)}
                    />
                  </Td>
                  <Td className="text-right">
                    {mayCancel && fine.status === 'issued' ? (
                      <RowAction
                        label={t('cancel')}
                        Icon={Ban}
                        tone="danger"
                        onClick={() => setCancelling(fine)}
                      />
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      <Pagination page={page} pages={data?.pages ?? 1} onChange={setPage} />

      {issuing ? (
        <IssueDialog
          onClose={() => setIssuing(false)}
          onSaved={() => {
            setIssuing(false)
            void refetch()
          }}
        />
      ) : null}

      {cancelling ? (
        <CancelDialog
          fine={cancelling}
          onClose={() => setCancelling(null)}
          onSaved={() => {
            setCancelling(null)
            void refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function IssueDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('panel.fines')
  const [targetType, setTargetType] = useState<'student' | 'employee'>('student')
  const [targetId, setTargetId] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [reason, setReason] = useState('')

  const students = useQuery<Paginated<Person>>(
    targetType === 'student' ? '/students?limit=100' : null,
  )
  const staff = useQuery<Paginated<Person>>(
    targetType === 'employee' ? '/users?limit=100&status=active' : null,
  )
  const save = useMutation<Record<string, unknown>, Fine>('/fines')

  const people = targetType === 'student' ? students.data?.items : staff.data?.items

  // §12.1 — "free text, required for manual", and the API asks for 10 characters
  // because "late" is not a reason anyone can act on three months later.
  const ready = targetId && amount && reason.trim().length >= 10

  return (
    <Dialog title={t('issue')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label={t('target')}>
          <div className="grid grid-cols-2 gap-2">
            {FINE_TARGETS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setTargetType(option)
                  setTargetId('')
                }}
                aria-pressed={targetType === option}
                className={cn(
                  'h-11 rounded-input border text-xs font-medium transition-colors',
                  targetType === option
                    ? 'border-transparent bg-navy-600 text-white'
                    : 'border-border-subtle text-ink-soft dark:text-navy-200',
                )}
              >
                {t(`targets.${option}`)}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('person')} required>
          <Select
            value={targetId}
            onChange={setTargetId}
            placeholder={t('choose')}
            options={(people ?? []).map((person) => ({
              value: person._id,
              label: person.fullName,
            }))}
          />
        </Field>

        <Field label={t('amount')} required>
          <MoneyInput value={amount} onChange={setAmount} />
        </Field>

        <Field label={t('reason')} hint={t('reasonHint')} required>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={cn(INPUT, 'resize-y')}
          />
        </Field>

        {save.error ? <DialogError error={save.error} /> : null}

        <Action
          label={t('issue')}
          Icon={Gavel}
          tone="primary"
          pending={save.pending}
          disabled={!ready}
          onClick={async () => {
            const result = await save.mutate({
              targetType,
              targetId,
              amount,
              reason: reason.trim(),
            })
            if (result) onSaved()
          }}
        />

        <p className="text-2xs text-ink-muted">{t('issueHint')}</p>
      </div>
    </Dialog>
  )
}

function CancelDialog({
  fine,
  onClose,
  onSaved,
}: {
  fine: Fine
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.fines')
  const [reason, setReason] = useState('')
  const cancel = useMutation<{ reason: string }, Fine>(`/fines/${fine._id}/cancel`)

  return (
    <Dialog title={t('cancelTitle')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-xs leading-relaxed text-ink-soft dark:text-navy-200">
          {t('cancelBody', { name: fine.targetName ?? '—' })}
        </p>

        <Field label={t('cancelReason')} required>
          <input
            value={reason}
            autoFocus
            onChange={(event) => setReason(event.target.value)}
            className={INPUT}
          />
        </Field>

        {cancel.error ? <DialogError error={cancel.error} /> : null}

        <Action
          label={t('cancel')}
          Icon={Ban}
          tone="danger"
          pending={cancel.pending}
          disabled={reason.trim().length < 3}
          onClick={async () => {
            const result = await cancel.mutate({ reason: reason.trim() })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}

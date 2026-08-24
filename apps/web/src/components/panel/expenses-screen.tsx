'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Receipt, Plus, Check, X, ShieldAlert } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { can } from '@leader/shared/permissions'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { useAuth } from '@/lib/auth/auth-context'
import { Panel, TableShell, Th, Td, Money, Loading, ErrorBox, Empty, StatusPill } from './primitives'
import { FilterChip, Pagination } from './table-kit'
import {
  Dialog,
  Field,
  INPUT,
  MoneyInput,
  DateField,
  Action,
  DialogError,
  type Localized,
} from './form-kit'
import { cn } from '@/lib/utils'

type Category = {
  _id: string
  slug: string
  name: Localized
  icon: string
  color: string
  petty: boolean
  payrollOnly: boolean
}

type Expense = {
  _id: string
  amount: number
  spentAt: string
  comment?: string
  vendor?: string
  status: string
  categoryId?: Category | string
}

/**
 * TZ §13 — `harajat`.
 *
 * §13.1 sets the budget for the add path: four fields, "under 10 seconds to
 * record an expense". So the category is a grid of coloured tiles rather than a
 * dropdown — a dropdown costs two taps and a read — the date defaults to today,
 * and the comment is optional. Amount is the only thing you must type.
 */
export function ExpensesScreen() {
  const t = useTranslations('panel.expenses')
  const locale = useLocale() as Locale
  const { user } = useAuth()

  const [status, setStatus] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)

  const query = new URLSearchParams({ page: String(page), limit: '25' })
  if (status) query.set('status', status)

  const { data, loading, error, refetch } = useQuery<
    Paginated<Expense> & { totalAmount: number }
  >(`/expenses?${query}`)
  const { data: categories } = useQuery<{ items: Category[] }>('/expenses/categories')

  const mayApprove = (user?.roles ?? []).some((assignment) =>
    can(assignment.role, 'expense.approve'),
  )

  const label = (category?: Category | string) =>
    typeof category === 'object' ? category.name?.[locale] || category.name?.uz : '—'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip label={t('all')} active={status === null} onClick={() => setStatus(null)} />
          {['pending_approval', 'approved', 'rejected'].map((option) => (
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

        <span className="flex-1" />

        {data ? (
          <span className="text-2xs text-ink-muted">
            {t('total')} <Money amount={data.totalAmount} className="text-ink dark:text-white" />
          </span>
        ) : null}

        {/* §13.1 — "a single floating + Harajat button available from anywhere". */}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-pill bg-clay-500 px-5 text-xs font-medium text-white transition-colors hover:bg-clay-400"
        >
          <Plus className="size-4" aria-hidden />
          {t('add')}
        </button>
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={Receipt} /> : null}

      {data && data.items.length > 0 ? (
        <Panel action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}>
          <TableShell>
            <thead>
              <tr>
                <Th>{t('date')}</Th>
                <Th>{t('category')}</Th>
                <Th>{t('comment')}</Th>
                <Th className="text-right">{t('amount')}</Th>
                <Th>{t('statusLabel')}</Th>
                {mayApprove ? <Th className="text-right" /> : null}
              </tr>
            </thead>
            <tbody>
              {data.items.map((expense) => (
                <tr key={expense._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <Td className="font-mono text-2xs text-ink-muted">
                    {new Date(expense.spentAt).toLocaleDateString()}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      {typeof expense.categoryId === 'object' ? (
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-pill"
                          style={{ background: expense.categoryId.color }}
                        />
                      ) : null}
                      <span className="text-ink dark:text-white">{label(expense.categoryId)}</span>
                    </span>
                  </Td>
                  <Td className="text-2xs text-ink-muted">
                    {expense.comment || expense.vendor || '—'}
                  </Td>
                  <Td className="text-right">
                    <Money amount={expense.amount} compact />
                  </Td>
                  <Td>
                    <StatusPill
                      status={expense.status === 'approved' ? 'paid' : expense.status === 'rejected' ? 'cancelled' : 'pending'}
                      label={t(`status.${expense.status}`)}
                    />
                  </Td>
                  {mayApprove ? (
                    <Td className="text-right">
                      {expense.status === 'pending_approval' ? (
                        <Decision id={expense._id} onDone={refetch} />
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      <Pagination page={page} pages={data?.pages ?? 1} onChange={setPage} />

      {adding ? (
        <QuickAdd
          categories={categories?.items ?? []}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            void refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function Decision({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useTranslations('panel.expenses')
  const approve = useMutation<{ reason?: string }, unknown>(`/expenses/${id}/approve`)
  const reject = useMutation<{ reason?: string }, unknown>(`/expenses/${id}/reject`)
  const busy = approve.pending || reject.pending

  return (
    <span className="flex justify-end gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (await approve.mutate({})) onDone()
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-success/30 px-3 text-2xs font-medium text-success hover:bg-success/10 disabled:opacity-50"
      >
        <Check className="size-3.5" aria-hidden />
        {t('approve')}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (await reject.mutate({ reason: 'rejected' })) onDone()
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-danger/30 px-3 text-2xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
      >
        <X className="size-3.5" aria-hidden />
        {t('reject')}
      </button>
    </span>
  )
}

/** §13.1 — the ten-second path. Four fields, tiles not a dropdown. */
function QuickAdd({
  categories,
  onClose,
  onSaved,
}: {
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.expenses')
  const locale = useLocale() as Locale

  const [amount, setAmount] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [spentAt, setSpentAt] = useState(new Date().toISOString().slice(0, 10))
  const [comment, setComment] = useState('')

  const save = useMutation<Record<string, unknown>, { needsApproval: boolean }>('/expenses')

  // §13.2 — `Oylik` comes from payroll, so it is never an option here.
  const selectable = categories.filter((category) => !category.payrollOnly)

  return (
    <Dialog title={t('add')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label={t('amount')} required>
          <MoneyInput value={amount} onChange={setAmount} placeholder="0" />
        </Field>

        <Field label={t('category')} required>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {selectable.map((category) => (
              <button
                key={category._id}
                type="button"
                onClick={() => setCategoryId(category._id)}
                aria-pressed={categoryId === category._id}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-input border p-3 text-2xs transition-colors',
                  categoryId === category._id
                    ? 'border-transparent bg-navy-600 text-white'
                    : 'border-border-subtle text-ink-soft hover:border-navy-600/40 dark:text-navy-200',
                )}
              >
                <span
                  aria-hidden
                  className="size-5 rounded-pill"
                  style={{ background: category.color }}
                />
                <span className="line-clamp-2 text-center leading-tight">
                  {category.name?.[locale] || category.name?.uz}
                </span>
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('date')}>
          <DateField
            value={spentAt}
            onChange={setSpentAt}
            max={new Date().toISOString().slice(0, 10)}
          />
        </Field>

        <Field label={t('comment')}>
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className={INPUT}
          />
        </Field>

        {save.error ? <DialogError error={save.error} /> : null}

        <Action
          label={t('save')}
          tone="primary"
          pending={save.pending}
          disabled={!amount || !categoryId}
          onClick={async () => {
            const result = await save.mutate({
              amount,
              categoryId,
              spentAt: new Date(spentAt).toISOString(),
              ...(comment.trim() ? { comment: comment.trim() } : {}),
            })
            if (result) onSaved()
          }}
        />

        {/* §4.2 note 6 — above the ceiling this waits for the boss, and says so. */}
        <p className="flex items-start gap-2 text-2xs text-ink-muted">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('ceilingHint')}
        </p>
      </div>
    </Dialog>
  )
}

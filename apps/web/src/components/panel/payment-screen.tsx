'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Loader2, Check, Wallet, X, Download } from 'lucide-react'
import { PAYMENT_METHODS, type PaymentMethod } from '@leader/shared/schemas'
import { parseSoum } from '@leader/shared/money'
import { useAuth } from '@/lib/auth/auth-context'
import { request, useMutation, openReceipt, openBlankTab } from '@/lib/api/use-api'
import { Panel, Money, ErrorBox, Empty } from './primitives'
import { CeramicTile, initials } from '@/components/ui/ceramic-tile'
import { cn } from '@/lib/utils'

type Hit = {
  _id: string
  fullName: string
  phone?: string
  status: string
  balance: number
  debt: number
}

type AcceptedPayment = {
  payment: { _id: string; receiptNo?: string; amount: number; method: string }
  replayed: boolean
}

/**
 * TZ §11.2 — "The most-used screen in the whole CRM."
 *
 * The whole design is the stated budget: "Search a student by name or by the
 * last 4 digits of a phone — results appear as you type … One click 'Accept
 * payment' → modal pre-filled with the outstanding amount → choose method →
 * confirm. Under 15 seconds, no page reload."
 *
 * So: search is debounced and live, picking a student pre-fills the outstanding
 * amount, cash is preselected because it is the common case, and confirming
 * never leaves the page.
 */
export function PaymentScreen() {
  const t = useTranslations('panel.payments')
  const { getToken } = useAuth()

  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Hit | null>(null)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('naqd')
  const [receipt, setReceipt] = useState<AcceptedPayment | null>(null)

  /**
   * One idempotency key per opened modal (§26.4). A double-tapped Confirm
   * replays the same key, and the API returns the original payment instead of
   * taking the money twice.
   */
  const idempotencyKey = useRef<string>('')

  const { mutate, pending, error } = useMutation<
    {
      studentId: string
      amount: number
      method: PaymentMethod
      idempotencyKey: string
    },
    AcceptedPayment
  >('/payments')

  // Debounced live search — 250 ms is under the threshold where typing feels laggy.
  useEffect(() => {
    if (term.trim().length < 2) {
      setHits([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      const token = await getToken()
      const result = await request<Hit[]>(
        `/students/search?q=${encodeURIComponent(term.trim())}`,
        token,
      )
      if (cancelled) return
      setHits(result.data ?? [])
      setSearching(false)
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term, getToken])

  const open = (hit: Hit) => {
    setSelected(hit)
    // Pre-filled with what is outstanding — the cashier confirms rather than types.
    setAmount(hit.debt > 0 ? String(hit.debt) : '')
    setMethod('naqd')
    setReceipt(null)
    idempotencyKey.current = `pay-${hit._id}-${Date.now()}`
  }

  const close = () => {
    setSelected(null)
    setReceipt(null)
  }

  const parsed = useMemo(() => parseSoum(amount) ?? 0, [amount])

  const confirm = async () => {
    if (!selected || parsed <= 0) return
    const result = await mutate({
      studentId: selected._id,
      amount: parsed,
      method,
      idempotencyKey: idempotencyKey.current,
    })
    if (result) {
      setReceipt(result)
      // Refresh the hit so the debt shown is the debt that remains.
      const token = await getToken()
      const refreshed = await request<Hit[]>(
        `/students/search?q=${encodeURIComponent(term.trim())}`,
        token,
      )
      setHits(refreshed.data ?? [])
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
        <input
          type="search"
          value={term}
          autoFocus
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-14 w-full rounded-card border border-border-subtle bg-surface pl-12 pr-12 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-glaze-500 dark:text-white"
        />
        {searching ? (
          <Loader2
            className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-glaze-600"
            aria-hidden
          />
        ) : null}
      </div>

      {term.trim().length >= 2 && hits.length === 0 && !searching ? (
        <Empty title={t('noResults')} />
      ) : null}

      {hits.length > 0 ? (
        <Panel>
          <ul>
            {hits.map((hit) => (
              <li key={hit._id} className="border-b border-border-subtle last:border-b-0">
                <button
                  type="button"
                  onClick={() => open(hit)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-navy-50/60 dark:hover:bg-navy-800/50"
                >
                  <CeramicTile
                    seed={hit._id}
                    label={initials(hit.fullName)}
                    dense
                    className="size-11 shrink-0 rounded-input"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink dark:text-white">
                      {hit.fullName}
                    </span>
                    {hit.phone ? (
                      <span className="font-mono text-2xs text-ink-muted">{hit.phone}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <Money
                      amount={hit.debt}
                      className={cn(
                        'text-sm font-medium',
                        hit.debt > 0 ? 'text-danger' : 'text-success',
                      )}
                    />
                    <span className="text-2xs text-ink-muted">
                      {hit.debt > 0 ? t('owes') : t('settled')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* Accept-payment modal */}
      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('accept')}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={close}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-t-card bg-surface p-6 shadow-float sm:rounded-card"
          >
            {receipt ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <span className="inline-flex size-14 items-center justify-center rounded-pill bg-success/15 text-success">
                  <Check className="size-7" aria-hidden />
                </span>
                <p className="font-display text-lg text-ink dark:text-white">
                  {receipt.replayed ? t('alreadyTaken') : t('accepted')}
                </p>
                <Money amount={Math.abs(receipt.payment.amount)} className="text-xl text-navy-700 dark:text-aqua-300" />
                {receipt.payment.receiptNo ? (
                  <p className="font-mono text-2xs text-ink-muted">
                    {t('receiptNo', { no: receipt.payment.receiptNo })}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const tab = openBlankTab()
                      void getToken().then((token) => openReceipt(receipt.payment._id, token, tab))
                    }}
                    className="inline-flex h-12 items-center gap-2 rounded-pill border border-border-subtle px-5 text-xs font-medium text-ink-soft transition-colors hover:border-navy-600/40 dark:text-navy-200"
                  >
                    <Download className="size-4" aria-hidden />
                    {t('downloadReceipt')}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex h-12 items-center rounded-pill bg-navy-600 px-6 text-xs font-medium text-white"
                  >
                    {t('done')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-display text-base text-ink dark:text-white">
                      {selected.fullName}
                    </h2>
                    <span className="text-2xs text-ink-muted">
                      {t('outstanding')} <Money amount={selected.debt} />
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label={t('close')}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>

                <label className="mb-1.5 block text-xs font-medium text-ink-soft dark:text-navy-200">
                  {t('amount')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mb-4 h-14 w-full rounded-input border border-border-subtle bg-background px-4 font-mono text-lg tabular-nums text-ink outline-none focus:border-glaze-500 dark:text-white"
                />

                <label className="mb-1.5 block text-xs font-medium text-ink-soft dark:text-navy-200">
                  {t('method')}
                </label>
                <div className="mb-5 grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMethod(option)}
                      className={cn(
                        'h-12 rounded-input border text-xs font-medium transition-colors',
                        method === option
                          ? 'border-transparent bg-navy-600 text-white'
                          : 'border-border-subtle text-ink-soft hover:border-navy-600/40 dark:text-navy-200',
                      )}
                    >
                      {t(`method_${option}`)}
                    </button>
                  ))}
                </div>

                {error ? <ErrorBox code={error.code} message={error.message} /> : null}

                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending || parsed <= 0}
                  className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-clay-500 text-sm font-medium text-white transition-colors hover:bg-clay-400 disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Wallet className="size-4" aria-hidden />
                  )}
                  {t('confirm')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

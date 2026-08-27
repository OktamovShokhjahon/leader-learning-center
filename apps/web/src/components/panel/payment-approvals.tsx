'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Check, X, Loader2, ShieldCheck, Inbox } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation } from '@/lib/api/use-api'
import { formatDate } from '@/lib/date'
import { Panel, Money, Loading, ErrorBox, Empty } from './primitives'
import { cn } from '@/lib/utils'

type PendingPayment = {
  _id: string
  amount: number
  method: string
  receivedAt: string
  receiptNo?: string
  note?: string
  student?: { _id: string; fullName: string } | null
  receivedByName?: string
}

/**
 * The client's rule: an Admin approves payments, but never sees the centre's
 * finances.
 *
 * That separation is real, not cosmetic. This screen shows one payment at a
 * time with its amount, because approving without seeing the sum would be
 * meaningless — but it shows no totals, no revenue, no collection rate and no
 * comparison. Those live behind `/finance/*`, which returns 403 to an Admin and
 * writes the attempt to the audit log (§21.3).
 */
export function PaymentApprovals() {
  const t = useTranslations('panel.approvals')
  const locale = useLocale() as Locale
  const reduceMotion = useReducedMotion()

  const { data, loading, error, refetch } = useQuery<PendingPayment[]>(
    '/payments/pending-approval',
  )

  const approve = useMutation<{ paymentId: string }, unknown>(
    (body) => `/payments/${body.paymentId}/approve`,
  )
  const reject = useMutation<{ paymentId: string; reason: string }, unknown>(
    (body) => `/payments/${body.paymentId}/reject`,
  )

  /** The row currently being decided, so only its two buttons go dead. */
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const act = async (paymentId: string, action: 'approve' | 'reject') => {
    // Money moves here, so a second click on an in-flight row must not send a
    // second request — the API answers the replay with 409 ALREADY_DECIDED, but
    // the honest place to stop it is before it leaves.
    if (decidingId) return
    setDecidingId(paymentId)
    try {
      const result =
        action === 'approve'
          ? await approve.mutate({ paymentId })
          : await reject.mutate({ paymentId, reason: 'rejected_by_admin' })
      if (result !== null) void refetch()
    } finally {
      setDecidingId(null)
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />

  const pending = data ?? []

  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-start gap-2.5 rounded-card border border-info/25 bg-info/5 p-4 text-xs leading-relaxed text-ink-soft dark:text-navy-200">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        {t('scopeNote')}
      </p>

      {pending.length === 0 ? (
        <Empty title={t('none')} Icon={Inbox} />
      ) : (
        <Panel action={<span className="text-2xs text-ink-muted">{t('count', { n: pending.length })}</span>}>
          <ul>
            <AnimatePresence initial={false}>
              {pending.map((payment) => {
                // Only the row being decided is disabled — a shared `pending`
                // would freeze the whole queue on one click. `&& false` used to
                // stand here, which disabled nothing and let a double-tap send
                // two approvals for the same payment.
                const busy = decidingId === payment._id
                return (
                  <motion.li
                    key={payment._id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    // Leaving rows slide out, so an approved payment visibly
                    // leaves the queue rather than blinking away.
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, x: 24, transition: { duration: 0.18 } }
                    }
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle px-5 py-4 last:border-b-0"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-ink dark:text-white">
                        {payment.student?.fullName ?? t('unknownStudent')}
                      </span>
                      <span className="font-mono text-2xs text-ink-muted">
                        {formatDate(payment.receivedAt, locale)}
                        {' · '}
                        {t(`method.${payment.method}`)}
                        {payment.receiptNo ? ` · ${payment.receiptNo}` : ''}
                        {payment.receivedByName ? ` · ${payment.receivedByName}` : ''}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-3">
                      <Money amount={payment.amount} className="text-sm font-medium" />

                      <button
                        type="button"
                        onClick={() => act(payment._id, 'reject')}
                        disabled={busy}
                        aria-label={t('reject')}
                        className="inline-flex size-10 items-center justify-center rounded-pill border border-danger/30 text-danger transition-[background-color,transform] duration-200 hover:bg-danger/10 active:scale-95 disabled:opacity-50"
                      >
                        <X className="size-4" aria-hidden />
                      </button>

                      <button
                        type="button"
                        onClick={() => act(payment._id, 'approve')}
                        disabled={busy}
                        className={cn(
                          'inline-flex h-10 items-center gap-2 rounded-pill bg-success px-4 text-xs font-medium text-white',
                          'transition-[background-color,transform] duration-200 hover:brightness-110 active:scale-95 disabled:opacity-50',
                        )}
                      >
                        {approve.pending ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Check className="size-4" aria-hidden />
                        )}
                        {t('approve')}
                      </button>
                    </span>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </Panel>
      )}

      {approve.error ? <ErrorBox code={approve.error.code} message={approve.error.message} /> : null}
      {reject.error ? <ErrorBox code={reject.error.code} message={reject.error.message} /> : null}
    </div>
  )
}

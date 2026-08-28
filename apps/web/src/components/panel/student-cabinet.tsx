'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Wallet,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  AlertTriangle,
  CreditCard,
  ArrowRight,
  Download,
  Undo2,
  X,
} from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { can } from '@leader/shared/permissions'
import { useAuth } from '@/lib/auth/auth-context'
import { useQuery, useMutation, openReceipt, openBlankTab } from '@/lib/api/use-api'
import { formatDate, formatMonthYear } from '@/lib/date'
import { Link } from '@/i18n/navigation'
import { Panel, Money, Loading, ErrorBox, Empty, StatusPill } from './primitives'
import { CeramicTile, initials } from '@/components/ui/ceramic-tile'
import { cn } from '@/lib/utils'

type GradeRow = {
  _id: string
  value: number
  comment?: string
  lessonId?: { date: string } | null
  groupId?: { name?: string; courseId?: { name?: Record<string, string> | string } } | null
}

type GradeAverage = {
  overall: number | null
  byGroup: { groupId: string; groupName?: string; courseName?: unknown; average: number; count: number }[]
}

type AttendanceRow = {
  _id: string
  status: 'present' | 'absent' | 'late' | 'excused'
  reason?: string
  lessonId?: { date: string; status: string } | null
  groupId?: string
}

type StudentDetail = {
  _id: string
  fullName: string
  phone?: string
  photo?: string
  status: string
  monthlyFee: number
  balance: number
  totalDebt?: number
  daysOverdue?: number
  isDebtor?: boolean
  invoices: {
    _id: string
    period: string
    finalAmount: number
    paidAmount: number
    status: string
    dueDate: string
  }[]
  payments: { _id: string; amount: number; method: string; receivedAt: string; receiptNo?: string }[]
  enrollments?: { groupId?: { _id?: string; name?: string; courseId?: string } | null }[]
}


/**
 * TZ §10.2 and §16 — the student and parent view & staff student detail.
 */
export function StudentCabinet({ studentId }: { studentId: string }) {
  const t = useTranslations('panel.cabinet')
  const gradesT = useTranslations('panel.grades')
  const locale = useLocale() as Locale
  const { user, getToken } = useAuth()
  const [monthOffset, setMonthOffset] = useState(0)
  const [showPayModal, setShowPayModal] = useState(false)

  const roles = user?.roles.map((assignment) => assignment.role) ?? []
  const mayTakePayment = roles.some((role) => can(role, 'payment.accept'))
  const mayRefund = roles.some((role) => can(role, 'payment.refund'))

  const detail = useQuery<StudentDetail>(`/students/${studentId}`)
  const attendance = useQuery<AttendanceRow[]>(`/groups/attendance/history?studentId=${studentId}`)
  /**
   * B1/B2/H1 — the attendance % shown here is computed once, server-side, by
   * the same aggregation the teacher's group report and the dashboard read
   * (`GET /groups/attendance/rate`) — not recomputed locally from whatever
   * rows happen to be loaded for the visible calendar month.
   */
  const rateQuery = useQuery<{ total: number; absent: number; rate: number | null }>(
    `/groups/attendance/rate?studentId=${studentId}`,
  )
  /** C2 — grades by subject/date, plus the average, both computed server-side. */
  const grades = useQuery<GradeRow[]>(`/grades/history?studentId=${studentId}`)
  const gradeAverage = useQuery<GradeAverage>(`/grades/average?studentId=${studentId}`)

  const [refundTarget, setRefundTarget] = useState<{ _id: string; amount: number } | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const refund = useMutation<{ reason: string; amount?: number }, { amount: number }>(
    () => `/payments/${refundTarget?._id}/refund`,
    'POST',
  )

  const month = useMemo(() => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1))
  }, [monthOffset])

  const byDay = useMemo(() => {
    const map = new Map<number, AttendanceRow>()
    for (const row of attendance.data ?? []) {
      const raw = row.lessonId?.date
      if (!raw) continue
      const date = new Date(raw)
      if (
        date.getUTCFullYear() === month.getUTCFullYear() &&
        date.getUTCMonth() === month.getUTCMonth()
      ) {
        map.set(date.getUTCDate(), row)
      }
    }
    return map
  }, [attendance.data, month])

  const [openDay, setOpenDay] = useState<number | null>(null)

  if (detail.loading) return <Loading />
  if (detail.error) return <ErrorBox code={detail.error.code} message={detail.error.message} />
  if (!detail.data) return null

  const student = detail.data
  const daysInMonth = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
  ).getUTCDate()
  // ISO weekday of the 1st, so the grid starts on the right column.
  const firstWeekday = ((new Date(month).getUTCDay() + 6) % 7) + 1

  const rate = rateQuery.data?.rate ?? null
  const absences = rateQuery.data?.absent ?? 0

  const courseId =
    student.enrollments?.find((entry) => entry.groupId?.courseId)?.groupId?.courseId ?? null

  const outstanding = student.invoices.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.finalAmount - invoice.paidAmount),
    0,
  )

  const daysOverdue = student.daysOverdue ?? 0

  /**
   * A3 — prepayment/advance tracking. `student.balance` is the ledger's own
   * running credit (§11.2 — an overpayment lands there and auto-applies to
   * the next invoice), and the earliest open invoice is "next due" — both
   * read straight off the existing records, nothing new is stored for this.
   */
  const nextDue = [...student.invoices]
    .filter((invoice) => invoice.paidAmount < invoice.finalAmount)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

  const groupNames = (student.enrollments ?? [])
    .map((enrollment) => enrollment.groupId?.name)
    .filter((name): name is string => Boolean(name))

  return (
    <div className="flex flex-col gap-6">
      {/* G4 — the header card: everything about this person in one glance. */}
      <div className="flex flex-wrap items-center gap-5 rounded-card border border-border-subtle bg-surface p-6">
        {student.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- swapping in
          // a real photo the moment one exists, per CeramicTile's own contract.
          <img
            src={student.photo}
            alt=""
            className="size-16 shrink-0 rounded-input object-cover"
          />
        ) : (
          <CeramicTile
            seed={student._id}
            label={initials(student.fullName)}
            className="size-16 shrink-0 rounded-input"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate font-display text-lg text-ink dark:text-white">
              {student.fullName}
            </h2>
            <StatusPill status={student.status} label={t(`studentStatus.${student.status}`)} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-muted">
            <span>{t('roleStudent')}</span>
            {student.phone ? <span className="font-mono">{student.phone}</span> : null}
            {groupNames.length > 0 ? <span>{groupNames.join(', ')}</span> : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-2xs uppercase tracking-[0.1em] text-ink-muted">{t('balance')}</span>
          <Money
            amount={student.balance}
            className={cn('text-lg', student.balance > 0 && 'text-success')}
          />
        </div>
      </div>

      {/* Debtor Alert Banner */}
      {outstanding > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-danger/30 bg-danger/10 p-5 dark:border-danger/40 dark:bg-danger/15">
          <div className="flex items-center gap-3.5">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-danger/20 text-danger">
              <AlertTriangle className="size-5.5" aria-hidden />
            </span>
            <div className="flex flex-col gap-0.5">
              <h3 className="font-display text-sm font-semibold text-danger">
                {t('debtAlertTitle')}
              </h3>
              <p className="text-xs text-ink-soft dark:text-navy-200">
                {t('debtAlertMessage', {
                  amount: outstanding.toLocaleString(),
                  days: daysOverdue,
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mayTakePayment ? (
              <Link
                href={`/crm/payments?studentId=${student._id}`}
                className="inline-flex h-11 items-center gap-2 rounded-pill bg-danger px-5 text-xs font-medium text-white transition-colors hover:bg-danger/90"
              >
                <Wallet className="size-4" aria-hidden />
                {t('acceptPayment')}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setShowPayModal(true)}
                className="inline-flex h-11 items-center gap-2 rounded-pill bg-clay-500 px-5 text-xs font-medium text-white transition-colors hover:bg-clay-400"
              >
                <CreditCard className="size-4" aria-hidden />
                {t('payOnline')}
              </button>
            )}
          </div>
        </div>
      ) : null}

      <ul className="panel-frame-ink grid grid-cols-2 overflow-hidden rounded-card bg-surface lg:grid-cols-4">
        <Tile label={t('status')} value={<StatusPill status={student.status} label={t(`studentStatus.${student.status}`)} />} />
        <Tile label={t('attendanceRate')} value={rate === null ? '—' : `${rate}%`} />
        <Tile label={t('absences')} value={String(absences)} />
        <Tile
          label={t('outstanding')}
          value={<Money amount={outstanding} className={outstanding > 0 ? 'text-danger' : 'text-success'} />}
          last
        />
      </ul>

      {/* A3 — prepayment / next-due summary, read straight off the ledger. */}
      {student.balance > 0 || nextDue ? (
        <ul className="panel-frame-ink grid grid-cols-2 overflow-hidden rounded-card bg-surface lg:grid-cols-3">
          <Tile
            label={t('prepaidBalance')}
            value={<Money amount={student.balance} className={student.balance > 0 ? 'text-success' : undefined} />}
          />
          <Tile
            label={t('remainingBalance')}
            value={<Money amount={nextDue ? nextDue.finalAmount - nextDue.paidAmount : 0} />}
          />
          <Tile
            label={t('nextDueDate')}
            value={nextDue ? formatDate(nextDue.dueDate, locale) : '—'}
            last
          />
        </ul>
      ) : null}

      {/* Online Pay Modal */}
      {showPayModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
          onClick={() => setShowPayModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-card bg-surface p-6 shadow-float"
          >
            <h3 className="font-display text-base font-semibold text-ink dark:text-white">
              {t('payOnline')}
            </h3>
            <p className="mt-2 text-xs text-ink-soft dark:text-navy-200">
              {t('payOnlineHint')}
            </p>
            <div className="mt-4 flex flex-col gap-2 rounded-input border border-border-subtle p-3 text-xs">
              <span className="text-ink-muted">{t('outstanding')}:</span>
              <Money amount={outstanding} className="text-lg font-bold text-danger" />
            </div>
            <button
              type="button"
              onClick={() => setShowPayModal(false)}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-pill bg-navy-600 text-xs font-medium text-white"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {/* §10.2 / PIC 2 — the attendance calendar */}
      <Panel
        title={t('calendar')}
        action={
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthOffset((value) => value - 1)}
              aria-label={t('prevMonth')}
              className="inline-flex size-9 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="min-w-32 text-center font-mono text-2xs text-ink-soft dark:text-navy-200">
              {formatMonthYear(month, locale)}
            </span>
            <button
              type="button"
              disabled={monthOffset >= 0}
              onClick={() => setMonthOffset((value) => value + 1)}
              aria-label={t('nextMonth')}
              className="inline-flex size-9 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 disabled:opacity-30 dark:hover:bg-navy-800"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </span>
        }
      >
        <div className="p-5">
          <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-2xs text-ink-muted">
            {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
              <span key={day}>{t(`weekday.${day}`)}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstWeekday - 1 }, (_, index) => (
              <span key={`pad-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
              const row = byDay.get(day)
              const isAbsent = row?.status === 'absent'
              const isLate = row?.status === 'late'
              const isExcused = row?.status === 'excused'
              const isPresent = row?.status === 'present'

              return (
                <button
                  key={day}
                  type="button"
                  disabled={!row}
                  onClick={() => setOpenDay(openDay === day ? null : day)}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-full font-mono text-2xs transition-colors',
                    // PIC 2 — an absence is a red circle, not a filled block.
                    isAbsent && 'border-2 border-danger font-medium text-danger',
                    isLate && 'border-2 border-warning text-warning',
                    isExcused && 'border-2 border-info text-info',
                    isPresent && 'bg-success/12 text-success',
                    !row && 'text-ink-muted/40',
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* PIC 2 — tapping a marked day opens its detail */}
          {openDay !== null && byDay.get(openDay) ? (
            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-input border border-border-subtle bg-background p-4 text-2xs">
              <span className="font-mono text-ink-muted">
                {String(openDay).padStart(2, '0')}.
                {String(month.getUTCMonth() + 1).padStart(2, '0')}.{month.getUTCFullYear()}
              </span>
              <StatusPill
                status={byDay.get(openDay)!.status}
                label={t(`attendance.${byDay.get(openDay)!.status}`)}
              />
              {byDay.get(openDay)!.reason ? (
                <span className="text-ink-soft dark:text-navy-200">
                  {byDay.get(openDay)!.reason}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-4 border-t border-border-subtle pt-4 text-2xs text-ink-muted">
            <Legend className="border-2 border-danger" label={t('attendance.absent')} />
            <Legend className="border-2 border-warning" label={t('attendance.late')} />
            <Legend className="border-2 border-info" label={t('attendance.excused')} />
            <Legend className="bg-success/25" label={t('attendance.present')} />
          </div>
        </div>
      </Panel>

      {/* C2 — grades by subject/date, plus the average (computed once, server-side). */}
      <Panel
        title={gradesT('tab')}
        action={
          gradeAverage.data?.overall != null ? (
            <span className="text-2xs text-ink-muted">
              {gradesT('average')}: <span className="font-mono font-medium text-ink dark:text-white">{gradeAverage.data.overall}</span>
            </span>
          ) : undefined
        }
      >
        {!grades.data || grades.data.length === 0 ? (
          <div className="p-5">
            <Empty title={gradesT('noGrades')} />
          </div>
        ) : (
          <ul>
            {grades.data.slice(0, 10).map((grade) => {
              const courseName = grade.groupId?.courseId?.name
              const subject =
                typeof courseName === 'string'
                  ? courseName
                  : courseName?.[locale] ?? courseName?.uz ?? grade.groupId?.name
              return (
                <li
                  key={grade._id}
                  className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3.5 last:border-b-0"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs text-ink dark:text-white">{subject ?? '—'}</span>
                    <span className="text-2xs text-ink-muted">
                      {grade.lessonId?.date
                        ? formatDate(grade.lessonId.date, locale)
                        : ''}
                      {grade.comment ? ` · ${grade.comment}` : ''}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'inline-flex size-8 shrink-0 items-center justify-center rounded-pill text-sm font-medium',
                      grade.value >= 4
                        ? 'bg-success/12 text-success'
                        : grade.value === 3
                          ? 'bg-warning/15 text-warning'
                          : 'bg-danger/12 text-danger',
                    )}
                  >
                    {grade.value}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {/*
        The online track (§16 extended) now lives on its own screen, where the
        video, the handouts and the test sit together as one lesson. The chain
        is drawn there rather than duplicated here.
      */}
      {courseId ? (
        <Panel title={t('modules')}>
          <div className="p-5">
            <Link
              href="/cabinet/online"
              className="inline-flex h-12 items-center gap-2 rounded-pill border border-navy-600/25 px-5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
            >
              {t('openOnline')}
            </Link>
          </div>
        </Panel>
      ) : null}

      {/* §11 — invoices and payment history */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t('invoices')}>
          {student.invoices.length === 0 ? (
            <div className="p-5">
              <Empty title={t('noInvoices')} Icon={Wallet} />
            </div>
          ) : (
            <ul>
              {student.invoices.slice(0, 8).map((invoice) => (
                <li
                  key={invoice._id}
                  className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3.5 last:border-b-0"
                >
                  <span className="flex flex-col gap-1">
                    <span className="font-mono text-xs text-ink dark:text-white">
                      {invoice.period}
                    </span>
                    <StatusPill status={invoice.status} label={t(`invoiceStatus.${invoice.status}`)} />
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <Money amount={invoice.finalAmount} className="text-xs" />
                    {invoice.paidAmount > 0 && invoice.paidAmount < invoice.finalAmount ? (
                      <span className="text-2xs text-ink-muted">
                        {t('paidSoFar')} <Money amount={invoice.paidAmount} compact />
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('payments')}>
          {student.payments.length === 0 ? (
            <div className="p-5">
              <Empty title={t('noPayments')} Icon={Wallet} />
            </div>
          ) : (
            <ul>
              {student.payments.slice(0, 8).map((payment) => (
                <li
                  key={payment._id}
                  className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-3.5 last:border-b-0"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-xs text-ink dark:text-white">
                      {formatDate(payment.receivedAt, locale)}
                    </span>
                    <span className="text-2xs text-ink-muted">
                      {t(`method.${payment.method}`)}
                      {payment.receiptNo ? ` · ${payment.receiptNo}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Money
                      amount={Math.abs(payment.amount)}
                      className={cn('text-xs font-medium', payment.amount < 0 ? 'text-danger' : 'text-success')}
                    />
                    <button
                      type="button"
                      title={t('downloadReceipt')}
                      aria-label={t('downloadReceipt')}
                      onClick={() => {
                        const tab = openBlankTab()
                        void getToken().then((token) => openReceipt(payment._id, token, tab))
                      }}
                      className="inline-flex size-8 items-center justify-center rounded-pill text-ink-muted transition-colors hover:bg-navy-50 hover:text-ink dark:hover:bg-navy-800"
                    >
                      <Download className="size-3.5" aria-hidden />
                    </button>
                    {mayRefund && payment.amount > 0 ? (
                      <button
                        type="button"
                        title={t('refund')}
                        aria-label={t('refund')}
                        onClick={() => {
                          setRefundTarget({ _id: payment._id, amount: payment.amount })
                          setRefundReason('')
                          setRefundAmount('')
                        }}
                        className="inline-flex size-8 items-center justify-center rounded-pill text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <Undo2 className="size-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* A2/§11.2 — a refund is a new ledger entry, never an edit to the original. */}
      {refundTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('refund')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
          onClick={() => setRefundTarget(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-card bg-surface p-6 shadow-float"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-ink dark:text-white">
                {t('refund')}
              </h3>
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                aria-label={t('close')}
                className="inline-flex size-9 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <p className="mb-4 text-xs text-ink-soft dark:text-navy-200">
              {t('refundHint', { amount: refundTarget.amount.toLocaleString() })}
            </p>

            <label className="mb-1.5 block text-xs font-medium text-ink-soft dark:text-navy-200">
              {t('refundAmount')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder={String(refundTarget.amount)}
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
              className="mb-4 h-12 w-full rounded-input border border-border-subtle bg-background px-4 font-mono text-sm tabular-nums text-ink outline-none focus:border-glaze-500 dark:text-white"
            />

            <label className="mb-1.5 block text-xs font-medium text-ink-soft dark:text-navy-200">
              {t('refundReason')}
            </label>
            <textarea
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              rows={3}
              className="mb-4 w-full rounded-input border border-border-subtle bg-background p-3 text-sm text-ink outline-none focus:border-glaze-500 dark:text-white"
            />

            {refund.error ? <ErrorBox code={refund.error.code} message={refund.error.message} /> : null}

            <button
              type="button"
              disabled={refund.pending || refundReason.trim().length < 5}
              onClick={async () => {
                const parsedAmount = refundAmount.trim() ? Number(refundAmount) : undefined
                const result = await refund.mutate({
                  reason: refundReason.trim(),
                  ...(parsedAmount ? { amount: parsedAmount } : {}),
                })
                if (result) {
                  setRefundTarget(null)
                  void detail.refetch()
                }
              }}
              className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-danger text-xs font-medium text-white transition-colors disabled:opacity-50"
            >
              <Undo2 className="size-4" aria-hidden />
              {t('confirmRefund')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Tile({
  label,
  value,
  last = false,
}: {
  label: string
  value: React.ReactNode
  last?: boolean
}) {
  return (
    <li
      className={cn(
        'flex flex-col gap-2 border-b border-border-subtle px-6 py-5 lg:border-b-0',
        !last && 'lg:border-r',
      )}
    >
      <span className="text-2xs uppercase tracking-[0.12em] text-ink-muted">{label}</span>
      <span className="font-display text-lg tracking-[-0.02em] text-ink dark:text-white">
        {value}
      </span>
    </li>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('inline-block size-3.5 rounded-full', className)} aria-hidden />
      {label}
    </span>
  )
}

/** Shown when a signed-in account has no student record linked yet. */
export function CabinetUnlinked() {
  const t = useTranslations('panel.cabinet')
  return <Empty title={t('unlinked')} Icon={GraduationCap} />
}

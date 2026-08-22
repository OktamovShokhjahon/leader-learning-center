'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Wallet, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { useQuery } from '@/lib/api/use-api'
import { Panel, Money, Loading, ErrorBox, Empty, StatusPill } from './primitives'
import { cn } from '@/lib/utils'
import { ModuleList } from './module-list'

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
  status: string
  monthlyFee: number
  balance: number
  invoices: {
    _id: string
    period: string
    finalAmount: number
    paidAmount: number
    status: string
    dueDate: string
  }[]
  payments: { _id: string; amount: number; method: string; receivedAt: string; receiptNo?: string }[]
  enrollments?: { groupId?: { courseId?: string } | null }[]
}

const DATE_LOCALE: Record<Locale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' }

/**
 * TZ §10.2 and §16 — the student and parent view.
 *
 * "Monthly calendar, absences marked as red circles exactly as in PIC 2.
 * Tapping a red circle opens the info table: course · time · teacher."
 *
 * Everything here is read-only. §10.2 is explicit that students and parents can
 * never edit attendance, and there is no write path in this component at all —
 * the cabinet has no mutation to accidentally expose.
 */
export function StudentCabinet({ studentId }: { studentId: string }) {
  const t = useTranslations('panel.cabinet')
  const locale = useLocale() as Locale
  const [monthOffset, setMonthOffset] = useState(0)

  const detail = useQuery<StudentDetail>(`/students/${studentId}`)
  const attendance = useQuery<AttendanceRow[]>(`/groups/attendance/history?studentId=${studentId}`)

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

  const marked = [...byDay.values()]
  const absences = marked.filter((row) => row.status === 'absent').length
  const rate = marked.length > 0
    ? Math.round(((marked.length - absences) / marked.length) * 100)
    : null

  const courseId =
    student.enrollments?.find((entry) => entry.groupId?.courseId)?.groupId?.courseId ?? null

  const outstanding = student.invoices.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.finalAmount - invoice.paidAmount),
    0,
  )

  return (
    <div className="flex flex-col gap-6">
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
              {month.toLocaleDateString(DATE_LOCALE[locale], { month: 'long', year: 'numeric' })}
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

      {/*
        The online track (§16 extended): modules unlock at the pass mark.
        Shown only when the student is enrolled on a course that has any.
      */}
      {courseId ? (
        <Panel title={t('modules')}>
          <div className="p-5">
            <ModuleList courseId={courseId} />
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
                      {new Date(payment.receivedAt).toLocaleDateString(DATE_LOCALE[locale])}
                    </span>
                    <span className="text-2xs text-ink-muted">
                      {t(`method.${payment.method}`)}
                      {payment.receiptNo ? ` · ${payment.receiptNo}` : ''}
                    </span>
                  </span>
                  <Money
                    amount={Math.abs(payment.amount)}
                    className={cn('text-xs font-medium', payment.amount < 0 ? 'text-danger' : 'text-success')}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
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

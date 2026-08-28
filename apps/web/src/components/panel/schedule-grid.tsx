'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, MapPin, User, Ban } from 'lucide-react'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { formatDate } from '@/lib/date'
import { Panel, Loading, ErrorBox, Empty } from './primitives'
import { Select } from './form-kit'
import { cn } from '@/lib/utils'

type ScheduledLesson = {
  _id: string
  date: string
  startTime?: string
  endTime?: string
  status: string
  groupId?: { _id: string; name: string } | null
  teacherId?: { _id: string; fullName: string } | null
  roomId?: { _id: string; name: string } | null
}

type GroupOption = { _id: string; name: string }
type StaffOption = { _id: string; fullName: string }
type RoomOption = { _id: string; name: string }

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** Monday of the week containing `date`, at UTC midnight. */
function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const isoDay = ((d.getUTCDay() + 6) % 7) + 1 // 1 = Monday
  d.setUTCDate(d.getUTCDate() - (isoDay - 1))
  return d
}

/**
 * §9.3 — the schedule grid: the week's lessons laid out by day, filterable by
 * teacher/room/group, reading the `GET /groups/schedule/lessons` endpoint
 * that already existed with nothing rendering it. Rescheduling is via the
 * existing cancel action for now — a drag-to-reschedule interaction is a
 * separate, considerably larger UI investment than the visibility this
 * screen exists to provide first.
 */
export function ScheduleGrid() {
  const t = useTranslations('panel.schedule')
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [teacherId, setTeacherId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [cancelling, setCancelling] = useState<ScheduledLesson | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart)
    end.setUTCDate(end.getUTCDate() + 6)
    return end
  }, [weekStart])

  const { data: teachers } = useQuery<Paginated<StaffOption>>(
    '/users?role=teacher&limit=100&status=active',
  )
  const { data: rooms } = useQuery<Paginated<RoomOption>>('/rooms?limit=100')
  const { data: groups } = useQuery<Paginated<GroupOption>>('/groups?limit=100&status=active')

  const query = new URLSearchParams({
    from: weekStart.toISOString().slice(0, 10),
    to: weekEnd.toISOString().slice(0, 10),
  })
  if (teacherId) query.set('teacherId', teacherId)
  if (roomId) query.set('roomId', roomId)
  if (groupId) query.set('groupId', groupId)

  const { data: lessons, loading, error, refetch } = useQuery<ScheduledLesson[]>(
    `/groups/schedule/lessons?${query}`,
  )
  const cancel = useMutation<{ reason: string }, unknown>(
    () => `/groups/lessons/${cancelling?._id ?? ''}/cancel`,
  )

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledLesson[]>()
    for (const lesson of lessons ?? []) {
      const key = new Date(lesson.date).toISOString().slice(0, 10)
      const list = map.get(key) ?? []
      list.push(lesson)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    }
    return map
  }, [lessons])

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setUTCDate(d.getUTCDate() + i)
        return d
      }),
    [weekStart],
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekStart((d) => mondayOf(new Date(d.getTime() - 24 * 3600 * 1000)))}
            aria-label={t('prevWeek')}
            className="inline-flex size-10 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="min-w-44 text-center font-mono text-xs text-ink-soft dark:text-navy-200">
            {formatDate(weekStart)} – {formatDate(weekEnd)}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart((d) => mondayOf(new Date(d.getTime() + 8 * 24 * 3600 * 1000)))}
            aria-label={t('nextWeek')}
            className="inline-flex size-10 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>

        <Select
          value={teacherId}
          onChange={setTeacherId}
          placeholder={t('allTeachers')}
          options={(teachers?.items ?? []).map((teacher) => ({ value: teacher._id, label: teacher.fullName }))}
        />
        <Select
          value={roomId}
          onChange={setRoomId}
          placeholder={t('allRooms')}
          options={(rooms?.items ?? []).map((room) => ({ value: room._id, label: room.name }))}
        />
        <Select
          value={groupId}
          onChange={setGroupId}
          placeholder={t('allGroups')}
          options={(groups?.items ?? []).map((group) => ({ value: group._id, label: group.name }))}
        />
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}

      {!loading && !error ? (
        <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-7">
          {days.map((day) => {
            const key = day.toISOString().slice(0, 10)
            const dayLessons = byDay.get(key) ?? []
            const isToday = key === new Date().toISOString().slice(0, 10)
            return (
              <section key={key} className="flex min-w-40 flex-col gap-2">
                <header
                  className={cn(
                    'flex items-center justify-between rounded-input border-b-2 px-2 py-1.5 text-2xs font-medium uppercase tracking-[0.08em]',
                    isToday ? 'border-clay-500 text-clay-600' : 'border-border-subtle text-ink-muted',
                  )}
                >
                  <span>{t(`weekday.${WEEKDAYS[day.getUTCDay() === 0 ? 6 : day.getUTCDay() - 1]}`)}</span>
                  <span className="font-mono">{formatDate(day).slice(0, 5)}</span>
                </header>

                {dayLessons.length === 0 ? (
                  <p className="px-2 text-2xs text-ink-muted">{t('noLessons')}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {dayLessons.map((lesson) => (
                      <li
                        key={lesson._id}
                        className={cn(
                          'flex flex-col gap-1 rounded-input border border-border-subtle bg-surface p-2.5 text-2xs',
                          lesson.status === 'cancelled' && 'opacity-50',
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-medium text-ink dark:text-white">
                            {lesson.startTime ?? '—'}–{lesson.endTime ?? '—'}
                          </span>
                          {lesson.status !== 'cancelled' ? (
                            <button
                              type="button"
                              title={t('cancelLesson')}
                              onClick={() => {
                                setCancelling(lesson)
                                setCancelReason('')
                              }}
                              className="inline-flex size-6 items-center justify-center rounded-pill text-ink-muted hover:bg-danger/10 hover:text-danger"
                            >
                              <Ban className="size-3.5" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                        <span className="truncate font-medium text-ink dark:text-white">
                          {lesson.groupId?.name ?? '—'}
                        </span>
                        {lesson.teacherId ? (
                          <span className="flex items-center gap-1 text-ink-muted">
                            <User className="size-3" aria-hidden />
                            {lesson.teacherId.fullName}
                          </span>
                        ) : null}
                        {lesson.roomId ? (
                          <span className="flex items-center gap-1 text-ink-muted">
                            <MapPin className="size-3" aria-hidden />
                            {lesson.roomId.name}
                          </span>
                        ) : null}
                        {lesson.status === 'cancelled' ? (
                          <span className="text-danger">{t('cancelled')}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      ) : null}

      {!loading && !error && (lessons?.length ?? 0) === 0 ? <Empty title={t('empty')} /> : null}

      {cancelling ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
          onClick={() => setCancelling(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-card bg-surface p-6 shadow-float"
          >
            <h3 className="mb-3 font-display text-base font-semibold text-ink dark:text-white">
              {t('cancelLesson')}
            </h3>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder={t('cancelReasonPlaceholder')}
              rows={3}
              className="mb-4 w-full rounded-input border border-border-subtle bg-background p-3 text-sm text-ink outline-none focus:border-glaze-500 dark:text-white"
            />
            {cancel.error ? (
              <p className="mb-3 text-2xs text-danger">{cancel.error.message}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCancelling(null)}
                className="h-11 flex-1 rounded-pill border border-border-subtle text-xs font-medium text-ink-soft"
              >
                {t('back')}
              </button>
              <button
                type="button"
                disabled={cancel.pending || cancelReason.trim().length < 3}
                onClick={async () => {
                  const result = await cancel.mutate({ reason: cancelReason.trim() })
                  if (result !== null) {
                    setCancelling(null)
                    void refetch()
                  }
                }}
                className="h-11 flex-1 rounded-pill bg-danger text-xs font-medium text-white disabled:opacity-50"
              >
                {t('confirmCancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

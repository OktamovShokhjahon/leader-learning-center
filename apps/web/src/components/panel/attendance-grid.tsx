'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Save, Loader2, CalendarX, Users2 } from 'lucide-react'
import type { AttendanceStatus } from '@leader/shared/schemas'
import { useQuery, useMutation } from '@/lib/api/use-api'
import { Panel, Loading, ErrorBox, Empty, StatusPill } from './primitives'
import { cn } from '@/lib/utils'

type RosterStudent = {
  studentId: string
  fullName: string
  phone?: string
  status: AttendanceStatus
  marked: boolean
}

type Roster = {
  group: { id: string; name: string }
  lesson: { _id: string; date: string; status: string } | null
  students: RosterStudent[]
}

/** §10.1 — one tap cycles present → absent → late → excused. */
const CYCLE: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

/**
 * TZ §10.1 — the teacher's daily job.
 *
 * "Default state is present so a full-attendance lesson is one tap total
 * (Save)." That is the whole design: the grid opens with everyone present, a
 * tap cycles a single student, and one Save writes the lesson in one request.
 *
 * Marking is optimistic — the row moves the moment it is tapped, because a
 * teacher marking twenty students should never wait on a round trip. The Save
 * is the only network call.
 */
export function AttendanceGrid({ groupId }: { groupId: string }) {
  const t = useTranslations('panel.attendance')
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)

  const { data, loading, error, refetch } = useQuery<Roster>(
    `/groups/${groupId}/roster?date=${date}`,
  )
  const { mutate, pending, error: saveError } = useMutation<
    { lessonId: string; entries: { studentId: string; status: AttendanceStatus }[] },
    { marked: number }
  >('/groups/attendance')

  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({})
  const [saved, setSaved] = useState(false)

  /**
   * Seed the draft from whatever is stored, and clear the "saved" confirmation
   * only when a *different* lesson loads.
   *
   * Keying on `lesson._id` rather than on `data` matters: saving refetches, and
   * a refetch produces a new `data` object every time. Depending on `data` would
   * wipe the confirmation the instant it appeared, leaving the teacher unsure
   * whether the save landed.
   */
  const lessonId = data?.lesson?._id ?? null
  useEffect(() => {
    if (!data) return
    setDraft(
      Object.fromEntries(data.students.map((student) => [student.studentId, student.status])),
    )
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  const cycle = (studentId: string) => {
    setSaved(false)
    setDraft((current) => {
      const next = CYCLE[(CYCLE.indexOf(current[studentId] ?? 'present') + 1) % CYCLE.length]!
      return { ...current, [studentId]: next }
    })
  }

  const setAll = (status: AttendanceStatus) => {
    setSaved(false)
    setDraft((current) =>
      Object.fromEntries(Object.keys(current).map((studentId) => [studentId, status])),
    )
  }

  const save = async () => {
    if (!data?.lesson) return
    const result = await mutate({
      lessonId: data.lesson._id,
      entries: Object.entries(draft).map(([studentId, status]) => ({ studentId, status })),
    })
    if (result) {
      setSaved(true)
      void refetch()
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />
  if (!data) return null

  const absentCount = Object.values(draft).filter((status) => status !== 'present').length

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-ink-soft dark:text-navy-200">
          {t('date')}
          <input
            type="date"
            value={date}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            className="h-11 rounded-input border border-border-subtle bg-background px-3 font-mono text-xs text-ink outline-none focus:border-glaze-500 dark:text-white"
          />
        </label>

        {data.lesson ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAll('present')}
              className="inline-flex h-11 items-center gap-2 rounded-pill border border-navy-600/25 px-4 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
            >
              <Users2 className="size-4" aria-hidden />
              {t('allPresent')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-11 items-center gap-2 rounded-pill bg-clay-500 px-5 text-xs font-medium text-white transition-colors hover:bg-clay-400 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : saved ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              {saved ? t('saved') : t('save')}
            </button>
          </div>
        ) : null}
      </div>

      {saveError ? <ErrorBox code={saveError.code} message={saveError.message} /> : null}

      {!data.lesson ? (
        <Empty title={t('noLesson')} Icon={CalendarX} />
      ) : data.students.length === 0 ? (
        <Empty title={t('noStudents')} />
      ) : (
        <Panel
          title={data.group.name}
          action={
            <span className="text-2xs text-ink-muted">
              {t('summary', { total: data.students.length, absent: absentCount })}
            </span>
          }
        >
          <ul>
            {data.students.map((student) => {
              const status = draft[student.studentId] ?? 'present'
              return (
                <li key={student.studentId} className="border-b border-border-subtle last:border-b-0">
                  {/*
                    The whole row is the target, not a small chip: §25.6 asks for
                    44 px touch targets, and this is used on a phone at the
                    classroom door.
                  */}
                  <button
                    type="button"
                    onClick={() => cycle(student.studentId)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-navy-50/60 dark:hover:bg-navy-800/50"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-ink dark:text-white">
                        {student.fullName}
                      </span>
                      {student.phone ? (
                        <span className="font-mono text-2xs text-ink-muted">{student.phone}</span>
                      ) : null}
                    </span>

                    <span
                      className={cn(
                        'shrink-0 rounded-pill px-3 py-1.5 text-2xs font-medium transition-colors',
                        status === 'present' && 'bg-success/12 text-success',
                        status === 'absent' && 'bg-danger/12 text-danger',
                        status === 'late' && 'bg-warning/15 text-warning',
                        status === 'excused' && 'bg-info/12 text-info',
                      )}
                    >
                      {t(`status.${status}`)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      {data.lesson?.status === 'cancelled' ? (
        <StatusPill status="cancelled" label={t('lessonCancelled')} />
      ) : null}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Save, Loader2, CalendarX } from 'lucide-react'
import { GRADE_MIN, GRADE_MAX } from '@leader/shared/schemas'
import { useQuery, useMutation } from '@/lib/api/use-api'
import { Panel, Loading, ErrorBox, Empty } from './primitives'
import { cn } from '@/lib/utils'

type RosterStudent = {
  studentId: string
  fullName: string
  value: number | null
  comment?: string
}

type Roster = {
  group: { id: string; name: string }
  lesson: { _id: string; date: string; status: string } | null
  students: RosterStudent[]
}

const SCALE = Array.from({ length: GRADE_MAX - GRADE_MIN + 1 }, (_, i) => GRADE_MIN + i)

/**
 * C1 — "clicking a date opens the grade-entry panel for that date; enter
 * grades for the whole group in one view, with an optional comment." Mirrors
 * `AttendanceGrid`'s day-of-lesson shape: pick a date, one row per student,
 * one Save for the whole group.
 */
export function GradeGrid({ groupId }: { groupId: string }) {
  const t = useTranslations('panel.grades')
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)

  const { data, loading, error, refetch } = useQuery<Roster>(
    `/grades/roster?groupId=${groupId}&date=${date}`,
  )
  const { mutate, pending, error: saveError } = useMutation<
    { lessonId: string; entries: { studentId: string; value: number; comment?: string }[] },
    { graded: number }
  >('/grades')

  const [values, setValues] = useState<Record<string, number>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const lessonId = data?.lesson?._id ?? null
  useEffect(() => {
    if (!data) return
    setValues(
      Object.fromEntries(
        data.students.filter((s) => s.value != null).map((s) => [s.studentId, s.value as number]),
      ),
    )
    setComments(
      Object.fromEntries(data.students.filter((s) => s.comment).map((s) => [s.studentId, s.comment!])),
    )
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  const save = async () => {
    if (!data?.lesson) return
    const entries = Object.entries(values).map(([studentId, value]) => ({
      studentId,
      value,
      ...(comments[studentId]?.trim() ? { comment: comments[studentId]!.trim() } : {}),
    }))
    if (entries.length === 0) return
    const result = await mutate({ lessonId: data.lesson._id, entries })
    if (result) {
      setSaved(true)
      void refetch()
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />
  if (!data) return null

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
        ) : null}
      </div>

      {saveError ? <ErrorBox code={saveError.code} message={saveError.message} /> : null}

      {!data.lesson ? (
        <Empty title={t('noLesson')} Icon={CalendarX} />
      ) : data.students.length === 0 ? (
        <Empty title={t('noStudents')} />
      ) : (
        <Panel title={data.group.name}>
          <ul>
            {data.students.map((student) => (
              <li key={student.studentId} className="border-b border-border-subtle px-5 py-3.5 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-ink dark:text-white">
                    {student.fullName}
                  </span>
                  <div className="flex gap-1.5">
                    {SCALE.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setSaved(false)
                          setValues((current) => ({ ...current, [student.studentId]: n }))
                        }}
                        className={cn(
                          'inline-flex size-9 items-center justify-center rounded-pill text-sm font-medium transition-colors',
                          values[student.studentId] === n
                            ? n >= 4
                              ? 'bg-success text-white'
                              : n === 3
                                ? 'bg-warning text-white'
                                : 'bg-danger text-white'
                            : 'border border-border-subtle text-ink-soft hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-800',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={comments[student.studentId] ?? ''}
                  onChange={(event) =>
                    setComments((current) => ({ ...current, [student.studentId]: event.target.value }))
                  }
                  placeholder={t('commentPlaceholder')}
                  className="mt-2 h-9 w-full rounded-input border border-border-subtle bg-background px-3 text-xs text-ink outline-none focus:border-glaze-500 dark:text-white"
                />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}

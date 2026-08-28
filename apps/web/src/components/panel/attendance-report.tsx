'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AttendanceStatus } from '@leader/shared/schemas'
import { useQuery, type Paginated } from '@/lib/api/use-api'
import { formatDate } from '@/lib/date'
import { Panel, Loading, ErrorBox, Empty, TableShell, Th, Td } from './primitives'
import { Select } from './form-kit'
import { DonutChart } from './donut-chart'
import { cn } from '@/lib/utils'

type AttendanceRow = {
  _id: string
  studentId: string
  status: AttendanceStatus
  reason?: string
  lessonId?: { _id: string; date: string } | null
}

type GroupOption = { _id: string; name: string }
type StaffOption = { _id: string; fullName: string }
type RosterStudent = { studentId: string; fullName: string }

const STATUS_DOT: Record<AttendanceStatus, string> = {
  present: 'bg-success/70',
  absent: 'bg-danger',
  late: 'bg-warning',
  excused: 'bg-info',
}

/** Same mapping as `STATUS_DOT`, as CSS custom-property references for recharts fills. */
const STATUS_COLOR_VAR: Record<AttendanceStatus, string> = {
  present: 'var(--color-success)',
  absent: 'var(--color-danger)',
  late: 'var(--color-warning)',
  excused: 'var(--color-info)',
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * B1 — "students as rows, lesson dates as columns," filterable by group, date
 * range and teacher. This is a review/reporting view — the fast day-of tap-to-
 * mark screen (`AttendanceGrid`) is unaffected and stays the default workflow
 * for actually taking attendance.
 */
export function AttendanceReport({ initialGroupId }: { initialGroupId?: string }) {
  const t = useTranslations('panel.attendanceReport')
  const [groupId, setGroupId] = useState(initialGroupId ?? '')
  const [teacherId, setTeacherId] = useState('')
  const [from, setFrom] = useState(() => isoDaysAgo(30))
  const [to, setTo] = useState(() => isoDaysAgo(0))

  const { data: groups } = useQuery<Paginated<GroupOption>>('/groups?limit=100&status=active')
  const { data: teachers } = useQuery<Paginated<StaffOption>>(
    '/users?role=teacher&limit=100&status=active',
  )
  const { data: roster } = useQuery<{ students: RosterStudent[] } | RosterStudent[]>(
    groupId ? `/groups/${groupId}/roster` : null,
  )

  const query = new URLSearchParams({ from, to })
  if (groupId) query.set('groupId', groupId)
  if (teacherId) query.set('teacherId', teacherId)

  const { data: rows, loading, error } = useQuery<AttendanceRow[]>(
    `/groups/attendance/history?${query}`,
  )

  const dates = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows ?? []) {
      const raw = row.lessonId?.date
      if (raw) set.add(new Date(raw).toISOString().slice(0, 10))
    }
    return [...set].sort()
  }, [rows])

  const rosterStudents = Array.isArray(roster) ? roster : roster?.students

  const students = useMemo(() => {
    const byId = new Map<string, string>()
    for (const student of rosterStudents ?? []) {
      byId.set(student.studentId, student.fullName)
    }
    // A roster reflects who is enrolled *today* — fall back to whoever the
    // history rows actually name, so a student who left mid-range still shows.
    for (const row of rows ?? []) {
      if (!byId.has(row.studentId)) byId.set(row.studentId, row.studentId)
    }
    return [...byId.entries()].map(([studentId, fullName]) => ({ studentId, fullName }))
  }, [rosterStudents, rows])

  const cell = useMemo(() => {
    const map = new Map<string, AttendanceRow>()
    for (const row of rows ?? []) {
      const raw = row.lessonId?.date
      if (!raw) continue
      map.set(`${row.studentId}:${new Date(raw).toISOString().slice(0, 10)}`, row)
    }
    return map
  }, [rows])

  const [openCell, setOpenCell] = useState<string | null>(null)

  /** G5 — the status breakdown across the loaded range, as a donut. */
  const statusCounts = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 }
    for (const row of rows ?? []) counts[row.status] += 1
    return counts
  }, [rows])
  const statusTotal = Object.values(statusCounts).reduce((sum, n) => sum + n, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-xs text-ink-soft dark:text-navy-200">
          {t('group')}
          <Select
            value={groupId}
            onChange={setGroupId}
            placeholder={t('allGroups')}
            options={(groups?.items ?? []).map((group) => ({ value: group._id, label: group.name }))}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-soft dark:text-navy-200">
          {t('teacher')}
          <Select
            value={teacherId}
            onChange={setTeacherId}
            placeholder={t('allTeachers')}
            options={(teachers?.items ?? []).map((teacher) => ({
              value: teacher._id,
              label: teacher.fullName,
            }))}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-soft dark:text-navy-200">
          {t('from')}
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className="h-11 rounded-input border border-border-subtle bg-background px-3 font-mono text-xs text-ink outline-none focus:border-glaze-500 dark:text-white"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-soft dark:text-navy-200">
          {t('to')}
          <input
            type="date"
            value={to}
            min={from}
            max={isoDaysAgo(0)}
            onChange={(event) => setTo(event.target.value)}
            className="h-11 rounded-input border border-border-subtle bg-background px-3 font-mono text-xs text-ink outline-none focus:border-glaze-500 dark:text-white"
          />
        </label>
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}

      {!loading && !error && statusTotal > 0 ? (
        <Panel title={t('statusBreakdown')}>
          <div className="p-4">
            <DonutChart
              total={statusTotal}
              data={(Object.keys(statusCounts) as AttendanceStatus[]).map((status) => ({
                key: status,
                label: t(`status.${status}`),
                value: statusCounts[status],
                color: STATUS_COLOR_VAR[status],
              }))}
            />
          </div>
        </Panel>
      ) : null}

      {!loading && !error ? (
        students.length === 0 || dates.length === 0 ? (
          <Empty title={t('empty')} />
        ) : (
          <Panel title={t('title')}>
            <TableShell>
              <thead>
                  <tr>
                    <Th className="sticky left-0 z-10 bg-surface">{t('student')}</Th>
                    {dates.map((date) => (
                      <Th key={date} className="whitespace-nowrap text-center">
                        {formatDate(date).slice(0, 5)}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.studentId}>
                      <Td className="sticky left-0 z-10 whitespace-nowrap bg-surface font-medium">
                        {student.fullName}
                      </Td>
                      {dates.map((date) => {
                        const key = `${student.studentId}:${date}`
                        const row = cell.get(key)
                        return (
                          <Td key={date} className="text-center">
                            <button
                              type="button"
                              disabled={!row}
                              onClick={() => setOpenCell(openCell === key ? null : key)}
                              title={row ? t(`status.${row.status}`) : undefined}
                              className="inline-flex size-6 items-center justify-center rounded-full"
                            >
                              <span
                                className={cn(
                                  'inline-block size-3 rounded-full',
                                  row ? STATUS_DOT[row.status] : 'bg-border-subtle',
                                )}
                                aria-hidden
                              />
                            </button>
                            {openCell === key && row ? (
                              <div className="absolute z-20 mt-1 w-48 -translate-x-1/2 rounded-input border border-border-subtle bg-surface p-3 text-left text-2xs shadow-float">
                                <p className="font-medium text-ink dark:text-white">
                                  {t(`status.${row.status}`)}
                                </p>
                                {row.reason ? (
                                  <p className="mt-1 text-ink-muted">{row.reason}</p>
                                ) : null}
                              </div>
                            ) : null}
                          </Td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
            </TableShell>
          </Panel>
        )
      ) : null}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { SCHEDULE_PATTERNS_GROUP, GROUP_STATUSES } from '@leader/shared/schemas'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import {
  Dialog,
  Field,
  INPUT,
  Select,
  MoneyInput,
  DateField,
  Toggle,
  Action,
  DialogError,
  type Localized,
} from './form-kit'
import { cn } from '@/lib/utils'

export type PanelGroup = {
  _id: string
  name: string
  courseId: string | { _id: string }
  teacherId: string | { _id: string }
  roomId?: string | { _id: string }
  schedule: { pattern: string; days: number[]; startTime: string; endTime: string }
  startDate: string
  endDate?: string
  capacity: number
  price: number
  teacherShare: number
  status: string
}

type Course = { _id: string; name: Localized; defaultPrice: number }
type Room = { _id: string; name: string; capacity: number }
type Staff = { _id: string; fullName: string; roles: { role: string }[] }

const idOf = (value: unknown): string =>
  typeof value === 'string' ? value : ((value as { _id?: string })?._id ?? '')

/**
 * TZ §9.2 — creating and editing a group.
 *
 * The schedule is the interesting part. §9.2's `pattern` is the workbook's `Kun`
 * column — `har_kun`, `toq` (odd days), `juft` (even days) — and picking one
 * fills the weekday set, because that is what those words *mean*. `custom` is
 * the escape hatch where the days are picked by hand.
 *
 * A save can come back `409 SCHEDULE_CONFLICT` naming the group that already
 * holds the slot (§9.3). That is not an error to hide behind a generic message,
 * so it is rendered with the conflicting group's name.
 */
export function GroupDialog({
  group,
  onClose,
  onSaved,
}: {
  group: PanelGroup | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.groupForm')
  const locale = useLocale() as Locale
  const creating = group === null

  const { data: courses } = useQuery<Paginated<Course>>('/courses?limit=100&sort=order')
  const { data: rooms } = useQuery<Paginated<Room>>('/rooms?limit=100')
  const { data: staff } = useQuery<Paginated<Staff>>('/users?role=teacher&limit=100&status=active')

  const [name, setName] = useState(group?.name ?? '')
  const [courseId, setCourseId] = useState(idOf(group?.courseId))
  const [teacherId, setTeacherId] = useState(idOf(group?.teacherId))
  const [roomId, setRoomId] = useState(idOf(group?.roomId))
  const [pattern, setPattern] = useState(group?.schedule?.pattern ?? 'juft')
  const [days, setDays] = useState<number[]>(group?.schedule?.days ?? [2, 4, 6])
  const [startTime, setStartTime] = useState(group?.schedule?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(group?.schedule?.endTime ?? '10:30')
  const [startDate, setStartDate] = useState(
    (group?.startDate ?? new Date().toISOString()).slice(0, 10),
  )
  const [endDate, setEndDate] = useState((group?.endDate ?? '').slice(0, 10))
  const [capacity, setCapacity] = useState(group?.capacity ?? 12)
  const [price, setPrice] = useState<number | null>(group?.price ?? null)
  const [status, setStatus] = useState(group?.status ?? 'active')

  const save = useMutation<Record<string, unknown>, PanelGroup>(
    creating ? '/groups' : `/groups/${group._id}`,
    creating ? 'POST' : 'PATCH',
  )

  const courseName = (course: Course) => course.name?.[locale] || course.name?.uz || '—'

  /** §9.2 — the pattern *is* the weekday set; picking one should fill it in. */
  const applyPattern = (next: string) => {
    setPattern(next)
    if (next === 'toq') setDays([1, 3, 5])
    else if (next === 'juft') setDays([2, 4, 6])
    else if (next === 'har_kun') setDays([1, 2, 3, 4, 5, 6])
  }

  // Choosing a course pre-fills its default price, which is right most of the
  // time and always editable (§5.3 — the real price lives here, per branch).
  const onCourse = (next: string) => {
    setCourseId(next)
    const course = courses?.items.find((item) => item._id === next)
    if (course && (price === null || price === 0)) setPrice(course.defaultPrice)
  }

  const conflict = useMemo(() => {
    const details = save.error?.details as
      | { conflicts?: { groupName?: string; kind?: string }[] }
      | undefined
    return details?.conflicts?.[0] ?? null
  }, [save.error])

  const ready =
    name.trim().length > 0 && courseId && teacherId && days.length > 0 && startDate.length === 10

  return (
    <Dialog title={creating ? t('create') : name} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <Field label={t('name')} required>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('course')} required>
            <Select
              value={courseId}
              onChange={onCourse}
              placeholder={t('choose')}
              options={(courses?.items ?? []).map((course) => ({
                value: course._id,
                label: courseName(course),
              }))}
            />
          </Field>

          <Field label={t('teacher')} required>
            <Select
              value={teacherId}
              onChange={setTeacherId}
              placeholder={t('choose')}
              options={(staff?.items ?? []).map((person) => ({
                value: person._id,
                label: person.fullName,
              }))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('room')}>
            <Select
              value={roomId}
              onChange={setRoomId}
              placeholder={t('noRoom')}
              options={(rooms?.items ?? []).map((room) => ({
                value: room._id,
                label: `${room.name} (${room.capacity})`,
              }))}
            />
          </Field>

          <Field label={t('capacity')}>
            <input
              type="number"
              min={1}
              max={200}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className={INPUT}
            />
          </Field>
        </div>

        <Field label={t('pattern')} hint={t('patternHint')}>
          <div className="grid grid-cols-4 gap-2">
            {SCHEDULE_PATTERNS_GROUP.map((option) => (
              <Toggle
                key={option}
                label={t(`patterns.${option}`)}
                active={pattern === option}
                onClick={() => applyPattern(option)}
              />
            ))}
          </div>
        </Field>

        <Field label={t('days')} required>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => {
                  setPattern('custom')
                  setDays((current) =>
                    current.includes(day)
                      ? current.filter((value) => value !== day)
                      : [...current, day].sort(),
                  )
                }}
                aria-pressed={days.includes(day)}
                className={cn(
                  'size-11 rounded-input border text-2xs font-medium transition-colors',
                  days.includes(day)
                    ? 'border-transparent bg-navy-600 text-white'
                    : 'border-border-subtle text-ink-muted hover:border-navy-600/40',
                )}
              >
                {t(`weekday.${day}`)}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('startTime')} required>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={cn(INPUT, 'h-12 py-0')}
            />
          </Field>
          <Field label={t('endTime')} required>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={cn(INPUT, 'h-12 py-0')}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('startDate')} required>
            <DateField value={startDate} onChange={setStartDate} />
          </Field>
          <Field label={t('endDate')} hint={t('endDateHint')}>
            <DateField value={endDate} onChange={setEndDate} min={startDate} />
          </Field>
        </div>

        <Field label={t('price')} hint={t('priceHint')}>
          <MoneyInput value={price} onChange={setPrice} />
        </Field>

        {!creating ? (
          <Field label={t('status')}>
            <Select
              value={status}
              onChange={setStatus}
              options={GROUP_STATUSES.map((option) => ({
                value: option,
                label: t(`statuses.${option}`),
              }))}
            />
          </Field>
        ) : null}

        {/* §9.3 — "the system blocks the save and names the conflict". */}
        {conflict ? (
          <p
            role="alert"
            className="rounded-input border border-danger/30 bg-danger/5 p-3 text-2xs text-danger"
          >
            {t('conflict', { group: conflict.groupName ?? '—' })}
          </p>
        ) : save.error ? (
          <DialogError error={save.error} />
        ) : null}

        <Action
          label={creating ? t('create') : t('save')}
          tone="primary"
          pending={save.pending}
          disabled={!ready}
          onClick={async () => {
            const result = await save.mutate({
              name: name.trim(),
              courseId,
              teacherId,
              ...(roomId ? { roomId } : {}),
              pattern,
              days,
              startTime,
              endTime,
              startDate: new Date(startDate).toISOString(),
              ...(endDate ? { endDate: new Date(endDate).toISOString() } : {}),
              capacity,
              price: price ?? 0,
              ...(creating ? {} : { status }),
            })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}

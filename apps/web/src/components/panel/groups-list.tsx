'use client'

import { useTranslations } from 'next-intl'
import { CalendarCheck, Clock, Users, ArrowRight } from 'lucide-react'
import { useQuery, type Paginated } from '@/lib/api/use-api'
import { Link } from '@/i18n/navigation'
import { Loading, ErrorBox, Empty, Money } from './primitives'
import { GirihStar } from '@/components/ui/girih-star'

type Group = {
  _id: string
  name: string
  status: string
  price: number
  capacity: number
  enrolled: number
  schedule?: { pattern: string; days: number[]; startTime: string; endTime: string }
  courseId?: { name?: { uz?: string } } | string
  teacherId?: { fullName?: string } | string
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/**
 * TZ §9.2 — the group list, and the way into attendance.
 *
 * A teacher reaching this sees only their own groups: the API narrows the query
 * by `teacherId` for a teacher-only account, so this component needs no role
 * branch of its own.
 */
export function GroupsList() {
  const t = useTranslations('panel.groups')
  const { data, loading, error } = useQuery<Paginated<Group>>('/groups?limit=50')

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />
  if (!data || data.items.length === 0) return <Empty title={t('none')} Icon={CalendarCheck} />

  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.items.map((group) => {
        const course =
          typeof group.courseId === 'object' ? group.courseId?.name?.uz : undefined
        const teacher =
          typeof group.teacherId === 'object' ? group.teacherId?.fullName : undefined
        const full = group.enrolled >= group.capacity

        return (
          <li key={group._id}>
            <Link
              href={`/crm/groups/${group._id}`}
              className="group flex h-full flex-col gap-4 rounded-card border border-border-subtle bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-glaze-300 hover:shadow-float"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-2xs uppercase tracking-[0.12em] text-glaze-700 dark:text-glaze-300">
                    <GirihStar className="size-2.5 text-clay-500" strokeWidth={2.6} />
                    {course ?? t('group')}
                  </span>
                  <h3 className="font-display text-base leading-tight tracking-[-0.02em] text-ink dark:text-white">
                    {group.name}
                  </h3>
                </div>
                <span
                  className={
                    full
                      ? 'shrink-0 rounded-pill bg-warning/15 px-2.5 py-1 text-2xs font-medium text-warning'
                      : 'shrink-0 rounded-pill bg-glaze-50 px-2.5 py-1 text-2xs font-medium text-glaze-800 dark:bg-navy-800 dark:text-glaze-200'
                  }
                >
                  {group.enrolled}/{group.capacity}
                </span>
              </div>

              <ul className="flex flex-col gap-1.5 text-2xs text-ink-soft dark:text-navy-200">
                {group.schedule ? (
                  <li className="flex items-center gap-2">
                    <Clock className="size-3.5 shrink-0 text-glaze-600" aria-hidden />
                    <span className="font-mono">
                      {group.schedule.startTime}–{group.schedule.endTime}
                    </span>
                    <span className="text-ink-muted">
                      {group.schedule.days
                        .map((day) => t(`weekday.${WEEKDAY_KEYS[day - 1] ?? 'mon'}`))
                        .join(' · ')}
                    </span>
                  </li>
                ) : null}
                {teacher ? (
                  <li className="flex items-center gap-2">
                    <Users className="size-3.5 shrink-0 text-glaze-600" aria-hidden />
                    {teacher}
                  </li>
                ) : null}
              </ul>

              <div className="mt-auto flex items-end justify-between gap-3 border-t border-border-subtle pt-4">
                <Money amount={group.price} compact className="text-xs text-navy-700 dark:text-aqua-300" />
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-glaze-700 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-glaze-300">
                  {t('markAttendance')}
                  <ArrowRight className="size-4" aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

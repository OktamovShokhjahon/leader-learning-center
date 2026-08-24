'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarCheck, Clock, Users, ArrowRight, Pencil, Archive } from 'lucide-react'
import { can } from '@leader/shared/permissions'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { useAuth } from '@/lib/auth/auth-context'
import { Link } from '@/i18n/navigation'
import { Loading, ErrorBox, Empty, Money } from './primitives'
import { NewButton, FilterChip, RowAction } from './table-kit'
import { ConfirmDialog } from './form-kit'
import { GroupDialog, type PanelGroup } from './group-dialog'
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
  const { user } = useAuth()

  // §9.2 — archived groups are excluded from every default view, so the default
  // filter hides them and a chip brings them back.
  const [status, setStatus] = useState<string>('active')
  const [editing, setEditing] = useState<PanelGroup | 'new' | null>(null)
  const [archiving, setArchiving] = useState<Group | null>(null)

  const { data, loading, error, refetch } = useQuery<Paginated<Group>>(
    `/groups?limit=50${status === 'all' ? '' : `&status=${status}`}`,
  )
  const archive = useMutation<undefined, unknown>(
    () => `/groups/${archiving?._id ?? ''}`,
    'DELETE',
  )

  const mayManage = (user?.roles ?? []).some((assignment) =>
    can(assignment.role, 'group.manage'),
  )

  const toolbar = (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        {['active', 'planned', 'finished', 'archived', 'all'].map((option) => (
          <FilterChip
            key={option}
            label={t(`filter.${option}`)}
            active={status === option}
            onClick={() => setStatus(option)}
          />
        ))}
      </div>
      <span className="flex-1" />
      {mayManage ? <NewButton label={t('create')} onClick={() => setEditing('new')} /> : null}
    </div>
  )

  const dialogs = (
    <>
      {editing ? (
        <GroupDialog
          group={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void refetch()
          }}
        />
      ) : null}

      {archiving ? (
        <ConfirmDialog
          title={t('archiveTitle')}
          body={t('archiveBody', { name: archiving.name })}
          confirmLabel={t('archive')}
          pending={archive.pending}
          onClose={() => setArchiving(null)}
          onConfirm={async () => {
            const result = await archive.mutate()
            if (result !== null) {
              setArchiving(null)
              void refetch()
            }
          }}
        />
      ) : null}
    </>
  )

  if (loading) return <>{toolbar}<Loading /></>
  if (error) return <>{toolbar}<ErrorBox code={error.code} message={error.message} /></>
  if (!data || data.items.length === 0) {
    return (
      <>
        {toolbar}
        <Empty title={t('none')} Icon={CalendarCheck} />
        {dialogs}
      </>
    )
  }

  return (
    <>
    {toolbar}
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.items.map((group) => {
        const course =
          typeof group.courseId === 'object' ? group.courseId?.name?.uz : undefined
        const teacher =
          typeof group.teacherId === 'object' ? group.teacherId?.fullName : undefined
        const full = group.enrolled >= group.capacity

        return (
          <li
            key={group._id}
            className="flex h-full flex-col overflow-hidden rounded-card border border-border-subtle bg-surface transition-all duration-200 hover:border-glaze-300 hover:shadow-float"
          >
            <Link
              href={`/crm/groups/${group._id}`}
              className="group flex flex-1 flex-col gap-4 p-5"
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

            {/* Outside the Link: a card that is one big link cannot hold buttons. */}
            {mayManage ? (
              <div className="flex gap-2 border-t border-border-subtle px-5 py-3">
                <RowAction
                  label={t('edit')}
                  Icon={Pencil}
                  onClick={() => setEditing(group as unknown as PanelGroup)}
                />
                {group.status !== 'archived' ? (
                  <RowAction
                    label={t('archive')}
                    Icon={Archive}
                    tone="danger"
                    onClick={() => setArchiving(group)}
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
    {dialogs}
    </>
  )
}

'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BookOpen, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { Panel, TableShell, Th, Td, Money, Loading, ErrorBox, Empty } from './primitives'
import { SearchBox, NewButton, RowAction, Pagination, useDebounced } from './table-kit'
import {
  Dialog,
  Field,
  INPUT,
  LocalizedTabs,
  MoneyInput,
  Checkbox,
  Action,
  DialogError,
  ConfirmDialog,
  type Localized,
} from './form-kit'
import { cn } from '@/lib/utils'

type Course = {
  _id: string
  slug: string
  name: Localized
  description?: Localized
  level?: string
  durationMonths: number
  defaultPrice: number
  isPublic: boolean
  order: number
}

/**
 * TZ §21.1 — "Courses and prices".
 *
 * The catalogue was readable and not writable, which meant a new course had to
 * be inserted into Mongo by hand before a group could teach it. Price here is
 * the *default* only: §5.3 puts the real price on the group, per branch, and the
 * field label says so rather than leaving someone to discover it.
 */
export function CoursesTable() {
  const t = useTranslations('panel.courses')
  const locale = useLocale() as Locale

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Course | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Course | null>(null)

  const term = useDebounced(search)
  const query = new URLSearchParams({ page: String(page), limit: '25', sort: 'order' })
  if (term.trim().length >= 2) query.set('search', term.trim())

  const { data, loading, error, refetch } = useQuery<Paginated<Course>>(`/courses?${query}`)
  const remove = useMutation<undefined, unknown>(
    () => `/courses/${deleting?._id ?? ''}`,
    'DELETE',
  )

  const label = (value: Localized | undefined) => value?.[locale] || value?.uz || '—'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder={t('searchPlaceholder')} />
        <NewButton label={t('create')} onClick={() => setEditing('new')} />
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={BookOpen} /> : null}

      {data && data.items.length > 0 ? (
        <Panel action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}>
          <TableShell>
            <thead>
              <tr>
                <Th>{t('name')}</Th>
                <Th>{t('slug')}</Th>
                <Th className="text-right">{t('duration')}</Th>
                <Th className="text-right">{t('defaultPrice')}</Th>
                <Th>{t('visibility')}</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((course) => (
                <tr key={course._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <Td>
                    <span className="font-medium text-ink dark:text-white">
                      {label(course.name)}
                    </span>
                    {course.level ? (
                      <span className="ml-2 text-2xs text-ink-muted">{course.level}</span>
                    ) : null}
                  </Td>
                  <Td className="font-mono text-2xs text-ink-muted">{course.slug}</Td>
                  <Td className="text-right text-2xs">{t('months', { n: course.durationMonths })}</Td>
                  <Td className="text-right">
                    <Money amount={course.defaultPrice} compact />
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-2xs font-medium',
                        course.isPublic
                          ? 'bg-success/12 text-success'
                          : 'bg-navy-50 text-ink-muted dark:bg-navy-800',
                      )}
                    >
                      {course.isPublic ? (
                        <Eye className="size-3" aria-hidden />
                      ) : (
                        <EyeOff className="size-3" aria-hidden />
                      )}
                      {t(course.isPublic ? 'public' : 'hidden')}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <span className="flex justify-end gap-2">
                      <RowAction label={t('edit')} Icon={Pencil} onClick={() => setEditing(course)} />
                      <RowAction
                        label={t('delete')}
                        Icon={Trash2}
                        tone="danger"
                        onClick={() => setDeleting(course)}
                      />
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      <Pagination page={page} pages={data?.pages ?? 1} onChange={setPage} />

      {editing ? (
        <CourseDialog
          course={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void refetch()
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={t('deleteTitle')}
          body={t('deleteBody', { name: label(deleting.name) })}
          confirmLabel={t('delete')}
          pending={remove.pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const result = await remove.mutate()
            if (result !== null) {
              setDeleting(null)
              void refetch()
            }
          }}
        />
      ) : null}
    </div>
  )
}

function CourseDialog({
  course,
  onClose,
  onSaved,
}: {
  course: Course | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.courses')
  const creating = course === null

  const [name, setName] = useState<Localized>(course?.name ?? { uz: '' })
  const [description, setDescription] = useState<Localized>(course?.description ?? { uz: '' })
  const [slug, setSlug] = useState(course?.slug ?? '')
  const [level, setLevel] = useState(course?.level ?? '')
  const [durationMonths, setDurationMonths] = useState(course?.durationMonths ?? 8)
  const [defaultPrice, setDefaultPrice] = useState<number | null>(course?.defaultPrice ?? 0)
  const [isPublic, setIsPublic] = useState(course?.isPublic ?? true)
  const [order, setOrder] = useState(course?.order ?? 0)

  const save = useMutation<Record<string, unknown>, Course>(
    creating ? '/courses' : `/courses/${course._id}`,
    creating ? 'POST' : 'PATCH',
  )

  const ready = name.uz.trim().length > 0 && slug.trim().length >= 2

  return (
    <Dialog title={creating ? t('create') : (name.uz || t('edit'))} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label={t('name')} required>
          <LocalizedTabs value={name} onChange={setName} />
        </Field>

        <Field label={t('slug')} hint={t('slugHint')} required>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="general-english"
            className={cn(INPUT, 'font-mono')}
          />
        </Field>

        <Field label={t('description')}>
          <LocalizedTabs value={description} onChange={setDescription} multiline />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('level')}>
            <input value={level} onChange={(e) => setLevel(e.target.value)} className={INPUT} />
          </Field>
          <Field label={t('duration')}>
            <input
              type="number"
              min={1}
              max={36}
              value={durationMonths}
              onChange={(e) => setDurationMonths(Number(e.target.value))}
              className={INPUT}
            />
          </Field>
        </div>

        <Field label={t('defaultPrice')} hint={t('priceHint')}>
          <MoneyInput value={defaultPrice} onChange={setDefaultPrice} />
        </Field>

        <Field label={t('order')} hint={t('orderHint')}>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className={INPUT}
          />
        </Field>

        <Checkbox
          label={t('public')}
          hint={t('publicHint')}
          checked={isPublic}
          onChange={setIsPublic}
        />

        {save.error ? <DialogError error={save.error} /> : null}

        <Action
          label={creating ? t('create') : t('save')}
          tone="primary"
          pending={save.pending}
          disabled={!ready}
          onClick={async () => {
            const result = await save.mutate({
              name,
              slug: slug.trim(),
              ...(description.uz?.trim() ? { description } : {}),
              ...(level.trim() ? { level: level.trim() } : {}),
              durationMonths,
              defaultPrice: defaultPrice ?? 0,
              isPublic,
              order,
            })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}

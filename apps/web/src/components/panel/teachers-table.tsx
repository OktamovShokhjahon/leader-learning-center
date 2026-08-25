'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { UserSquare2, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { Panel, TableShell, Th, Td, Loading, ErrorBox, Empty } from './primitives'
import { SearchBox, NewButton, RowAction, Pagination, useDebounced } from './table-kit'
import {
  Dialog,
  Field,
  INPUT,
  Select,
  LocalizedTabs,
  Checkbox,
  Action,
  DialogError,
  ConfirmDialog,
  type Localized,
} from './form-kit'
import { CeramicTile, initials } from '@/components/ui/ceramic-tile'
import { cn } from '@/lib/utils'

type TeacherProfile = {
  _id: string
  slug: string
  fullName: string
  role: Localized
  bio?: Localized
  subjects: string[]
  certificates: string[]
  experienceYears: number
  photo?: string
  userId?: string
  isPublic: boolean
  order: number
}

type Staff = { _id: string; fullName: string }

/**
 * TZ §21.1 "Public site content" — the teacher cards the landing page shows.
 *
 * A profile is not an account. The centre wants faces on the site before those
 * people ever sign in, and wants them to stay after someone's login is
 * deactivated, so this is its own record with an optional link to a `User`.
 */
export function TeachersTable() {
  const t = useTranslations('panel.teacherProfiles')
  const locale = useLocale() as Locale

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<TeacherProfile | 'new' | null>(null)
  const [deleting, setDeleting] = useState<TeacherProfile | null>(null)

  const term = useDebounced(search)
  const query = new URLSearchParams({ page: String(page), limit: '25', sort: 'order' })
  if (term.trim().length >= 2) query.set('search', term.trim())

  const { data, loading, error, refetch } = useQuery<Paginated<TeacherProfile>>(
    `/content/teachers?${query}`,
  )
  const remove = useMutation<undefined, unknown>(
    () => `/content/teachers/${deleting?._id ?? ''}`,
    'DELETE',
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder={t('searchPlaceholder')} />
        <NewButton label={t('create')} onClick={() => setEditing('new')} />
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={UserSquare2} /> : null}

      {data && data.items.length > 0 ? (
        <Panel
          action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}
        >
          <TableShell>
            <thead>
              <tr>
                <Th className="text-right">#</Th>
                <Th>{t('name')}</Th>
                <Th>{t('role')}</Th>
                <Th>{t('subjects')}</Th>
                <Th className="text-right">{t('experience')}</Th>
                <Th>{t('visibility')}</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((teacher) => (
                <tr key={teacher._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <Td className="text-right font-mono text-2xs text-ink-muted">{teacher.order}</Td>
                  <Td>
                    <span className="flex items-center gap-3">
                      <CeramicTile
                        seed={teacher._id}
                        label={initials(teacher.fullName)}
                        dense
                        className="size-9 shrink-0 rounded-input"
                      />
                      <span className="flex flex-col">
                        <span className="font-medium text-ink dark:text-white">
                          {teacher.fullName}
                        </span>
                        <span className="font-mono text-2xs text-ink-muted">{teacher.slug}</span>
                      </span>
                    </span>
                  </Td>
                  <Td className="text-2xs text-ink-muted">
                    {teacher.role?.[locale] || teacher.role?.uz}
                  </Td>
                  <Td className="text-2xs text-ink-muted">
                    {teacher.subjects?.length ? teacher.subjects.join(' · ') : '—'}
                  </Td>
                  <Td className="text-right font-mono tabular-nums text-2xs">
                    {teacher.experienceYears ? t('years', { n: teacher.experienceYears }) : '—'}
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-2xs font-medium',
                        teacher.isPublic
                          ? 'bg-success/12 text-success'
                          : 'bg-navy-50 text-ink-muted dark:bg-navy-800',
                      )}
                    >
                      {teacher.isPublic ? (
                        <Eye className="size-3" aria-hidden />
                      ) : (
                        <EyeOff className="size-3" aria-hidden />
                      )}
                      {t(teacher.isPublic ? 'public' : 'hidden')}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <span className="flex justify-end gap-2">
                      <RowAction
                        label={t('edit')}
                        Icon={Pencil}
                        onClick={() => setEditing(teacher)}
                      />
                      <RowAction
                        label={t('delete')}
                        Icon={Trash2}
                        tone="danger"
                        onClick={() => setDeleting(teacher)}
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
        <TeacherDialog
          teacher={editing === 'new' ? null : editing}
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
          body={t('deleteBody', { name: deleting.fullName })}
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

function TeacherDialog({
  teacher,
  onClose,
  onSaved,
}: {
  teacher: TeacherProfile | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.teacherProfiles')
  const creating = teacher === null

  const [fullName, setFullName] = useState(teacher?.fullName ?? '')
  const [slug, setSlug] = useState(teacher?.slug ?? '')
  const [role, setRole] = useState<Localized>(teacher?.role ?? { uz: '' })
  const [bio, setBio] = useState<Localized>(teacher?.bio ?? { uz: '' })
  const [subjects, setSubjects] = useState((teacher?.subjects ?? []).join(', '))
  const [certificates, setCertificates] = useState((teacher?.certificates ?? []).join(', '))
  const [experienceYears, setExperienceYears] = useState(teacher?.experienceYears ?? 0)
  const [photo, setPhoto] = useState(teacher?.photo ?? '')
  const [userId, setUserId] = useState(teacher?.userId ?? '')
  const [isPublic, setIsPublic] = useState(teacher?.isPublic ?? true)
  const [order, setOrder] = useState(teacher?.order ?? 0)

  const { data: staff } = useQuery<Paginated<Staff>>('/users?role=teacher&limit=100&status=active')
  const save = useMutation<Record<string, unknown>, TeacherProfile>(
    creating ? '/content/teachers' : `/content/teachers/${teacher._id}`,
    creating ? 'POST' : 'PATCH',
  )

  // A slug is a URL, and nobody enjoys inventing one. Derive it from the name
  // on create, and leave it alone afterwards so a published link never moves.
  const onName = (value: string) => {
    setFullName(value)
    if (creating && !teacher) {
      setSlug(
        value
          .toLowerCase()
          .replace(/['’`]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
      )
    }
  }

  const list = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  const ready = fullName.trim().length >= 3 && slug.trim().length >= 2 && role.uz.trim().length > 0

  return (
    <Dialog title={creating ? t('create') : fullName} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <Field label={t('name')} required>
          <input
            value={fullName}
            autoFocus
            onChange={(event) => onName(event.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label={t('slug')} hint={t('slugHint')} required>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className={cn(INPUT, 'font-mono')}
          />
        </Field>

        <Field label={t('role')} required>
          <LocalizedTabs value={role} onChange={setRole} />
        </Field>

        <Field label={t('bio')}>
          <LocalizedTabs value={bio} onChange={setBio} multiline />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('subjects')} hint={t('listHint')}>
            <input
              value={subjects}
              onChange={(event) => setSubjects(event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label={t('certificates')} hint={t('listHint')}>
            <input
              value={certificates}
              onChange={(event) => setCertificates(event.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('experience')}>
            <input
              type="number"
              min={0}
              max={70}
              value={experienceYears}
              onChange={(event) => setExperienceYears(Number(event.target.value))}
              className={INPUT}
            />
          </Field>
          <Field label={t('order')} hint={t('orderHint')}>
            <input
              type="number"
              value={order}
              onChange={(event) => setOrder(Number(event.target.value))}
              className={INPUT}
            />
          </Field>
        </div>

        <Field label={t('photo')} hint={t('photoHint')}>
          <input
            value={photo}
            onChange={(event) => setPhoto(event.target.value)}
            placeholder="/images/teachers/…jpg"
            className={cn(INPUT, 'font-mono')}
          />
        </Field>

        <Field label={t('account')} hint={t('accountHint')}>
          <Select
            value={userId}
            onChange={setUserId}
            placeholder={t('noAccount')}
            options={(staff?.items ?? []).map((person) => ({
              value: person._id,
              label: person.fullName,
            }))}
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
              fullName: fullName.trim(),
              slug: slug.trim(),
              role,
              ...(bio.uz?.trim() ? { bio } : {}),
              subjects: list(subjects),
              certificates: list(certificates),
              experienceYears,
              ...(photo.trim() ? { photo: photo.trim() } : {}),
              ...(userId ? { userId } : {}),
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

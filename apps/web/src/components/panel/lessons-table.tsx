'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Video, Pencil, Trash2, Eye, EyeOff, Gift } from 'lucide-react'
import { VIDEO_PROVIDERS } from '@leader/shared/schemas'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { Panel, TableShell, Th, Td, Loading, ErrorBox, Empty } from './primitives'
import { NewButton, RowAction, FilterChip, Pagination } from './table-kit'
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
  FileUpload,
  type Localized,
} from './form-kit'
import { cn } from '@/lib/utils'

type Course = { _id: string; name: Localized; slug: string }

type Lesson = {
  _id: string
  courseId: Course | string
  title: Localized
  description?: Localized
  provider: string
  videoId: string
  durationMinutes: number
  order: number
  isPublished: boolean
  isFree: boolean
  groupIds?: string[]
}

type GroupOption = { _id: string; name: string }
type ExistingVideo = { videoId: string; title?: Localized; durationMinutes?: number; usedBy: number }

const idOf = (value: unknown): string =>
  typeof value === 'string' ? value : ((value as { _id?: string })?._id ?? '')

/**
 * TZ §17.3 — the video lesson catalogue, boss-only.
 *
 * A lesson is a course, a title and a video the centre already hosts somewhere.
 * §18's protection layer — no download, no screenshot, per-viewer watermark —
 * is not built, so a lesson is exactly as private as the provider makes it;
 * see docs/adr/0006. That is why `isFree` defaults off: an unfree lesson is at
 * least gated behind an enrolment check on the API.
 */
export function LessonsTable() {
  const t = useTranslations('panel.lessons')
  const locale = useLocale() as Locale

  const [courseId, setCourseId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Lesson | null>(null)

  const query = new URLSearchParams({ page: String(page), limit: '25', sort: 'order' })
  if (courseId) query.set('courseId', courseId)

  const { data, loading, error, refetch } = useQuery<Paginated<Lesson>>(`/content/lessons?${query}`)
  const { data: courses } = useQuery<Paginated<Course>>('/courses?limit=100&sort=order')
  const remove = useMutation<undefined, unknown>(
    () => `/content/lessons/${deleting?._id ?? ''}`,
    'DELETE',
  )

  const courseName = (course: Course | string | undefined) =>
    typeof course === 'object' ? course.name?.[locale] || course.name?.uz || '—' : '—'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label={t('allCourses')}
            active={courseId === null}
            onClick={() => {
              setCourseId(null)
              setPage(1)
            }}
          />
          {(courses?.items ?? []).map((course) => (
            <FilterChip
              key={course._id}
              label={course.name?.[locale] || course.name?.uz || course.slug}
              active={courseId === course._id}
              onClick={() => {
                setCourseId(course._id)
                setPage(1)
              }}
            />
          ))}
        </div>
        <span className="flex-1" />
        <NewButton label={t('create')} onClick={() => setEditing('new')} />
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={Video} /> : null}

      {data && data.items.length > 0 ? (
        <Panel
          action={<span className="text-2xs text-ink-muted">{t('count', { n: data.total })}</span>}
        >
          <TableShell>
            <thead>
              <tr>
                <Th className="text-right">#</Th>
                <Th>{t('title')}</Th>
                <Th>{t('course')}</Th>
                <Th>{t('source')}</Th>
                <Th className="text-right">{t('duration')}</Th>
                <Th>{t('statusLabel')}</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((lesson) => (
                <tr key={lesson._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <Td className="text-right font-mono text-2xs text-ink-muted">{lesson.order}</Td>
                  <Td className="font-medium text-ink dark:text-white">
                    {lesson.title?.[locale] || lesson.title?.uz}
                  </Td>
                  <Td className="text-2xs text-ink-muted">{courseName(lesson.courseId)}</Td>
                  <Td className="font-mono text-2xs text-ink-muted">
                    {lesson.provider} · {lesson.videoId.slice(0, 18)}
                  </Td>
                  <Td className="text-right font-mono tabular-nums text-2xs">
                    {lesson.durationMinutes ? t('minutes', { n: lesson.durationMinutes }) : '—'}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-2xs font-medium',
                          lesson.isPublished
                            ? 'bg-success/12 text-success'
                            : 'bg-navy-50 text-ink-muted dark:bg-navy-800',
                        )}
                      >
                        {lesson.isPublished ? (
                          <Eye className="size-3" aria-hidden />
                        ) : (
                          <EyeOff className="size-3" aria-hidden />
                        )}
                        {t(lesson.isPublished ? 'published' : 'draft')}
                      </span>
                      {lesson.isFree ? (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-clay-500/15 px-2 py-1 text-2xs text-clay-600 dark:text-clay-300">
                          <Gift className="size-3" aria-hidden />
                          {t('free')}
                        </span>
                      ) : null}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <span className="flex justify-end gap-2">
                      <RowAction label={t('edit')} Icon={Pencil} onClick={() => setEditing(lesson)} />
                      <RowAction
                        label={t('delete')}
                        Icon={Trash2}
                        tone="danger"
                        onClick={() => setDeleting(lesson)}
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
        <LessonDialog
          lesson={editing === 'new' ? null : editing}
          courses={courses?.items ?? []}
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
          body={t('deleteBody', { name: deleting.title?.uz ?? '' })}
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

function LessonDialog({
  lesson,
  courses,
  onClose,
  onSaved,
}: {
  lesson: Lesson | null
  courses: Course[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.lessons')
  const locale = useLocale() as Locale
  const creating = lesson === null

  const [courseId, setCourseId] = useState(idOf(lesson?.courseId))
  const [title, setTitle] = useState<Localized>(lesson?.title ?? { uz: '' })
  const [description, setDescription] = useState<Localized>(lesson?.description ?? { uz: '' })
  const [provider, setProvider] = useState(lesson?.provider ?? 'youtube')
  const [videoId, setVideoId] = useState(lesson?.videoId ?? '')
  const [durationMinutes, setDurationMinutes] = useState(lesson?.durationMinutes ?? 0)
  const [order, setOrder] = useState(lesson?.order ?? 0)
  const [isPublished, setIsPublished] = useState(lesson?.isPublished ?? false)
  const [isFree, setIsFree] = useState(lesson?.isFree ?? false)
  /** D1 — the explicit access allow-list; empty means nobody can watch yet. */
  const [groupIds, setGroupIds] = useState<string[]>(lesson?.groupIds ?? [])
  /** D2 — reuse an already-uploaded file instead of uploading a duplicate. */
  const [reuseMode, setReuseMode] = useState(false)

  const { data: courseGroups } = useQuery<Paginated<GroupOption>>(
    courseId ? `/groups?courseId=${courseId}&limit=200&status=active` : null,
  )
  const { data: existingVideos } = useQuery<ExistingVideo[]>(
    provider === 'file' ? '/content/lessons/videos' : null,
  )

  const save = useMutation<Record<string, unknown>, Lesson>(
    creating ? '/content/lessons' : `/content/lessons/${lesson._id}`,
    creating ? 'POST' : 'PATCH',
  )

  /**
   * People paste the whole watch URL, not the id. Pulling the id out here means
   * the stored value is clean — and it drops the tracking parameters that ride
   * along on a copied link.
   */
  const normaliseVideoId = (raw: string): string => {
    const value = raw.trim()
    if (provider === 'file') return value
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/,
      /vimeo\.com\/(?:video\/)?(\d+)/,
    ]
    for (const pattern of patterns) {
      const match = value.match(pattern)
      if (match?.[1]) return match[1]
    }
    return value
  }

  const ready = courseId && title.uz.trim().length > 0 && videoId.trim().length > 0

  return (
    <Dialog title={creating ? t('create') : (title.uz || t('edit'))} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <Field label={t('course')} required>
          <Select
            value={courseId}
            onChange={setCourseId}
            placeholder={t('chooseCourse')}
            disabled={!creating}
            options={courses.map((course) => ({
              value: course._id,
              label: course.name?.[locale] || course.name?.uz || course.slug,
            }))}
          />
        </Field>

        <Field label={t('title')} required>
          <LocalizedTabs value={title} onChange={setTitle} />
        </Field>

        <Field label={t('description')}>
          <LocalizedTabs value={description} onChange={setDescription} multiline />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('provider')}>
            <Select
              value={provider}
              onChange={setProvider}
              options={VIDEO_PROVIDERS.map((option) => ({
                value: option,
                label: t(`providers.${option}`),
              }))}
            />
          </Field>
          <Field label={t('duration')}>
            <input
              type="number"
              min={0}
              max={600}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              className={INPUT}
            />
          </Field>
        </div>

        <Field
          label={provider === 'file' ? t('videoFile') : t('videoId')}
          hint={provider === 'file' ? t('videoFileHint') : t('videoIdHint')}
          required
        >
          {provider === 'file' ? (
            <div className="flex flex-col gap-2">
              {/* D2 — one uploaded file, referenced by several lessons: no need
                  to re-upload the same lecture for a second course or group. */}
              {(existingVideos?.length ?? 0) > 0 ? (
                <div className="flex gap-1 rounded-pill border border-border-subtle p-1 self-start">
                  <button
                    type="button"
                    onClick={() => setReuseMode(false)}
                    className={cn(
                      'rounded-pill px-3 py-1.5 text-2xs font-medium transition-colors',
                      !reuseMode ? 'bg-navy-600 text-white' : 'text-ink-soft dark:text-navy-200',
                    )}
                  >
                    {t('uploadNew')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReuseMode(true)}
                    className={cn(
                      'rounded-pill px-3 py-1.5 text-2xs font-medium transition-colors',
                      reuseMode ? 'bg-navy-600 text-white' : 'text-ink-soft dark:text-navy-200',
                    )}
                  >
                    {t('reuseExisting')}
                  </button>
                </div>
              ) : null}

              {reuseMode ? (
                <Select
                  value={videoId}
                  onChange={setVideoId}
                  placeholder={t('chooseVideo')}
                  options={(existingVideos ?? []).map((video) => ({
                    value: video.videoId,
                    label: `${video.title?.[locale] || video.title?.uz || video.videoId} · ${t('usedBy', { n: video.usedBy })}`,
                  }))}
                />
              ) : (
                <FileUpload
                  label={t('videoFile')}
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  value={videoId}
                  onUploaded={(url) => setVideoId(url)}
                />
              )}
            </div>
          ) : (
            <input
              value={videoId}
              onChange={(event) => setVideoId(event.target.value)}
              onBlur={(event) => setVideoId(normaliseVideoId(event.target.value))}
              placeholder="dQw4w9WgXcQ"
              className={cn(INPUT, 'font-mono')}
            />
          )}
        </Field>

        {/* D1 — access is explicit: nobody can watch until a group is checked. */}
        {!isFree ? (
          <Field label={t('accessGroups')} hint={t('accessGroupsHint')}>
            {!courseId ? (
              <p className="text-2xs text-ink-muted">{t('chooseCourseFirst')}</p>
            ) : (courseGroups?.items?.length ?? 0) === 0 ? (
              <p className="text-2xs text-ink-muted">{t('noGroupsForCourse')}</p>
            ) : (
              <div className="flex flex-col gap-2 rounded-input border border-border-subtle p-3">
                {(courseGroups?.items ?? []).map((group) => (
                  <label key={group._id} className="flex items-center gap-2 text-xs text-ink dark:text-white">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(group._id)}
                      onChange={(event) =>
                        setGroupIds((current) =>
                          event.target.checked
                            ? [...current, group._id]
                            : current.filter((id) => id !== group._id),
                        )
                      }
                      className="size-4 rounded accent-navy-600"
                    />
                    {group.name}
                  </label>
                ))}
              </div>
            )}
          </Field>
        ) : null}

        <Field label={t('order')} hint={t('orderHint')}>
          <input
            type="number"
            value={order}
            onChange={(event) => setOrder(Number(event.target.value))}
            className={INPUT}
          />
        </Field>

        <Checkbox
          label={t('published')}
          hint={t('publishedHint')}
          checked={isPublished}
          onChange={setIsPublished}
        />
        <Checkbox label={t('free')} hint={t('freeHint')} checked={isFree} onChange={setIsFree} />

        {save.error ? <DialogError error={save.error} /> : null}

        <Action
          label={creating ? t('create') : t('save')}
          tone="primary"
          pending={save.pending}
          disabled={!ready}
          onClick={async () => {
            const result = await save.mutate({
              ...(creating ? { courseId } : {}),
              title,
              ...(description.uz?.trim() ? { description } : {}),
              provider,
              videoId: normaliseVideoId(videoId),
              durationMinutes,
              order,
              isPublished,
              isFree,
              groupIds: isFree ? [] : groupIds,
            })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  MonitorPlay,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Gift,
  Video,
  FileCheck2,
  Paperclip,
  Upload,
  Plus,
  X,
  Check,
  AlertTriangle,
  BarChart3,
  Users,
} from 'lucide-react'
import {
  VIDEO_PROVIDERS,
  MATERIAL_TYPES,
  parseGiftText,
  parseSheetRows,
  toLocalizedQuestions,
  type ParsedQuestion,
  type ParseIssue,
} from '@leader/shared'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { Panel, TableShell, Th, Td, Loading, ErrorBox, Empty } from './primitives'
import { NewButton, RowAction, FilterChip, Pagination, SearchBox, useDebounced } from './table-kit'
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
type StudentRow = { _id: string; fullName: string; phone?: string }

type LocalizedOption = { key: string; text: Localized }
type Question = {
  key: string
  prompt: Localized
  options: LocalizedOption[]
  correctKey: string
  explanation?: Localized
}

type LessonVideo = {
  provider: string
  videoId: string
  durationMinutes: number
  thumbnail?: string
}

type LessonTest = {
  questions: Question[]
  passMark: number
  maxAttempts: number
  timeLimitMinutes: number
}

type LessonMaterial = {
  key: string
  title: Localized
  type: (typeof MATERIAL_TYPES)[number]
  fileUrl: string
}

type Lesson = {
  _id: string
  courseId: Course | string
  title: Localized
  description?: Localized
  video?: LessonVideo | null
  test?: (Omit<LessonTest, 'questions'> & { questions?: Question[] }) | null
  materials?: LessonMaterial[]
  accessCourseIds?: string[]
  accessStudentIds?: string[]
  isFree: boolean
  order: number
  isPublished: boolean
  questionCount?: number
}

type ExistingVideo = { videoId: string; title?: Localized; durationMinutes?: number; usedBy: number }

const idOf = (value: unknown): string =>
  typeof value === 'string' ? value : ((value as { _id?: string })?._id ?? '')

/** Short, collision-free enough for keys that only need to be stable per lesson. */
const newKey = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8)}`

/**
 * Online darslar — the authoring screen.
 *
 * It replaces three: the video catalogue, the test importer and the library.
 * Those were three lists, three dialogs and — the part that actually hurt —
 * three different answers to "who can open this?". A lesson is now one row with
 * one access list, so granting a course access to the recording grants it the
 * same access to the test and the handouts, because they are the same thing.
 *
 * SuperAdmin only, enforced at the router mount on the API (§4.3); the nav hides
 * it from everyone else as a convenience, never as the control.
 */
export function OnlineLessonsTable() {
  const t = useTranslations('panel.online')
  const locale = useLocale() as Locale

  const [courseId, setCourseId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Lesson | null>(null)
  const [results, setResults] = useState<Lesson | null>(null)

  const debounced = useDebounced(search)

  const query = new URLSearchParams({ page: String(page), limit: '25' })
  if (courseId) query.set('courseId', courseId)
  if (debounced.trim()) query.set('search', debounced.trim())

  const { data, loading, error, refetch } = useQuery<Paginated<Lesson>>(
    `/online/admin/lessons?${query}`,
  )
  const { data: courses } = useQuery<Paginated<Course>>('/courses?limit=100&sort=order')
  const remove = useMutation<undefined, unknown>(
    () => `/online/admin/lessons/${deleting?._id ?? ''}`,
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
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder={t('searchPlaceholder')}
        />
        <NewButton label={t('create')} onClick={() => setEditing('new')} />
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={MonitorPlay} /> : null}

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
                <Th>{t('parts')}</Th>
                <Th>{t('access')}</Th>
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
                  <Td>
                    {/* The three halves at a glance — this is the whole point of
                        merging the screens, so it belongs in the list. */}
                    <span className="flex gap-1.5">
                      <PartChip
                        Icon={Video}
                        on={Boolean(lesson.video?.videoId)}
                        label={t('partVideo')}
                      />
                      <PartChip
                        Icon={FileCheck2}
                        on={(lesson.questionCount ?? 0) > 0}
                        label={t('partTest', { n: lesson.questionCount ?? 0 })}
                      />
                      <PartChip
                        Icon={Paperclip}
                        on={(lesson.materials?.length ?? 0) > 0}
                        label={t('partFiles', { n: lesson.materials?.length ?? 0 })}
                      />
                    </span>
                  </Td>
                  <Td className="text-2xs text-ink-muted">
                    {lesson.isFree
                      ? t('everyone')
                      : t('accessSummary', {
                          courses: lesson.accessCourseIds?.length ?? 0,
                          students: lesson.accessStudentIds?.length ?? 0,
                        })}
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
                      {(lesson.questionCount ?? 0) > 0 ? (
                        <RowAction
                          label={t('results')}
                          Icon={BarChart3}
                          onClick={() => setResults(lesson)}
                        />
                      ) : null}
                      <RowAction
                        label={t('edit')}
                        Icon={Pencil}
                        onClick={() => setEditing(lesson)}
                      />
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
          lessonId={editing === 'new' ? null : editing._id}
          courses={courses?.items ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void refetch()
          }}
        />
      ) : null}

      {results ? (
        <ResultsDialog
          lesson={results}
          title={results.title?.[locale] || results.title?.uz || ''}
          onClose={() => setResults(null)}
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

function PartChip({
  Icon,
  on,
  label,
}: {
  Icon: typeof Video
  on: boolean
  label: string
}) {
  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-1 text-2xs',
        on
          ? 'bg-glaze-50 text-glaze-700 dark:bg-navy-800 dark:text-glaze-300'
          : 'bg-navy-50/60 text-ink-muted/50 dark:bg-navy-800/40',
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  )
}

/* ── The editor ───────────────────────────────────────────────────────── */

const TABS = ['general', 'video', 'test', 'materials', 'access'] as const
type Tab = (typeof TABS)[number]

/**
 * One dialog, five tabs — the lesson's parts side by side rather than three
 * screens apart. Everything saves in one request, so a lesson is never half
 * created with its test still missing.
 */
function LessonDialog({
  lessonId,
  courses,
  onClose,
  onSaved,
}: {
  lessonId: string | null
  courses: Course[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.online')
  const locale = useLocale() as Locale
  const creating = lessonId === null

  // Editing loads the full record — the list deliberately omits the questions,
  // and the answer key only comes back from this one endpoint.
  const { data: full, loading: loadingLesson } = useQuery<Lesson>(
    lessonId ? `/online/admin/lessons/${lessonId}` : null,
  )

  const [tab, setTab] = useState<Tab>('general')

  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState<Localized>({ uz: '' })
  const [description, setDescription] = useState<Localized>({ uz: '' })
  const [order, setOrder] = useState(0)
  const [isPublished, setIsPublished] = useState(false)
  const [isFree, setIsFree] = useState(false)

  const [hasVideo, setHasVideo] = useState(false)
  const [provider, setProvider] = useState('youtube')
  const [videoId, setVideoId] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(0)
  const [reuseMode, setReuseMode] = useState(false)

  const [questions, setQuestions] = useState<Question[]>([])
  const [passMark, setPassMark] = useState(70)
  const [maxAttempts, setMaxAttempts] = useState(0)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(0)

  const [materials, setMaterials] = useState<LessonMaterial[]>([])

  const [accessCourseIds, setAccessCourseIds] = useState<string[]>([])
  const [accessStudentIds, setAccessStudentIds] = useState<string[]>([])

  /** Fill the form once the record arrives; creating starts from the defaults. */
  useEffect(() => {
    if (!full) return
    setCourseId(idOf(full.courseId))
    setTitle(full.title ?? { uz: '' })
    setDescription(full.description ?? { uz: '' })
    setOrder(full.order ?? 0)
    setIsPublished(full.isPublished ?? false)
    setIsFree(full.isFree ?? false)

    setHasVideo(Boolean(full.video?.videoId))
    setProvider(full.video?.provider ?? 'youtube')
    setVideoId(full.video?.videoId ?? '')
    setDurationMinutes(full.video?.durationMinutes ?? 0)

    setQuestions(full.test?.questions ?? [])
    setPassMark(full.test?.passMark ?? 70)
    setMaxAttempts(full.test?.maxAttempts ?? 0)
    setTimeLimitMinutes(full.test?.timeLimitMinutes ?? 0)

    setMaterials(full.materials ?? [])
    setAccessCourseIds(full.accessCourseIds ?? [])
    setAccessStudentIds(full.accessStudentIds ?? [])
  }, [full])

  const { data: existingVideos } = useQuery<ExistingVideo[]>(
    provider === 'file' ? '/online/admin/videos' : null,
  )

  const save = useMutation<Record<string, unknown>, Lesson>(
    creating ? '/online/admin/lessons' : `/online/admin/lessons/${lessonId}`,
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

  const ready = courseId && title.uz.trim().length > 0

  const courseLabel = (course: Course) =>
    course.name?.[locale] || course.name?.uz || course.slug

  return (
    <Dialog title={creating ? t('create') : title.uz || t('edit')} onClose={onClose} wide>
      {loadingLesson ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-1 rounded-pill border border-border-subtle p-1">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTab(name)}
                aria-pressed={tab === name}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-pill px-3 py-2 text-2xs font-medium transition-colors',
                  tab === name
                    ? 'bg-navy-600 text-white'
                    : 'text-ink-soft hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-800',
                )}
              >
                {t(`tabs.${name}`)}
              </button>
            ))}
          </div>

          {tab === 'general' ? (
            <div className="flex flex-col gap-4">
              <Field label={t('course')} hint={t('courseHint')} required>
                <Select
                  value={courseId}
                  onChange={setCourseId}
                  placeholder={t('chooseCourse')}
                  options={courses.map((course) => ({
                    value: course._id,
                    label: courseLabel(course),
                  }))}
                />
              </Field>

              <Field label={t('title')} required>
                <LocalizedTabs value={title} onChange={setTitle} />
              </Field>

              <Field label={t('description')}>
                <LocalizedTabs value={description} onChange={setDescription} multiline />
              </Field>

              <Field label={t('order')} hint={t('orderHint')}>
                <input
                  type="number"
                  min={0}
                  value={order}
                  onChange={(event) => setOrder(Number(event.target.value))}
                  className={INPUT}
                />
              </Field>

              <Checkbox
                label={t('publishedLabel')}
                hint={t('publishedHint')}
                checked={isPublished}
                onChange={setIsPublished}
              />
            </div>
          ) : null}

          {tab === 'video' ? (
            <div className="flex flex-col gap-4">
              <Checkbox
                label={t('hasVideo')}
                hint={t('hasVideoHint')}
                checked={hasVideo}
                onChange={setHasVideo}
              />

              {hasVideo ? (
                <>
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
                        {/* One uploaded file, referenced by several lessons: no
                            need to re-upload the same lecture for a second course. */}
                        {(existingVideos?.length ?? 0) > 0 ? (
                          <div className="flex gap-1 self-start rounded-pill border border-border-subtle p-1">
                            <button
                              type="button"
                              onClick={() => setReuseMode(false)}
                              className={cn(
                                'rounded-pill px-3 py-1.5 text-2xs font-medium transition-colors',
                                !reuseMode
                                  ? 'bg-navy-600 text-white'
                                  : 'text-ink-soft dark:text-navy-200',
                              )}
                            >
                              {t('uploadNew')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setReuseMode(true)}
                              className={cn(
                                'rounded-pill px-3 py-1.5 text-2xs font-medium transition-colors',
                                reuseMode
                                  ? 'bg-navy-600 text-white'
                                  : 'text-ink-soft dark:text-navy-200',
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
                </>
              ) : null}
            </div>
          ) : null}

          {tab === 'test' ? (
            <TestTab
              questions={questions}
              onQuestions={setQuestions}
              passMark={passMark}
              onPassMark={setPassMark}
              maxAttempts={maxAttempts}
              onMaxAttempts={setMaxAttempts}
              timeLimitMinutes={timeLimitMinutes}
              onTimeLimit={setTimeLimitMinutes}
            />
          ) : null}

          {tab === 'materials' ? (
            <MaterialsTab materials={materials} onChange={setMaterials} />
          ) : null}

          {tab === 'access' ? (
            <AccessTab
              courses={courses}
              courseLabel={courseLabel}
              isFree={isFree}
              onFree={setIsFree}
              courseIds={accessCourseIds}
              onCourseIds={setAccessCourseIds}
              studentIds={accessStudentIds}
              onStudentIds={setAccessStudentIds}
            />
          ) : null}

          {save.error ? <DialogError error={save.error} /> : null}

          <Action
            label={creating ? t('create') : t('save')}
            tone="primary"
            pending={save.pending}
            disabled={!ready}
            onClick={async () => {
              const result = await save.mutate({
                courseId,
                title,
                ...(description.uz?.trim() ? { description } : { description: undefined }),
                video:
                  hasVideo && videoId.trim()
                    ? {
                        provider,
                        videoId: normaliseVideoId(videoId),
                        durationMinutes,
                      }
                    : null,
                test:
                  questions.length > 0
                    ? { questions, passMark, maxAttempts, timeLimitMinutes }
                    : null,
                materials,
                accessCourseIds: isFree ? [] : accessCourseIds,
                accessStudentIds: isFree ? [] : accessStudentIds,
                isFree,
                order,
                isPublished,
              })
              if (result) onSaved()
            }}
          />
        </div>
      )}
    </Dialog>
  )
}

/* ── Test tab ─────────────────────────────────────────────────────────── */

/**
 * Questions come in one of two ways: a file the teacher already has (GIFT text
 * or a spreadsheet), or typed here one at a time. Parsing stays in the browser,
 * using the same parser the unit tests cover, so a mis-keyed question is caught
 * before anything is saved rather than after thirty students have sat it.
 */
function TestTab({
  questions,
  onQuestions,
  passMark,
  onPassMark,
  maxAttempts,
  onMaxAttempts,
  timeLimitMinutes,
  onTimeLimit,
}: {
  questions: Question[]
  onQuestions: (value: Question[]) => void
  passMark: number
  onPassMark: (value: number) => void
  maxAttempts: number
  onMaxAttempts: (value: number) => void
  timeLimitMinutes: number
  onTimeLimit: (value: number) => void
}) {
  const t = useTranslations('panel.online')
  const locale = useLocale() as Locale
  const fileRef = useRef<HTMLInputElement>(null)

  const [issues, setIssues] = useState<ParseIssue[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const ingest = async (file: File) => {
    setParseError(null)
    setIssues([])
    try {
      let parsed: { questions: ParsedQuestion[]; issues: ParseIssue[] }
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        // SheetJS is only needed for a spreadsheet, so it loads on demand rather
        // than shipping to every author who pastes text.
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) throw new Error('empty workbook')
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]!, {
          header: 1,
          blankrows: false,
          defval: '',
        })
        parsed = parseSheetRows(
          (rows as unknown[][]).map((row) => row.map((cell) => String(cell ?? ''))),
        )
      } else {
        parsed = parseGiftText(await file.text())
      }

      setIssues(parsed.issues)
      // Appended, not replaced: a test is often assembled from two files.
      onQuestions([...questions, ...(toLocalizedQuestions(parsed.questions, locale) as Question[])])
    } catch {
      setParseError(t('unreadable'))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('passMark')} hint={t('passHint')}>
          <input
            type="number"
            min={1}
            max={100}
            value={passMark}
            onChange={(event) => onPassMark(Number(event.target.value))}
            className={cn(INPUT, 'font-mono')}
          />
        </Field>
        <Field label={t('maxAttempts')} hint={t('maxAttemptsHint')}>
          <input
            type="number"
            min={0}
            value={maxAttempts}
            onChange={(event) => onMaxAttempts(Number(event.target.value))}
            className={cn(INPUT, 'font-mono')}
          />
        </Field>
        <Field label={t('timeLimit')} hint={t('timeLimitHint')}>
          <input
            type="number"
            min={0}
            value={timeLimitMinutes}
            onChange={(event) => onTimeLimit(Number(event.target.value))}
            className={cn(INPUT, 'font-mono')}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.xlsx,.xls"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void ingest(file)
            event.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-11 items-center gap-2 rounded-pill border border-navy-600/25 px-4 text-2xs font-medium text-navy-700 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
        >
          <Upload className="size-4" aria-hidden />
          {t('importFile')}
        </button>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-11 items-center gap-2 rounded-pill border border-navy-600/25 px-4 text-2xs font-medium text-navy-700 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
        >
          <Plus className="size-4" aria-hidden />
          {t('addQuestion')}
        </button>
        <span className="flex-1" />
        {questions.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              onQuestions([])
              setIssues([])
            }}
            className="inline-flex h-11 items-center gap-1.5 px-2 text-2xs text-ink-muted hover:text-danger"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {t('clearQuestions')}
          </button>
        ) : null}
      </div>

      <p className="text-2xs text-ink-muted">{t('importHint')}</p>

      {parseError ? <ErrorBox message={parseError} /> : null}

      {issues.length > 0 ? (
        <div className="rounded-card border border-warning/30 bg-warning/5 p-4">
          <p className="mb-2 flex items-center gap-2 text-2xs font-medium text-warning">
            <AlertTriangle className="size-4" aria-hidden />
            {t('issuesTitle', { n: issues.length })}
          </p>
          <ul className="flex flex-col gap-1">
            {issues.slice(0, 8).map((issue, index) => (
              <li key={index} className="text-2xs text-ink-soft dark:text-navy-200">
                <span className="font-mono text-ink-muted">{t('line', { n: issue.line })}</span> —{' '}
                {issue.code}
                {issue.detail ? <span className="opacity-70"> · {issue.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {questions.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-subtle p-6 text-center text-2xs text-ink-muted">
          {t('noQuestions')}
        </p>
      ) : (
        <ul className="max-h-80 overflow-y-auto rounded-card border border-border-subtle">
          {questions.map((question, index) => (
            <li
              key={question.key}
              className="flex flex-col gap-2 border-b border-border-subtle p-4 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 font-mono text-2xs text-ink-muted">{index + 1}.</span>
                <p className="flex-1 text-xs text-ink dark:text-white">
                  {question.prompt?.[locale] || question.prompt?.uz}
                </p>
                <button
                  type="button"
                  aria-label={t('removeQuestion')}
                  onClick={() => onQuestions(questions.filter((_, i) => i !== index))}
                  className="shrink-0 text-ink-muted hover:text-danger"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <ul className="flex flex-wrap gap-1.5 pl-7">
                {question.options.map((option) => {
                  const correct = option.key === question.correctKey
                  return (
                    <li
                      key={option.key}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-2xs',
                        correct
                          ? 'bg-success/12 font-medium text-success'
                          : 'bg-navy-50 text-ink-muted dark:bg-navy-800',
                      )}
                    >
                      {correct ? <Check className="size-3" aria-hidden /> : null}
                      {option.text?.[locale] || option.text?.uz}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <QuestionEditor
          onClose={() => setAdding(false)}
          onAdd={(question) => {
            onQuestions([...questions, question])
            setAdding(false)
          }}
        />
      ) : null}
    </div>
  )
}

/** Typing one question by hand — four options, one of them marked correct. */
function QuestionEditor({
  onAdd,
  onClose,
}: {
  onAdd: (question: Question) => void
  onClose: () => void
}) {
  const t = useTranslations('panel.online')
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState(0)
  const [explanation, setExplanation] = useState('')

  const filled = options.map((text) => text.trim()).filter(Boolean)
  const ready = prompt.trim().length > 0 && filled.length >= 2 && options[correct]?.trim()

  return (
    <Dialog title={t('addQuestion')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label={t('questionPrompt')} required>
          <textarea
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className={cn(INPUT, 'resize-y')}
          />
        </Field>

        <Field label={t('options')} hint={t('optionsHint')} required>
          <div className="flex flex-col gap-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrect(index)}
                  aria-label={t('markCorrect')}
                  aria-pressed={correct === index}
                  className={cn(
                    'inline-flex size-9 shrink-0 items-center justify-center rounded-pill border transition-colors',
                    correct === index
                      ? 'border-success bg-success/12 text-success'
                      : 'border-border-subtle text-ink-muted hover:border-navy-600/40',
                  )}
                >
                  <Check className="size-4" aria-hidden />
                </button>
                <input
                  value={option}
                  onChange={(event) =>
                    setOptions(options.map((v, i) => (i === index ? event.target.value : v)))
                  }
                  className={INPUT}
                />
              </div>
            ))}
          </div>
        </Field>

        <Field label={t('explanation')} hint={t('explanationHint')}>
          <textarea
            rows={2}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            className={cn(INPUT, 'resize-y')}
          />
        </Field>

        <Action
          label={t('addQuestion')}
          tone="primary"
          disabled={!ready}
          onClick={() => {
            const kept = options
              .map((text, index) => ({ text: text.trim(), index }))
              .filter((entry) => entry.text.length > 0)

            onAdd({
              key: newKey('q'),
              prompt: { uz: prompt.trim() },
              options: kept.map((entry) => ({
                key: String.fromCharCode(97 + entry.index),
                text: { uz: entry.text },
              })),
              correctKey: String.fromCharCode(97 + correct),
              ...(explanation.trim() ? { explanation: { uz: explanation.trim() } } : {}),
            })
          }}
        />
      </div>
    </Dialog>
  )
}

/* ── Materials tab ────────────────────────────────────────────────────── */

/** The kutubxona half: the handouts that belong to this lesson, and only it. */
function MaterialsTab({
  materials,
  onChange,
}: {
  materials: LessonMaterial[]
  onChange: (value: LessonMaterial[]) => void
}) {
  const t = useTranslations('panel.online')
  const locale = useLocale() as Locale

  const acceptFor = (kind: (typeof MATERIAL_TYPES)[number]) =>
    kind === 'pdf'
      ? 'application/pdf,.pdf'
      : kind === 'audio'
        ? 'audio/mpeg,audio/mp4,.mp3,.m4a'
        : 'video/mp4,video/webm,.mp4,.webm'

  const patch = (index: number, part: Partial<LessonMaterial>) =>
    onChange(materials.map((item, i) => (i === index ? { ...item, ...part } : item)))

  return (
    <div className="flex flex-col gap-4">
      {materials.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-subtle p-6 text-center text-2xs text-ink-muted">
          {t('noMaterials')}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {materials.map((material, index) => (
          <li
            key={material.key}
            className="flex flex-col gap-3 rounded-card border border-border-subtle p-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex-1 text-2xs font-medium text-ink-muted">
                {material.title?.[locale] || material.title?.uz || t('untitledFile')}
              </span>
              <button
                type="button"
                aria-label={t('removeFile')}
                onClick={() => onChange(materials.filter((_, i) => i !== index))}
                className="text-ink-muted hover:text-danger"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <Field label={t('fileTitle')} required>
              <LocalizedTabs
                value={material.title}
                onChange={(value) => patch(index, { title: value })}
              />
            </Field>

            <Field label={t('fileType')}>
              <Select
                value={material.type}
                onChange={(value) =>
                  patch(index, { type: value as (typeof MATERIAL_TYPES)[number] })
                }
                options={MATERIAL_TYPES.map((option) => ({
                  value: option,
                  label: t(`types.${option}`),
                }))}
              />
            </Field>

            <FileUpload
              label={t('file')}
              accept={acceptFor(material.type)}
              value={material.fileUrl}
              onUploaded={(url) => patch(index, { fileUrl: url })}
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() =>
          onChange([
            ...materials,
            { key: newKey('m'), title: { uz: '' }, type: 'pdf', fileUrl: '' },
          ])
        }
        className="inline-flex h-11 items-center justify-center gap-2 rounded-pill border border-navy-600/25 px-4 text-2xs font-medium text-navy-700 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
      >
        <Plus className="size-4" aria-hidden />
        {t('addFile')}
      </button>
    </div>
  )
}

/* ── Access tab ───────────────────────────────────────────────────────── */

/**
 * The one thing the old three screens could not answer between them: who can
 * open this lesson. Courses first, because that is how the centre sells and
 * schedules; named students second, for the make-up learner who is on none of
 * them.
 */
function AccessTab({
  courses,
  courseLabel,
  isFree,
  onFree,
  courseIds,
  onCourseIds,
  studentIds,
  onStudentIds,
}: {
  courses: Course[]
  courseLabel: (course: Course) => string
  isFree: boolean
  onFree: (value: boolean) => void
  courseIds: string[]
  onCourseIds: (value: string[]) => void
  studentIds: string[]
  onStudentIds: (value: string[]) => void
}) {
  const t = useTranslations('panel.online')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)

  const { data: found } = useQuery<Paginated<StudentRow>>(
    debounced.trim().length >= 2
      ? `/students?search=${encodeURIComponent(debounced.trim())}&limit=10`
      : null,
  )

  // The chips need names for ids that are not in the current search result.
  const { data: chosen } = useQuery<Paginated<StudentRow>>(
    studentIds.length > 0 ? `/students?ids=${studentIds.join(',')}&limit=100` : null,
  )

  const nameFor = useMemo(() => {
    const map = new Map<string, string>()
    for (const student of chosen?.items ?? []) map.set(student._id, student.fullName)
    for (const student of found?.items ?? []) map.set(student._id, student.fullName)
    return map
  }, [chosen, found])

  return (
    <div className="flex flex-col gap-5">
      <Checkbox label={t('free')} hint={t('freeHint')} checked={isFree} onChange={onFree} />

      {isFree ? (
        <p className="rounded-card border border-clay-500/30 bg-clay-500/5 p-4 text-2xs text-ink-soft dark:text-navy-200">
          {t('freeNote')}
        </p>
      ) : (
        <>
          <Field label={t('accessCourses')} hint={t('accessCoursesHint')}>
            {courses.length === 0 ? (
              <p className="text-2xs text-ink-muted">{t('noCourses')}</p>
            ) : (
              <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-input border border-border-subtle p-3">
                {courses.map((course) => (
                  <label
                    key={course._id}
                    className="flex items-center gap-2 text-xs text-ink dark:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={courseIds.includes(course._id)}
                      onChange={(event) =>
                        onCourseIds(
                          event.target.checked
                            ? [...courseIds, course._id]
                            : courseIds.filter((id) => id !== course._id),
                        )
                      }
                      className="size-4 rounded accent-navy-600"
                    />
                    {courseLabel(course)}
                  </label>
                ))}
              </div>
            )}
          </Field>

          <Field label={t('accessStudents')} hint={t('accessStudentsHint')}>
            <div className="flex flex-col gap-2">
              {studentIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {studentIds.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-pill bg-navy-50 px-2.5 py-1 text-2xs text-ink-soft dark:bg-navy-800 dark:text-navy-200"
                    >
                      <Users className="size-3" aria-hidden />
                      {nameFor.get(id) ?? id.slice(-6)}
                      <button
                        type="button"
                        aria-label={t('removeStudent')}
                        onClick={() => onStudentIds(studentIds.filter((value) => value !== id))}
                        className="text-ink-muted hover:text-danger"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('searchStudent')}
                className={INPUT}
              />

              {(found?.items?.length ?? 0) > 0 ? (
                <ul className="flex max-h-40 flex-col overflow-y-auto rounded-input border border-border-subtle">
                  {(found?.items ?? [])
                    .filter((student) => !studentIds.includes(student._id))
                    .map((student) => (
                      <li key={student._id}>
                        <button
                          type="button"
                          onClick={() => onStudentIds([...studentIds, student._id])}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-2xs text-ink-soft hover:bg-navy-50 dark:text-navy-200 dark:hover:bg-navy-800"
                        >
                          <span>{student.fullName}</span>
                          <Plus className="size-3.5 shrink-0" aria-hidden />
                        </button>
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          </Field>
        </>
      )}
    </div>
  )
}

/* ── Results ──────────────────────────────────────────────────────────── */

type AttemptRow = {
  _id: string
  student: { fullName?: string; phone?: string } | null
  score: number
  correct: number
  total: number
  passed: boolean
  submittedAt: string
}

function ResultsDialog({
  lesson,
  title,
  onClose,
}: {
  lesson: Lesson
  title: string
  onClose: () => void
}) {
  const t = useTranslations('panel.online')
  const { data, loading, error } = useQuery<AttemptRow[]>(
    `/online/admin/lessons/${lesson._id}/results`,
  )

  return (
    <Dialog title={t('resultsFor', { name: title })} onClose={onClose} wide>
      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.length === 0 ? <Empty title={t('noAttempts')} Icon={BarChart3} /> : null}

      {data && data.length > 0 ? (
        <TableShell>
          <thead>
            <tr>
              <Th>{t('student')}</Th>
              <Th className="text-right">{t('score')}</Th>
              <Th>{t('outcome')}</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((attempt) => (
              <tr key={attempt._id}>
                <Td className="text-xs text-ink dark:text-white">
                  {attempt.student?.fullName ?? '—'}
                </Td>
                <Td className="text-right font-mono tabular-nums text-2xs">
                  {attempt.score}% · {attempt.correct}/{attempt.total}
                </Td>
                <Td>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-2xs font-medium',
                      attempt.passed
                        ? 'bg-success/12 text-success'
                        : 'bg-danger/12 text-danger',
                    )}
                  >
                    {t(attempt.passed ? 'passed' : 'failed')}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : null}
    </Dialog>
  )
}

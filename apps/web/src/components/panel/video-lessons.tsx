'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Video, Play, CheckCircle2, Clock, X } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { useQuery, useMutation, mediaUrl } from '@/lib/api/use-api'
import { Loading, ErrorBox, Empty } from './primitives'
import { cn } from '@/lib/utils'

type Localized = { uz: string; ru?: string; en?: string }

type Lesson = {
  _id: string
  title: Localized
  description?: Localized
  provider: 'youtube' | 'vimeo' | 'file'
  videoId: string
  durationMinutes: number
  thumbnail?: string
  order: number
  isFree: boolean
  course: { _id: string; name: Localized; slug: string } | null
  progress: { seconds: number; completed: boolean } | null
}

/**
 * TZ §17.3 — the student's video lessons.
 *
 * The API already answers with only what this account may watch: their enrolled
 * courses' published lessons, plus anything marked free. So there is no
 * filtering here — a lesson that arrives is a lesson they may open.
 *
 * Grouped by course rather than listed flat, because a student in two courses
 * thinks in courses, and an ordered run of lessons is the thing they follow.
 */
export function VideoLessons() {
  const t = useTranslations('panel.videoLessons')
  const locale = useLocale() as Locale
  const [playing, setPlaying] = useState<Lesson | null>(null)

  const { data, loading, error, refetch } = useQuery<Lesson[]>('/content/lessons/mine')

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />
  if (!data || data.length === 0) return <Empty title={t('none')} Icon={Video} />

  const label = (value: Localized | undefined) => value?.[locale] || value?.uz || ''

  // Preserve the API's ordering (course, then lesson order) while grouping.
  const byCourse = new Map<string, { name: string; lessons: Lesson[] }>()
  for (const lesson of data) {
    const key = lesson.course?._id ?? 'free'
    const name = lesson.course ? label(lesson.course.name) : t('freeLessons')
    if (!byCourse.has(key)) byCourse.set(key, { name, lessons: [] })
    byCourse.get(key)!.lessons.push(lesson)
  }

  return (
    <div className="flex flex-col gap-8">
      {[...byCourse.entries()].map(([key, group]) => (
        <section key={key} className="flex flex-col gap-4">
          <header className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
            <h2 className="font-display text-sm text-ink dark:text-white">{group.name}</h2>
            <span className="text-2xs text-ink-muted">
              {t('progress', {
                done: group.lessons.filter((l) => l.progress?.completed).length,
                total: group.lessons.length,
              })}
            </span>
          </header>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.lessons.map((lesson) => {
              const done = lesson.progress?.completed
              return (
                <li key={lesson._id}>
                  <button
                    type="button"
                    onClick={() => setPlaying(lesson)}
                    className="group flex h-full w-full flex-col gap-3 rounded-card border border-border-subtle bg-surface p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-glaze-300 hover:shadow-float"
                  >
                    <span className="relative flex aspect-video items-center justify-center overflow-hidden rounded-input bg-navy-100 dark:bg-navy-800">
                      {lesson.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={lesson.thumbnail}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Video className="size-8 text-navy-400" aria-hidden />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-ink/30 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play className="size-8 text-white" aria-hidden />
                      </span>
                      {done ? (
                        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-pill bg-success px-2 py-0.5 text-2xs font-medium text-white">
                          <CheckCircle2 className="size-3" aria-hidden />
                          {t('watched')}
                        </span>
                      ) : null}
                    </span>

                    <span className="flex flex-1 flex-col gap-1">
                      <span className="text-xs font-medium text-ink dark:text-white">
                        {label(lesson.title)}
                      </span>
                      {lesson.description ? (
                        <span className="line-clamp-2 text-2xs text-ink-muted">
                          {label(lesson.description)}
                        </span>
                      ) : null}
                    </span>

                    {lesson.durationMinutes ? (
                      <span className="inline-flex items-center gap-1.5 text-2xs text-ink-muted">
                        <Clock className="size-3" aria-hidden />
                        {t('minutes', { n: lesson.durationMinutes })}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {playing ? (
        <Player
          lesson={playing}
          onClose={() => {
            setPlaying(null)
            void refetch()
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * The player.
 *
 * ⚠️ §18 asks that a video cannot be saved by right-click, `Ctrl+S`, devtools or
 * a downloader, and that a screen recording carries the viewer's name. None of
 * that is here — a YouTube or Vimeo embed is as protected as they make it, and
 * a `file` URL is a plain `<video>` a browser will happily download. See
 * docs/adr/0006-video-lessons-without-the-drm-layer.md before putting anything
 * the centre actually cares about behind this.
 */
function Player({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const t = useTranslations('panel.videoLessons')
  const locale = useLocale() as Locale
  const log = useMutation<{ seconds: number; completed: boolean }, unknown>(
    `/content/lessons/${lesson._id}/log`,
  )

  const label = (value: Localized | undefined) => value?.[locale] || value?.uz || ''

  const src =
    lesson.provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${lesson.videoId}?rel=0&modestbranding=1`
      : lesson.provider === 'vimeo'
        ? `https://player.vimeo.com/video/${lesson.videoId}`
        : mediaUrl(lesson.videoId)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label(lesson.title)}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-4xl flex-col gap-4 rounded-card bg-surface p-5 shadow-float"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-base text-ink dark:text-white">
              {label(lesson.title)}
            </h2>
            {lesson.course ? (
              <span className="text-2xs text-ink-muted">{label(lesson.course.name)}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="aspect-video overflow-hidden rounded-input bg-black">
          {lesson.provider === 'file' ? (
            <video
              src={src}
              controls
              controlsList="nodownload"
              disablePictureInPicture
              onContextMenu={(event) => event.preventDefault()}
              className="size-full"
              onTimeUpdate={(event) => {
                const el = event.currentTarget
                // One report per 30 seconds of playback, not per frame.
                if (Math.floor(el.currentTime) % 30 === 0 && el.currentTime > 0) {
                  void log.mutate({ seconds: Math.floor(el.currentTime), completed: false })
                }
              }}
              onEnded={(event) => {
                void log.mutate({
                  seconds: Math.floor(event.currentTarget.duration || 0),
                  completed: true,
                })
              }}
            />
          ) : (
            <iframe
              src={src}
              title={label(lesson.title)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="size-full border-0"
            />
          )}
        </div>

        {lesson.description ? (
          <p className="text-xs leading-relaxed text-ink-soft dark:text-navy-200">
            {label(lesson.description)}
          </p>
        ) : null}

        {/* An embed gives no playback events back, so completion is stated. */}
        {lesson.provider !== 'file' ? (
          <button
            type="button"
            disabled={log.pending || lesson.progress?.completed}
            onClick={async () => {
              await log.mutate({ seconds: lesson.durationMinutes * 60, completed: true })
              onClose()
            }}
            className={cn(
              'inline-flex h-12 items-center justify-center gap-2 rounded-pill text-xs font-medium transition-colors',
              lesson.progress?.completed
                ? 'border border-success/30 text-success'
                : 'bg-clay-500 text-white hover:bg-clay-400',
            )}
          >
            <CheckCircle2 className="size-4" aria-hidden />
            {t(lesson.progress?.completed ? 'watched' : 'markWatched')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

'use client'

import { useMemo, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  CheckCircle2,
  FileText,
  Music,
  Video as VideoIcon,
  X,
  FileCheck2,
  ArrowLeft,
} from 'lucide-react'
import { pick, type Locale, type Localized } from '@leader/shared/locales'
import { useQuery, useMutation, mediaUrl } from '@/lib/api/use-api'
import { useRouter, Link } from '@/i18n/navigation'
import { Panel, Loading, ErrorBox } from './primitives'
import { cn } from '@/lib/utils'

type Material = {
  key: string
  title: Localized
  type: 'pdf' | 'audio' | 'video'
  fileUrl: string
}

type Question = {
  key: string
  prompt: Localized
  options: { key: string; text: Localized }[]
}

type LessonView = {
  _id: string
  title: Localized
  description?: Localized
  order: number
  course: { _id: string; name: Localized } | null
  video: { provider: 'youtube' | 'vimeo' | 'file'; videoId: string; durationMinutes: number } | null
  materials: Material[]
  test: {
    passMark: number
    maxAttempts: number
    timeLimitMinutes: number
    attemptsUsed: number
    questions: Question[]
  } | null
  best: { score: number; passed: boolean; attemptId: string; submittedAt: string } | null
  progress: { seconds: number; completed: boolean } | null
}

const TYPE_ICONS = { pdf: FileText, audio: Music, video: VideoIcon } as const

/**
 * One online dars, end to end: watch it, read what came with it, then sit its
 * test — in that order, on one screen, because that is the order the lesson is
 * meant to be taken in. Splitting these across three sections of the panel was
 * the thing that made an "online lesson" feel like three unrelated errands.
 */
export function OnlineLessonView({ lessonId }: { lessonId: string }) {
  const t = useTranslations('panel.onlineStudent')
  const locale = useLocale() as Locale
  const [reading, setReading] = useState<Material | null>(null)
  const [sitting, setSitting] = useState(false)

  const { data, loading, error, refetch } = useQuery<LessonView>(`/online/lessons/${lessonId}`)

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />
  if (!data) return null

  const attemptsLeft =
    data.test && data.test.maxAttempts > 0
      ? Math.max(0, data.test.maxAttempts - data.test.attemptsUsed)
      : null

  if (sitting && data.test) {
    return (
      <TestRun
        lessonId={data._id}
        questions={data.test.questions}
        onCancel={() => setSitting(false)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/cabinet/online"
        className="inline-flex w-fit items-center gap-1.5 text-2xs text-ink-muted hover:text-navy-700 dark:hover:text-white"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t('backToList')}
      </Link>

      {data.video ? (
        <Player lesson={data} onLogged={() => void refetch()} />
      ) : null}

      {data.description ? (
        <p className="text-xs leading-relaxed text-ink-soft dark:text-navy-200">
          {pick(data.description, locale)}
        </p>
      ) : null}

      {data.materials.length > 0 ? (
        <Panel title={t('materials')}>
          <ul className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.materials.map((material) => {
              const Icon = TYPE_ICONS[material.type]
              return (
                <li key={material.key}>
                  <button
                    type="button"
                    onClick={() => setReading(material)}
                    className="group flex h-full w-full items-center gap-3 rounded-card border border-border-subtle p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-glaze-300 hover:shadow-float"
                  >
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-input bg-navy-100 dark:bg-navy-800">
                      <Icon className="size-5 text-navy-400" aria-hidden />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-ink dark:text-white">
                        {pick(material.title, locale)}
                      </span>
                      <span className="text-2xs text-ink-muted">{t(`types.${material.type}`)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>
      ) : null}

      {data.test ? (
        <Panel title={t('test')}>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap gap-4 text-2xs text-ink-muted">
              <span>{t('questions', { n: data.test.questions.length })}</span>
              <span>{t('passMark', { n: data.test.passMark })}</span>
              {data.test.timeLimitMinutes > 0 ? (
                <span>{t('timeLimit', { n: data.test.timeLimitMinutes })}</span>
              ) : null}
              {attemptsLeft !== null ? <span>{t('attemptsLeft', { n: attemptsLeft })}</span> : null}
            </div>

            {data.best ? (
              <div
                className={cn(
                  'flex flex-wrap items-center justify-between gap-3 rounded-input border p-4 text-2xs',
                  data.best.passed
                    ? 'border-success/30 bg-success/5 text-success'
                    : 'border-danger/30 bg-danger/5 text-danger',
                )}
              >
                <span>{t('bestScore', { n: data.best.score })}</span>
                <Link
                  href={`/cabinet/attempts/${data.best.attemptId}`}
                  className="underline underline-offset-4"
                >
                  {t('reviewAttempt')}
                </Link>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setSitting(true)}
              disabled={attemptsLeft === 0}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-pill bg-clay-500 px-6 text-xs font-medium text-white transition-colors hover:bg-clay-400 disabled:opacity-50"
            >
              <FileCheck2 className="size-4" aria-hidden />
              {t(data.best ? 'retakeTest' : 'startTest')}
            </button>
          </div>
        </Panel>
      ) : null}

      {reading ? (
        <Reader
          material={reading}
          label={pick(reading.title, locale)}
          onClose={() => setReading(null)}
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
 * docs/adr/0006-video-lessons-without-the-drm-layer.md.
 */
function Player({ lesson, onLogged }: { lesson: LessonView; onLogged: () => void }) {
  const t = useTranslations('panel.onlineStudent')
  const locale = useLocale() as Locale
  const log = useMutation<{ seconds: number; completed: boolean }, unknown>(
    `/online/lessons/${lesson._id}/log`,
  )

  const video = lesson.video!
  const src =
    video.provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0&modestbranding=1`
      : video.provider === 'vimeo'
        ? `https://player.vimeo.com/video/${video.videoId}`
        : mediaUrl(video.videoId)

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-video overflow-hidden rounded-card bg-black">
        {video.provider === 'file' ? (
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
              void log
                .mutate({
                  seconds: Math.floor(event.currentTarget.duration || 0),
                  completed: true,
                })
                .then(onLogged)
            }}
          />
        ) : (
          <iframe
            src={src}
            title={pick(lesson.title, locale)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="size-full border-0"
          />
        )}
      </div>

      {/* An embed gives no playback events back, so completion is stated. */}
      {video.provider !== 'file' ? (
        <button
          type="button"
          disabled={log.pending || lesson.progress?.completed}
          onClick={async () => {
            await log.mutate({ seconds: video.durationMinutes * 60, completed: true })
            onLogged()
          }}
          className={cn(
            'inline-flex h-11 w-fit items-center gap-2 rounded-pill px-5 text-2xs font-medium transition-colors',
            lesson.progress?.completed
              ? 'border border-success/30 text-success'
              : 'bg-navy-600 text-white hover:bg-navy-700',
          )}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          {t(lesson.progress?.completed ? 'watched' : 'markWatched')}
        </button>
      ) : null}
    </div>
  )
}

function Reader({
  material,
  label,
  onClose,
}: {
  material: Material
  label: string
  onClose: () => void
}) {
  const t = useTranslations('panel.onlineStudent')
  const src = mediaUrl(material.fileUrl)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'flex w-full flex-col gap-4 rounded-card bg-surface p-5 shadow-float',
          material.type === 'pdf' ? 'max-w-5xl' : 'max-w-4xl',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-base text-ink dark:text-white">{label}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {material.type === 'pdf' ? (
          <iframe src={src} title={label} className="h-[70vh] w-full rounded-input border-0" />
        ) : material.type === 'audio' ? (
          <audio src={src} controls className="w-full" controlsList="nodownload" />
        ) : (
          <video
            src={src}
            controls
            controlsList="nodownload"
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
            className="aspect-video w-full rounded-input bg-black"
          />
        )}
      </div>
    </div>
  )
}

/**
 * Sitting the test — one question at a time rather than a long scroll: it keeps
 * the choice the only thing on screen, and it makes progress legible on a
 * phone, which is where an online student actually is.
 *
 * The payload that renders this never contains the answer key — the API strips
 * it — so nothing here could reveal the answers even if it tried.
 */
function TestRun({
  lessonId,
  questions,
  onCancel,
}: {
  lessonId: string
  questions: Question[]
  onCancel: () => void
}) {
  const t = useTranslations('panel.onlineStudent')
  const locale = useLocale() as Locale
  const router = useRouter()
  const reduceMotion = useReducedMotion()

  const { mutate, pending, error } = useMutation<
    { answers: { questionKey: string; chosenKey: string | null }[]; startedAt: string },
    { attemptId: string }
  >(`/online/lessons/${lessonId}/submit`)

  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<Record<string, string>>({})
  /** Which way the card should fly, so motion matches the button pressed. */
  const [direction, setDirection] = useState(1)
  const startedAt = useRef(new Date().toISOString())

  const current = questions[index]
  const answeredCount = useMemo(() => Object.keys(chosen).length, [chosen])

  if (!current) return null
  const isLast = index === questions.length - 1

  const go = (delta: number) => {
    setDirection(delta)
    setIndex((value) => Math.min(Math.max(value + delta, 0), questions.length - 1))
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex w-fit items-center gap-1.5 text-2xs text-ink-muted hover:text-navy-700 dark:hover:text-white"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t('backToLesson')}
      </button>

      <div className="flex items-center gap-4">
        <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-navy-50 dark:bg-navy-800">
          <motion.span
            className="gradient-glaze block h-full rounded-pill"
            animate={{ scaleX: (index + 1) / questions.length }}
            style={{ transformOrigin: 'left' }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          />
        </span>
        <span className="shrink-0 font-mono text-2xs text-ink-muted">
          {index + 1} / {questions.length}
        </span>
      </div>

      <Panel>
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={current.key}
              custom={direction}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -32 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-5 p-6"
            >
              <p className="font-display text-base leading-snug tracking-[-0.01em] text-ink dark:text-white">
                {pick(current.prompt, locale)}
              </p>

              <ul className="flex flex-col gap-2.5" role="radiogroup">
                {current.options.map((option) => {
                  const selected = chosen[current.key] === option.key
                  return (
                    <li key={option.key}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          setChosen((value) => ({ ...value, [current.key]: option.key }))
                        }
                        className={cn(
                          'flex w-full items-center gap-3 rounded-input border p-4 text-left text-sm transition-[background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.99]',
                          selected
                            ? 'border-glaze-500 bg-glaze-50 text-ink dark:bg-navy-800 dark:text-white'
                            : 'border-border-subtle hover:border-navy-600/40 dark:text-navy-100',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
                            selected ? 'border-glaze-600' : 'border-navy-300',
                          )}
                        >
                          {selected ? (
                            <motion.span
                              layoutId={`dot-${current.key}`}
                              className="block size-2.5 rounded-full bg-glaze-600"
                              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            />
                          ) : null}
                        </span>
                        {pick(option.text, locale)}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </Panel>

      {error ? <ErrorBox code={error.code} message={error.message} /> : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="inline-flex h-12 items-center gap-2 rounded-pill border border-navy-600/25 px-5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 disabled:opacity-40 dark:text-navy-100 dark:hover:bg-navy-800"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t('back')}
        </button>

        <span className="text-2xs text-ink-muted">
          {t('answered', { done: answeredCount, total: questions.length })}
        </span>

        {isLast ? (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              const result = await mutate({
                answers: questions.map((question) => ({
                  questionKey: question.key,
                  chosenKey: chosen[question.key] ?? null,
                })),
                startedAt: startedAt.current,
              })
              if (result) router.replace(`/cabinet/attempts/${result.attemptId}`)
            }}
            className="inline-flex h-12 items-center gap-2 rounded-pill bg-clay-500 px-6 text-xs font-medium text-white transition-[background-color,transform] duration-200 hover:bg-clay-400 active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {t('submit')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(1)}
            className="inline-flex h-12 items-center gap-2 rounded-pill bg-navy-600 px-6 text-xs font-medium text-white transition-[background-color,transform] duration-200 hover:bg-navy-700 active:scale-[0.98]"
          >
            {t('next')}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

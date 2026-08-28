'use client'

import { useTranslations, useLocale } from 'next-intl'
import { motion, useReducedMotion } from 'motion/react'
import {
  MonitorPlay,
  Lock,
  Check,
  Play,
  Clock,
  Paperclip,
  FileCheck2,
  RotateCcw,
} from 'lucide-react'
import { pick, type Locale, type Localized } from '@leader/shared/locales'
import { useQuery } from '@/lib/api/use-api'
import { Link } from '@/i18n/navigation'
import { Loading, ErrorBox, Empty } from './primitives'
import { cn } from '@/lib/utils'

type LessonRow = {
  _id: string
  title: Localized
  description?: Localized
  order: number
  course: { _id: string; name: Localized } | null
  hasVideo: boolean
  durationMinutes: number
  thumbnail?: string
  materialCount: number
  questionCount: number
  passMark: number
  unlocked: boolean
  best: { score: number; passed: boolean; attemptId: string; submittedAt: string } | null
  attemptsUsed: number
  watched: boolean
}

/**
 * The student's online darslar.
 *
 * The API answers with only what this account may open, so there is no
 * filtering here — a lesson that arrives is a lesson they are allowed.
 *
 * Drawn as a *chain* per course rather than as scattered cards: a rail runs
 * down the list and fills in as far as the student has got, so the shape of the
 * page answers "where am I up to?" before any text is read. The lock is real —
 * a lesson whose predecessor carried an unpassed test will not open on the API
 * either.
 */
export function OnlineLessons() {
  const t = useTranslations('panel.onlineStudent')
  const locale = useLocale() as Locale
  const reduceMotion = useReducedMotion()

  const { data, loading, error } = useQuery<LessonRow[]>('/online/lessons/mine')

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />
  if (!data || data.length === 0) return <Empty title={t('none')} Icon={MonitorPlay} />

  // Preserve the API's ordering (course, then lesson order) while grouping.
  const byCourse = new Map<string, { name: string; lessons: LessonRow[] }>()
  for (const lesson of data) {
    const key = lesson.course?._id ?? 'free'
    const name = lesson.course ? pick(lesson.course.name, locale) : t('freeLessons')
    if (!byCourse.has(key)) byCourse.set(key, { name, lessons: [] })
    byCourse.get(key)!.lessons.push(lesson)
  }

  return (
    <div className="flex flex-col gap-10">
      {[...byCourse.entries()].map(([key, group]) => {
        const done = group.lessons.filter(
          (lesson) => lesson.best?.passed || (lesson.questionCount === 0 && lesson.watched),
        ).length

        return (
          <section key={key} className="flex flex-col gap-5">
            <header className="flex flex-wrap items-center gap-4 border-b border-border-subtle pb-2">
              <h2 className="font-display text-sm text-ink dark:text-white">{group.name}</h2>
              <span className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-pill bg-navy-50 dark:bg-navy-800">
                <motion.span
                  className="gradient-glaze block h-full rounded-pill"
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: done / group.lessons.length }}
                  style={{ transformOrigin: 'left' }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span className="shrink-0 font-mono text-2xs text-ink-muted">
                {t('progress', { done, total: group.lessons.length })}
              </span>
            </header>

            <ol className="flex flex-col">
              {group.lessons.map((lesson, index) => (
                <LessonRowCard
                  key={lesson._id}
                  lesson={lesson}
                  index={index}
                  last={index === group.lessons.length - 1}
                />
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

function LessonRowCard({
  lesson,
  index,
  last,
}: {
  lesson: LessonRow
  index: number
  last: boolean
}) {
  const t = useTranslations('panel.onlineStudent')
  const locale = useLocale() as Locale

  const passed = lesson.best?.passed ?? false
  const complete = passed || (lesson.questionCount === 0 && lesson.watched)

  const marker = !lesson.unlocked ? (
    <Lock className="size-4" aria-hidden />
  ) : complete ? (
    <Check className="size-4" aria-hidden />
  ) : (
    <span className="font-mono text-2xs">{index + 1}</span>
  )

  const body = (
    <div
      className={cn(
        'flex flex-1 flex-col gap-2 rounded-card border p-4 transition-all duration-200',
        lesson.unlocked
          ? 'border-border-subtle bg-surface hover:-translate-y-0.5 hover:border-glaze-300 hover:shadow-float'
          : 'border-dashed border-border-subtle bg-surface/40',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span
          className={cn(
            'text-xs font-medium',
            lesson.unlocked ? 'text-ink dark:text-white' : 'text-ink-muted',
          )}
        >
          {pick(lesson.title, locale)}
        </span>
        {lesson.best ? (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-1 text-2xs font-medium',
              passed ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger',
            )}
          >
            {passed ? (
              <Check className="size-3" aria-hidden />
            ) : (
              <RotateCcw className="size-3" aria-hidden />
            )}
            {lesson.best.score}%
          </span>
        ) : null}
      </div>

      {lesson.description ? (
        <p className="line-clamp-2 text-2xs text-ink-muted">{pick(lesson.description, locale)}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-2xs text-ink-muted">
        {lesson.hasVideo ? (
          <span className="inline-flex items-center gap-1.5">
            <Play className="size-3" aria-hidden />
            {t('video')}
            {lesson.durationMinutes
              ? ` · ${t('minutes', { n: lesson.durationMinutes })}`
              : ''}
          </span>
        ) : null}
        {lesson.questionCount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <FileCheck2 className="size-3" aria-hidden />
            {t('questions', { n: lesson.questionCount })}
          </span>
        ) : null}
        {lesson.materialCount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Paperclip className="size-3" aria-hidden />
            {t('files', { n: lesson.materialCount })}
          </span>
        ) : null}
        {!lesson.unlocked ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3" aria-hidden />
            {t('locked')}
          </span>
        ) : null}
      </div>
    </div>
  )

  return (
    <li className="flex gap-4">
      {/* The rail: filled as far as the student has got. */}
      <span className="flex flex-col items-center">
        <span
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-pill border',
            complete
              ? 'border-success bg-success/12 text-success'
              : lesson.unlocked
                ? 'border-glaze-500 bg-glaze-50 text-glaze-700 dark:bg-navy-800 dark:text-glaze-300'
                : 'border-border-subtle text-ink-muted',
          )}
        >
          {marker}
        </span>
        {!last ? (
          <span
            aria-hidden
            className={cn(
              'w-px flex-1',
              complete ? 'bg-success/40' : 'bg-border-subtle',
            )}
          />
        ) : null}
      </span>

      <div className={cn('flex flex-1', last ? 'pb-0' : 'pb-4')}>
        {lesson.unlocked ? (
          <Link href={`/cabinet/online/${lesson._id}`} className="flex flex-1">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>
    </li>
  )
}

'use client'

import { useTranslations, useLocale } from 'next-intl'
import { motion, useReducedMotion } from 'motion/react'
import { Lock, Check, RotateCcw, Play, BookOpen } from 'lucide-react'
import { pick, type Locale, type Localized } from '@leader/shared/locales'
import { useQuery } from '@/lib/api/use-api'
import { Link } from '@/i18n/navigation'
import { Loading, ErrorBox, Empty } from './primitives'
import { cn } from '@/lib/utils'

type ModuleRow = {
  _id: string
  title: Localized
  description?: Localized
  order: number
  passMark: number
  questionCount: number
  maxAttempts: number
  unlocked: boolean
  best: { score: number; passed: boolean; attemptId: string; submittedAt: string } | null
  attemptsUsed: number
}

/**
 * The online course: an ordered chain of modules where the next one opens only
 * once this one is passed.
 *
 * The lock is drawn as a *chain* rather than as scattered padlocks — a
 * connecting rail runs down the list and fills in as far as the student has
 * got, so the shape of the page answers "where am I up to?" before any text is
 * read. Numbered markers are used here because this genuinely is a sequence.
 */
export function ModuleList({ courseId }: { courseId: string }) {
  const t = useTranslations('panel.tests')
  const locale = useLocale() as Locale
  const reduceMotion = useReducedMotion()

  const { data, loading, error } = useQuery<ModuleRow[]>(`/tests/courses/${courseId}/modules`)

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />
  if (!data || data.length === 0) return <Empty title={t('noModules')} Icon={BookOpen} />

  const passedCount = data.filter((module) => module.best?.passed).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="h-2 flex-1 overflow-hidden rounded-pill bg-navy-50 dark:bg-navy-800">
          <motion.span
            className="gradient-glaze block h-full rounded-pill"
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: passedCount / data.length }}
            style={{ transformOrigin: 'left' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
        <span className="shrink-0 font-mono text-2xs text-ink-muted">
          {t('progress', { done: passedCount, total: data.length })}
        </span>
      </div>

      <ol className="relative flex flex-col gap-3">
        {data.map((module, index) => {
          const state = module.best?.passed
            ? 'passed'
            : module.unlocked
              ? 'open'
              : 'locked'

          const outOfAttempts =
            module.maxAttempts > 0 && module.attemptsUsed >= module.maxAttempts

          const body = (
            <>
              {/* The chain rail, drawn between markers rather than on them. */}
              {index < data.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[2.15rem] top-[3.6rem] h-[calc(100%-2.4rem)] w-px',
                    state === 'passed' ? 'bg-glaze-400' : 'bg-border-subtle',
                  )}
                />
              ) : null}

              <span
                className={cn(
                  'relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-pill font-display text-sm font-semibold transition-colors duration-200',
                  state === 'passed' && 'gradient-glaze text-white',
                  state === 'open' && 'border-2 border-glaze-500 bg-surface text-glaze-700',
                  state === 'locked' && 'border border-border-subtle bg-surface text-ink-muted',
                )}
              >
                {state === 'passed' ? (
                  <Check className="size-5" aria-hidden />
                ) : state === 'locked' ? (
                  <Lock className="size-4" aria-hidden />
                ) : (
                  module.order
                )}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={cn(
                    'font-display text-sm tracking-[-0.01em]',
                    state === 'locked' ? 'text-ink-muted' : 'text-ink dark:text-white',
                  )}
                >
                  {pick(module.title, locale)}
                </span>
                <span className="text-2xs text-ink-muted">
                  {t('questions', { n: module.questionCount })} · {t('pass', { n: module.passMark })}
                  {module.best ? ` · ${t('best', { n: module.best.score })}` : ''}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-2">
                {module.best ? (
                  <span
                    className={cn(
                      'rounded-pill px-3 py-1.5 font-mono text-2xs font-medium',
                      module.best.passed
                        ? 'bg-success/12 text-success'
                        : 'bg-danger/12 text-danger',
                    )}
                  >
                    {module.best.score}%
                  </span>
                ) : null}

                {state !== 'locked' ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-2xs font-medium',
                      module.best?.passed
                        ? 'text-glaze-700 dark:text-glaze-300'
                        : 'bg-clay-500 text-white',
                    )}
                  >
                    {module.best?.passed ? (
                      <>
                        <RotateCcw className="size-3.5" aria-hidden />
                        {t('review')}
                      </>
                    ) : (
                      <>
                        <Play className="size-3.5" aria-hidden />
                        {module.attemptsUsed > 0 ? t('retry') : t('start')}
                      </>
                    )}
                  </span>
                ) : null}
              </span>
            </>
          )

          const className = cn(
            'relative flex items-center gap-4 rounded-card border p-4 transition-all duration-200',
            state === 'locked'
              ? 'cursor-not-allowed border-dashed border-border-subtle bg-surface/40'
              : 'border-border-subtle bg-surface hover:-translate-y-0.5 hover:border-glaze-300 hover:shadow-raise',
          )

          return (
            <motion.li
              key={module._id}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                // 40 ms per row, capped so a long course does not crawl in.
                delay: Math.min(index, 6) * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {state === 'locked' ? (
                <div className={className} aria-disabled>
                  {body}
                </div>
              ) : outOfAttempts && !module.best?.passed ? (
                <div className={className} aria-disabled>
                  {body}
                </div>
              ) : (
                <Link
                  href={
                    module.best?.passed
                      ? `/cabinet/attempts/${module.best.attemptId}`
                      : `/cabinet/tests/${module._id}`
                  }
                  className={className}
                >
                  {body}
                </Link>
              )}
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}

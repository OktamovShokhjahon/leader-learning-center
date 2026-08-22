'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Check, X, ChevronDown, Trophy, RotateCcw } from 'lucide-react'
import { pick, type Locale, type Localized } from '@leader/shared/locales'
import { useQuery } from '@/lib/api/use-api'
import { Link } from '@/i18n/navigation'
import { Panel, Loading, ErrorBox } from './primitives'
import { cn } from '@/lib/utils'

type ReviewQuestion = {
  key: string
  prompt?: Localized
  options: { key: string; text: Localized }[]
  chosenKey: string | null
  correctKey: string
  isCorrect: boolean
  explanation?: Localized
}

type Review = {
  attempt: {
    _id: string
    score: number
    correct: number
    total: number
    passMark: number
    passed: boolean
    submittedAt: string
  }
  module: { _id: string; title: Localized; order: number }
  questions: ReviewQuestion[]
}

/**
 * The result, and the review behind it.
 *
 * The client's brief, exactly: correct answers green, wrong ones red, and
 * clicking one opens the question with the right answer shown against what was
 * chosen.
 *
 * The grid of squares comes first because it answers "how did I do?" at a
 * glance; the detail is one tap away rather than a wall of text.
 */
export function AttemptReview({ attemptId }: { attemptId: string }) {
  const t = useTranslations('panel.tests')
  const locale = useLocale() as Locale
  const reduceMotion = useReducedMotion()
  const [openKey, setOpenKey] = useState<string | null>(null)

  const { data, loading, error } = useQuery<Review>(`/tests/attempts/${attemptId}`)

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />
  if (!data) return null

  const { attempt, module, questions } = data

  return (
    <div className="flex flex-col gap-6">
      {/* The verdict */}
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'panel-frame-ink flex flex-col items-center gap-3 rounded-card p-8 text-center',
          attempt.passed ? 'bg-success/8' : 'bg-danger/8',
        )}
      >
        <span
          className={cn(
            'inline-flex size-16 items-center justify-center rounded-pill',
            attempt.passed ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
          )}
        >
          {attempt.passed ? (
            <Trophy className="size-8" aria-hidden />
          ) : (
            <RotateCcw className="size-8" aria-hidden />
          )}
        </span>

        {/* Counts up so the number lands rather than appearing. */}
        <motion.span
          className={cn(
            'font-display text-4xl font-semibold tabular-nums tracking-[-0.03em]',
            attempt.passed ? 'text-success' : 'text-danger',
          )}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {attempt.score}%
        </motion.span>

        <p className="font-display text-base text-ink dark:text-white">
          {attempt.passed ? t('passedTitle') : t('failedTitle')}
        </p>
        <p className="text-xs text-ink-soft dark:text-navy-200">
          {t('scoreDetail', {
            correct: attempt.correct,
            total: attempt.total,
            pass: attempt.passMark,
          })}
        </p>

        {!attempt.passed ? (
          <Link
            href={`/cabinet/tests/${module._id}`}
            className="mt-2 inline-flex h-12 items-center gap-2 rounded-pill bg-clay-500 px-6 text-xs font-medium text-white transition-colors hover:bg-clay-400"
          >
            <RotateCcw className="size-4" aria-hidden />
            {t('retry')}
          </Link>
        ) : (
          <p className="mt-1 text-2xs text-success">{t('nextUnlocked')}</p>
        )}
      </motion.div>

      {/* The answer grid — green right, red wrong, tap to open. */}
      <Panel title={t('answers')}>
        <div className="flex flex-wrap gap-2 p-5">
          {questions.map((question, index) => (
            <motion.button
              key={question.key}
              type="button"
              onClick={() => setOpenKey(openKey === question.key ? null : question.key)}
              aria-expanded={openKey === question.key}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: Math.min(index, 12) * 0.03,
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-input font-mono text-xs font-medium transition-[background-color,transform] duration-200 hover:scale-105 active:scale-95',
                question.isCorrect
                  ? 'bg-success/15 text-success hover:bg-success/25'
                  : 'bg-danger/15 text-danger hover:bg-danger/25',
                openKey === question.key && 'ring-2 ring-offset-2 ring-offset-surface',
                openKey === question.key &&
                  (question.isCorrect ? 'ring-success' : 'ring-danger'),
              )}
            >
              {index + 1}
            </motion.button>
          ))}
        </div>

        {/* The opened question, expanding from the grid rather than a modal. */}
        <AnimatePresence initial={false}>
          {openKey
            ? (() => {
                const question = questions.find((entry) => entry.key === openKey)
                if (!question) return null
                const number = questions.findIndex((entry) => entry.key === openKey) + 1

                return (
                  <motion.div
                    key={openKey}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden border-t border-border-subtle"
                  >
                    <div className="flex flex-col gap-4 p-6">
                      <p className="flex items-start gap-3 font-display text-sm leading-snug text-ink dark:text-white">
                        <span
                          className={cn(
                            'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-pill font-mono text-2xs',
                            question.isCorrect
                              ? 'bg-success/15 text-success'
                              : 'bg-danger/15 text-danger',
                          )}
                        >
                          {number}
                        </span>
                        {question.prompt ? pick(question.prompt, locale) : ''}
                      </p>

                      <ul className="flex flex-col gap-2">
                        {question.options.map((option) => {
                          const isCorrect = option.key === question.correctKey
                          const isChosen = option.key === question.chosenKey
                          const isWrongChoice = isChosen && !isCorrect

                          return (
                            <li
                              key={option.key}
                              className={cn(
                                'flex items-center gap-3 rounded-input border p-3.5 text-sm',
                                isCorrect && 'border-success/40 bg-success/8 text-success',
                                isWrongChoice && 'border-danger/40 bg-danger/8 text-danger',
                                !isCorrect &&
                                  !isWrongChoice &&
                                  'border-border-subtle text-ink-soft dark:text-navy-200',
                              )}
                            >
                              <span className="inline-flex size-5 shrink-0 items-center justify-center">
                                {isCorrect ? (
                                  <Check className="size-4" aria-hidden />
                                ) : isWrongChoice ? (
                                  <X className="size-4" aria-hidden />
                                ) : null}
                              </span>
                              <span className="flex-1">{pick(option.text, locale)}</span>
                              {isChosen ? (
                                <span className="shrink-0 rounded-pill bg-ink/8 px-2 py-0.5 text-2xs">
                                  {t('yourAnswer')}
                                </span>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>

                      {question.chosenKey === null ? (
                        <p className="text-2xs text-ink-muted">{t('notAnswered')}</p>
                      ) : null}

                      {question.explanation ? (
                        <p className="rounded-input border border-info/30 bg-info/5 p-4 text-xs leading-relaxed text-ink-soft dark:text-navy-200">
                          {pick(question.explanation, locale)}
                        </p>
                      ) : null}
                    </div>
                  </motion.div>
                )
              })()
            : null}
        </AnimatePresence>

        {!openKey ? (
          <p className="flex items-center justify-center gap-1.5 border-t border-border-subtle px-5 py-4 text-2xs text-ink-muted">
            <ChevronDown className="size-3.5" aria-hidden />
            {t('tapToReview')}
          </p>
        ) : null}
      </Panel>
    </div>
  )
}

'use client'

import { useMemo, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, Send, Loader2 } from 'lucide-react'
import { pick, type Locale, type Localized } from '@leader/shared/locales'
import { useQuery, useMutation } from '@/lib/api/use-api'
import { useRouter } from '@/i18n/navigation'
import { Panel, Loading, ErrorBox } from './primitives'
import { cn } from '@/lib/utils'

type Question = {
  key: string
  prompt: Localized
  options: { key: string; text: Localized }[]
}

type TestView = {
  _id: string
  title: Localized
  order: number
  passMark: number
  questions: Question[]
}

/**
 * Sitting the test.
 *
 * One question at a time rather than a long scroll: it keeps the choice the
 * only thing on screen, and it makes progress legible on a phone, which is
 * where an online student actually is.
 *
 * The payload that renders this never contains the answer key — the API strips
 * it — so nothing here could reveal the answers even if it tried.
 */
export function TestRunner({ moduleId }: { moduleId: string }) {
  const t = useTranslations('panel.tests')
  const locale = useLocale() as Locale
  const router = useRouter()
  const reduceMotion = useReducedMotion()

  const { data, loading, error } = useQuery<TestView>(`/tests/modules/${moduleId}`)
  const { mutate, pending, error: submitError } = useMutation<
    { answers: { questionKey: string; chosenKey: string | null }[]; startedAt: string },
    { attemptId: string }
  >(`/tests/modules/${moduleId}/submit`)

  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<Record<string, string>>({})
  /** Which way the card should fly, so motion matches the button pressed. */
  const [direction, setDirection] = useState(1)
  const startedAt = useRef(new Date().toISOString())

  const questions = data?.questions ?? []
  const current = questions[index]
  const answeredCount = useMemo(() => Object.keys(chosen).length, [chosen])

  const go = (delta: number) => {
    setDirection(delta)
    setIndex((value) => Math.min(Math.max(value + delta, 0), questions.length - 1))
  }

  const submit = async () => {
    const result = await mutate({
      answers: questions.map((question) => ({
        questionKey: question.key,
        chosenKey: chosen[question.key] ?? null,
      })),
      startedAt: startedAt.current,
    })
    if (result) router.replace(`/cabinet/attempts/${result.attemptId}`)
  }

  if (loading) return <Loading />
  if (error) return <ErrorBox code={error.code} message={error.message} />
  if (!data || !current) return null

  const isLast = index === questions.length - 1

  return (
    <div className="flex flex-col gap-5">
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
        {/*
          The card slides in the direction of travel — forward from the right,
          back from the left — so moving through the test keeps its spatial
          sense. `mode="wait"` avoids two cards overlapping mid-swap.
        */}
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

      {submitError ? <ErrorBox code={submitError.code} message={submitError.message} /> : null}

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
            onClick={submit}
            disabled={pending}
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

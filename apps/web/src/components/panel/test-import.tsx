'use client'

import { useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Upload, FileText, Check, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import {
  parseGiftText,
  parseSheetRows,
  toLocalizedQuestions,
  type ParsedQuestion,
  type ParseIssue,
} from '@leader/shared'
import type { Locale } from '@leader/shared/locales'
import { useMutation, useQuery } from '@/lib/api/use-api'
import { useRouter } from '@/i18n/navigation'
import { Panel, ErrorBox } from './primitives'
import { Field, inputClass } from '@/components/site/form-field'
import { cn } from '@/lib/utils'

type Course = { _id: string; name?: { uz?: string } }

/**
 * Uploading a test from a file the teacher already has.
 *
 * Parsing happens in the browser, using the same parser the tests cover, so the
 * teacher sees exactly what will be created *before* anything is saved — a
 * mis-keyed question is caught here rather than after thirty students have sat
 * the test. Only the parsed result is sent; there is no file upload endpoint
 * and therefore no upload to sanitise.
 *
 * Reaching this screen at all requires `test.manage`, which is SuperAdmin and
 * Teacher only. The API enforces it again on submit (§4.3).
 */
export function TestImport() {
  const t = useTranslations('panel.import')
  const locale = useLocale() as Locale
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [questions, setQuestions] = useState<ParsedQuestion[]>([])
  const [issues, setIssues] = useState<ParseIssue[]>([])
  const [dragging, setDragging] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [order, setOrder] = useState('1')
  const [passMark, setPassMark] = useState('70')

  const courses = useQuery<{ items: Course[] } | Course[]>('/groups/catalog/courses')
  const courseList = Array.isArray(courses.data) ? courses.data : (courses.data?.items ?? [])

  const create = useMutation<Record<string, unknown>, { _id: string }>('/tests/modules')

  const ingest = async (file: File) => {
    setParseError(null)
    setFileName(file.name)

    try {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        // SheetJS is only needed for a spreadsheet, so it is loaded on demand
        // rather than shipped to every teacher who pastes text.
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) throw new Error('empty workbook')
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]!, {
          header: 1,
          blankrows: false,
          defval: '',
        })
        const result = parseSheetRows(
          (rows as unknown[][]).map((row) => row.map((cell) => String(cell ?? ''))),
        )
        setQuestions(result.questions)
        setIssues(result.issues)
      } else {
        const result = parseGiftText(await file.text())
        setQuestions(result.questions)
        setIssues(result.issues)
      }

      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
    } catch {
      setParseError(t('unreadable'))
      setQuestions([])
      setIssues([])
    }
  }

  const save = async () => {
    const result = await create.mutate({
      courseId,
      title: { uz: title },
      order: Number(order),
      passMark: Number(passMark),
      questions: toLocalizedQuestions(questions, locale),
      isPublished: true,
    })
    if (result) router.replace('/crm/tests')
  }

  const ready = questions.length > 0 && courseId && title.trim() && issues.length === 0

  return (
    <div className="flex flex-col gap-5">
      {/* The drop zone */}
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files[0]
          if (file) void ingest(file)
        }}
        className={cn(
          'flex flex-col items-center gap-3 rounded-card border-2 border-dashed p-10 text-center transition-colors duration-200',
          dragging
            ? 'border-glaze-500 bg-glaze-50/60 dark:bg-navy-800/60'
            : 'border-border-subtle bg-surface/50',
        )}
      >
        <motion.span
          animate={dragging && !reduceMotion ? { scale: 1.08 } : { scale: 1 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex size-14 items-center justify-center rounded-pill bg-glaze-50 text-glaze-700 dark:bg-navy-800 dark:text-glaze-300"
        >
          <Upload className="size-6" aria-hidden />
        </motion.span>

        <p className="font-display text-base text-ink dark:text-white">{t('dropTitle')}</p>
        <p className="max-w-md text-xs leading-relaxed text-ink-soft dark:text-navy-200">
          {t('dropHint')}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".txt,.xlsx,.xls"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void ingest(file)
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-1 inline-flex h-12 items-center gap-2 rounded-pill bg-navy-600 px-6 text-xs font-medium text-white transition-colors hover:bg-navy-700"
        >
          <FileText className="size-4" aria-hidden />
          {t('choose')}
        </button>
      </div>

      {parseError ? <ErrorBox message={parseError} /> : null}

      {/* Anything the file got wrong, with the line to look at. */}
      <AnimatePresence>
        {issues.length > 0 ? (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-card border border-warning/30 bg-warning/5 p-5">
              <p className="mb-3 flex items-center gap-2 text-xs font-medium text-warning">
                <AlertTriangle className="size-4" aria-hidden />
                {t('issuesTitle', { n: issues.length })}
              </p>
              <ul className="flex flex-col gap-1.5">
                {issues.slice(0, 8).map((issue, index) => (
                  <li key={index} className="text-2xs text-ink-soft dark:text-navy-200">
                    <span className="font-mono text-ink-muted">
                      {t('line', { n: issue.line })}
                    </span>{' '}
                    — {t(`issue.${issue.code}`)}
                    {issue.detail ? <span className="opacity-70"> · {issue.detail}</span> : null}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-2xs text-ink-muted">{t('issuesNote')}</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* The preview — what will actually be created */}
      {questions.length > 0 ? (
        <>
          <Panel
            title={t('preview', { n: questions.length })}
            action={
              <button
                type="button"
                onClick={() => {
                  setQuestions([])
                  setIssues([])
                  setFileName(null)
                }}
                className="inline-flex items-center gap-1.5 text-2xs text-ink-muted hover:text-danger"
              >
                <Trash2 className="size-3.5" aria-hidden />
                {t('clear')}
              </button>
            }
          >
            <ul className="max-h-96 overflow-y-auto">
              {questions.map((question, index) => (
                <li
                  key={question.key}
                  className="flex flex-col gap-2 border-b border-border-subtle p-5 last:border-b-0"
                >
                  <p className="flex gap-3 text-xs text-ink dark:text-white">
                    <span className="shrink-0 font-mono text-ink-muted">{index + 1}.</span>
                    {question.prompt}
                  </p>
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
                          {option.text}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t('details')}>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label={t('course')} htmlFor="import-course">
                <select
                  id="import-course"
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                  className={inputClass(!courseId)}
                >
                  <option value="">{t('choosePlaceholder')}</option>
                  {courseList.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.name?.uz ?? course._id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('title')} htmlFor="import-title">
                <input
                  id="import-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={inputClass(!title.trim())}
                />
              </Field>

              <Field label={t('order')} htmlFor="import-order" hint={t('orderHint')}>
                <input
                  id="import-order"
                  type="number"
                  min={1}
                  value={order}
                  onChange={(event) => setOrder(event.target.value)}
                  className={cn(inputClass(), 'font-mono')}
                />
              </Field>

              <Field label={t('passMark')} htmlFor="import-pass" hint={t('passHint')}>
                <input
                  id="import-pass"
                  type="number"
                  min={1}
                  max={100}
                  value={passMark}
                  onChange={(event) => setPassMark(event.target.value)}
                  className={cn(inputClass(), 'font-mono')}
                />
              </Field>
            </div>

            {create.error ? (
              <div className="px-5 pb-5">
                <ErrorBox code={create.error.code} message={create.error.message} />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4 border-t border-border-subtle px-5 py-4">
              <span className="text-2xs text-ink-muted">
                {fileName ? t('from', { name: fileName }) : ''}
              </span>
              <button
                type="button"
                onClick={save}
                disabled={!ready || create.pending}
                className="inline-flex h-12 items-center gap-2 rounded-pill bg-clay-500 px-6 text-xs font-medium text-white transition-[background-color,transform] duration-200 hover:bg-clay-400 active:scale-[0.98] disabled:opacity-50"
              >
                {create.pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                {t('publish')}
              </button>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  )
}

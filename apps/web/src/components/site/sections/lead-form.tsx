'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations, useLocale } from 'next-intl'
import { Send, Check, AlertCircle, Loader2 } from 'lucide-react'
import { quickLeadSchema, formatPhone, type QuickLeadInput } from '@leader/shared/schemas'
import { pick, type Locale } from '@leader/shared/locales'
import { Link } from '@/i18n/navigation'
import { getCourses } from '@/content/courses'
import { cn } from '@/lib/utils'
import { Field, inputClass, useValidationMessage } from '../form-field'
import { track } from '@/lib/analytics'

type Status = 'idle' | 'submitting' | 'success' | 'error'

/**
 * TZ §6.2 §14 — the short inline registration form. The full three-step flow
 * with SMS OTP lives at /apply (§7.1).
 *
 * Validation uses the *same* zod schema the API validates with
 * (`@leader/shared/schemas`), so the two can never disagree.
 */
export function LeadForm() {
  const t = useTranslations('home.form')
  const tn = useTranslations('nav')
  const locale = useLocale() as Locale
  const courses = getCourses()
  const [status, setStatus] = useState<Status>('idle')
  const startedRef = useRef(false)

  /** §6.3 — fires once, on first interaction. */
  const markStarted = () => {
    if (startedRef.current) return
    startedRef.current = true
    track('form_start', { form: 'home_inline', locale })
  }
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const resolveError = useValidationMessage()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<QuickLeadInput>({
    resolver: zodResolver(quickLeadSchema),
    defaultValues: { locale, consent: undefined },
  })

  const onSubmit = handleSubmit(async (values) => {
    setStatus('submitting')
    setErrorMessage(null)
    try {
      const response = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...values, locale }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error?.code ?? 'REQUEST_FAILED')
      }
      setStatus('success')
      track('lead_submitted', { form: 'home_inline', course: values.courseSlug, locale })
      reset()
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : null)
      track('lead_failed', { form: 'home_inline', locale })
    }
  })

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-success/30 bg-success/5 px-6 py-14 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-pill bg-success/15 text-success">
          <Check className="size-7" aria-hidden />
        </span>
        <p className="font-display text-lg text-ink dark:text-white">{t('success')}</p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="text-xs font-medium text-glaze-700 underline underline-offset-4 dark:text-glaze-300"
        >
          {t('fullFormLink')}
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      onFocusCapture={markStarted}
      noValidate
      className="flex flex-col gap-4"
    >
      {/* Honeypot — TZ §7.1. Hidden from humans and from assistive tech. */}
      <div aria-hidden className="absolute left-[-9999px] size-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      <Field label={t('name')} error={errors.fullName?.message} htmlFor="fullName">
        <input
          id="fullName"
          type="text"
          autoComplete="name"
          placeholder={t('namePlaceholder')}
          className={inputClass(!!errors.fullName)}
          {...register('fullName')}
        />
      </Field>

      <Field label={t('phone')} error={errors.phone?.message} htmlFor="phone">
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+998 90 123 45 67"
          className={cn(inputClass(!!errors.phone), 'font-mono')}
          {...register('phone', {
            onChange: (event) => setValue('phone', formatPhone(event.target.value)),
          })}
        />
      </Field>

      <Field label={t('course')} error={errors.courseSlug?.message} htmlFor="courseSlug">
        <select
          id="courseSlug"
          defaultValue=""
          className={inputClass(!!errors.courseSlug)}
          {...register('courseSlug')}
        >
          <option value="" disabled>
            {t('coursePlaceholder')}
          </option>
          {courses.map((course) => (
            <option key={course.slug} value={course.slug}>
              {pick(course.name, locale)}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex cursor-pointer items-start gap-3 text-xs text-ink-soft dark:text-navy-200">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 rounded border-navy-300 accent-glaze-600"
          {...register('consent')}
        />
        <span>
          {t('consent')}{' '}
          <Link
            href="/privacy"
            className="text-glaze-700 underline underline-offset-2 dark:text-glaze-300"
          >
            {tn('privacy')}
          </Link>
        </span>
      </label>
      {errors.consent ? (
        <p className="-mt-2 flex items-center gap-1.5 text-2xs text-danger">
          <AlertCircle className="size-3.5" aria-hidden />
          {resolveError(errors.consent.message)}
        </p>
      ) : null}

      {status === 'error' ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-input border border-danger/30 bg-danger/5 p-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t('error')}
            {errorMessage ? <span className="block font-mono text-2xs opacity-70">{errorMessage}</span> : null}
          </span>
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="gradient-glaze inline-flex h-14 items-center justify-center gap-2 rounded-pill text-sm font-medium text-white shadow-raise transition-all hover:shadow-float hover:brightness-110 disabled:opacity-60"
      >
        {status === 'submitting' ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('submitting')}
          </>
        ) : (
          <>
            <Send className="size-4" aria-hidden />
            {t('submit')}
          </>
        )}
      </button>
    </form>
  )
}

'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations, useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, AlertCircle, Loader2, Send } from 'lucide-react'
import {
  leadSchema,
  leadStep1Schema,
  leadStep2Schema,
  formatPhone,
  SCHEDULE_PATTERNS,
  TIME_SLOTS,
  LEAD_SOURCES,
  type LeadInput,
} from '@leader/shared/schemas'
import { pick, type Locale } from '@leader/shared/locales'
import { Link } from '@/i18n/navigation'
import { getCourses } from '@/content/courses'
import { getBranches } from '@/content/branches'
import { Field, inputClass, useValidationMessage } from './form-field'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics'

type Status = 'idle' | 'submitting' | 'success' | 'error'

const STEP_KEYS = ['who', 'what', 'confirm'] as const
const TOTAL = STEP_KEYS.length

/**
 * TZ §7.1 — the three-step public registration form.
 *
 * Each step validates against the *same* zod schema slice the API uses, so a
 * step cannot be advanced with data the server would later reject.
 *
 * Still to come in Phase 6 (they need backend and provider accounts — §31 Q5):
 *   · SMS OTP on the phone field with a 60 s resend cooldown and 5 codes/hour,
 *   · Cloudflare Turnstile alongside the honeypot that is already here,
 *   · branch auto-suggestion by geolocation.
 */
export function RegisterForm() {
  const t = useTranslations('pages.register')
  const tf = useTranslations('home.form')
  const tn = useTranslations('nav')
  const locale = useLocale() as Locale
  const searchParams = useSearchParams()
  const courses = getCourses()
  const branches = getBranches()

  const [step, setStep] = useState(0)
  const startedRef = useRef(false)

  /** §6.3 — 'form_start' fires once, on the first real interaction, not on render. */
  const markStarted = () => {
    if (startedRef.current) return
    startedRef.current = true
    track('form_start', { form: 'register', locale })
  }
  const [status, setStatus] = useState<Status>('idle')
  const resolveError = useValidationMessage()

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    reset,
    formState: { errors },
  } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    mode: 'onTouched',
    defaultValues: {
      locale,
      courseSlug: searchParams.get('course') ?? '',
      branchSlug: branches[0]?.slug ?? '',
    },
  })

  const next = async () => {
    const fields =
      step === 0
        ? (Object.keys(leadStep1Schema.shape) as (keyof LeadInput)[])
        : (Object.keys(leadStep2Schema.shape) as (keyof LeadInput)[])
    const valid = await trigger(fields)
    if (!valid) return
    const target = Math.min(step + 1, TOTAL - 1)
    setStep(target)
    // §6.3 — the TZ names 'form_step_2'; step 3 is tracked the same way so the
    // funnel has a value between step 2 and submission.
    track(target === 1 ? 'form_step_2' : 'form_step_3', { form: 'register', locale })
  }

  const onSubmit = handleSubmit(async (values) => {
    setStatus('submitting')
    try {
      const response = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...values, locale }),
      })
      if (!response.ok) throw new Error('REQUEST_FAILED')
      setStatus('success')
      track('lead_submitted', { form: 'register', course: values.courseSlug, locale })
      reset()
    } catch {
      setStatus('error')
      track('lead_failed', { form: 'register', locale })
    }
  })

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-5 rounded-card border border-success/30 bg-success/5 px-6 py-16 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-pill bg-success/15 text-success">
          <Check className="size-8" aria-hidden />
        </span>
        <h2 className="font-display text-lg text-ink dark:text-white">{t('successTitle')}</h2>
        <p className="max-w-sm text-sm text-ink-soft dark:text-navy-200">{t('successBody')}</p>
        <Link
          href="/"
          className="mt-2 inline-flex h-12 items-center rounded-pill border border-navy-600/25 px-6 text-xs font-medium text-navy-700 dark:text-navy-100"
        >
          {tn('skipToContent')}
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      onFocusCapture={markStarted}
      noValidate
      className="flex flex-col gap-6"
    >
      {/* Step indicator */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-medium uppercase tracking-[0.14em] text-glaze-700 dark:text-glaze-300">
            {t('step', { current: step + 1, total: TOTAL })}
          </span>
          <span className="text-2xs text-ink-muted">{t(`steps.${STEP_KEYS[step]}`)}</span>
        </div>
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL}
          aria-valuenow={step + 1}
        >
          {STEP_KEYS.map((key, index) => (
            <span
              key={key}
              className={cn(
                'h-1.5 flex-1 rounded-pill transition-colors duration-300',
                index <= step ? 'gradient-glaze' : 'bg-border-subtle',
              )}
            />
          ))}
        </div>
      </div>

      {/* Honeypot */}
      <div aria-hidden className="absolute left-[-9999px] size-0 overflow-hidden">
        <label htmlFor="reg-website">Website</label>
        <input id="reg-website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      {/* Step 1 — Who */}
      <div className={cn('flex flex-col gap-4', step !== 0 && 'hidden')}>
        <Field label={tf('name')} htmlFor="reg-name" error={errors.fullName?.message}>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder={tf('namePlaceholder')}
            className={inputClass(!!errors.fullName)}
            {...register('fullName')}
          />
        </Field>

        <Field label={tf('phone')} htmlFor="reg-phone" error={errors.phone?.message}>
          <input
            id="reg-phone"
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fields.age')} htmlFor="reg-age" error={errors.age?.message}>
            <input
              id="reg-age"
              type="number"
              inputMode="numeric"
              min={4}
              max={80}
              className={inputClass(!!errors.age)}
              {...register('age')}
            />
          </Field>
          <Field label={t('fields.schoolClass')} htmlFor="reg-class">
            <input id="reg-class" type="text" className={inputClass()} {...register('schoolClass')} />
          </Field>
        </div>
      </div>

      {/* Step 2 — What */}
      <div className={cn('flex flex-col gap-4', step !== 1 && 'hidden')}>
        <Field label={t('fields.branch')} htmlFor="reg-branch" error={errors.branchSlug?.message}>
          <select id="reg-branch" className={inputClass(!!errors.branchSlug)} {...register('branchSlug')}>
            {branches.map((branch) => (
              <option key={branch.slug} value={branch.slug}>
                {pick(branch.name, locale)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={tf('course')} htmlFor="reg-course" error={errors.courseSlug?.message}>
          <select id="reg-course" className={inputClass(!!errors.courseSlug)} {...register('courseSlug')}>
            <option value="" disabled>
              {tf('coursePlaceholder')}
            </option>
            {courses.map((course) => (
              <option key={course.slug} value={course.slug}>
                {pick(course.name, locale)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fields.preferredDays')} htmlFor="reg-days">
          <select id="reg-days" className={inputClass()} {...register('preferredDays')}>
            <option value="">—</option>
            {SCHEDULE_PATTERNS.map((pattern) => (
              <option key={pattern} value={pattern}>
                {t(`days.${pattern}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fields.preferredTime')} htmlFor="reg-time">
          <select id="reg-time" className={inputClass()} {...register('preferredTime')}>
            <option value="">—</option>
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {t(`times.${slot}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Step 3 — Confirm */}
      <div className={cn('flex flex-col gap-4', step !== 2 && 'hidden')}>
        <Field label={t('fields.source')} htmlFor="reg-source">
          <select id="reg-source" className={inputClass()} {...register('source')}>
            <option value="">—</option>
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {t(`sources.${source}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fields.comment')} htmlFor="reg-comment">
          <textarea
            id="reg-comment"
            rows={4}
            placeholder={t('fields.commentPlaceholder')}
            className={cn(inputClass(), 'h-auto resize-y py-3 leading-relaxed')}
            {...register('comment')}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 text-xs text-ink-soft dark:text-navy-200">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 rounded border-navy-300 accent-glaze-600"
            {...register('consent')}
          />
          <span>
            {tf('consent')}{' '}
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
      </div>

      {status === 'error' ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-input border border-danger/30 bg-danger/5 p-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {tf('error')}
        </p>
      ) : null}

      <div className="flex gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((current) => current - 1)}
            className="inline-flex h-14 items-center gap-2 rounded-pill border border-navy-600/25 px-6 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t('back')}
          </button>
        ) : null}

        {step < TOTAL - 1 ? (
          <button
            type="button"
            onClick={next}
            className="gradient-glaze inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-pill text-sm font-medium text-white shadow-raise transition-all hover:shadow-float hover:brightness-110"
          >
            {t('next')}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="gradient-glaze inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-pill text-sm font-medium text-white shadow-raise transition-all hover:shadow-float hover:brightness-110 disabled:opacity-60"
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {tf('submitting')}
              </>
            ) : (
              <>
                <Send className="size-4" aria-hidden />
                {t('submit')}
              </>
            )}
          </button>
        )}
      </div>
    </form>
  )
}

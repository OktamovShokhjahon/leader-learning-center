'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { KeyRound, Check, AlertCircle, Loader2 } from 'lucide-react'
import { changePasswordSchema } from '@leader/shared/schemas'
import type { z } from 'zod'
import { useAuth, apiFetch } from '@/lib/auth/auth-context'
import { Field, inputClass } from '@/components/site/form-field'

type FormValues = z.input<typeof changePasswordSchema>
type Status = 'idle' | 'submitting' | 'success' | 'error'

/**
 * TZ §8 — "changes the password and signs every other device out".
 *
 * The seeded SuperAdmin is created with `mustChangePassword`, so without this
 * there is no way to clear that flag from the product. Password rules
 * (minimum length, common-password blocklist) come from the same shared zod
 * schema the API validates with, so the browser rejects what the server would.
 */
export function ChangePassword() {
  const t = useTranslations('panel.password')
  const { getToken } = useAuth()
  const [status, setStatus] = useState<Status>('idle')
  const [errorCode, setErrorCode] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(changePasswordSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setStatus('submitting')
    setErrorCode(null)
    try {
      const token = await getToken()
      const response = await apiFetch('/auth/password', token, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setErrorCode(body?.error?.code ?? 'UNKNOWN')
        setStatus('error')
        return
      }
      setStatus('success')
      reset()
    } catch {
      setErrorCode('UPSTREAM_UNAVAILABLE')
      setStatus('error')
    }
  })

  if (status === 'success') {
    return (
      <div className="panel-frame-ink flex flex-col items-start gap-3 rounded-card bg-surface p-6">
        <span className="inline-flex size-11 items-center justify-center rounded-pill bg-success/15 text-success">
          <Check className="size-5" aria-hidden />
        </span>
        <h2 className="font-display text-base text-ink dark:text-white">{t('doneTitle')}</h2>
        <p className="text-xs text-ink-soft dark:text-navy-200">{t('doneBody')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="panel-frame-ink flex flex-col gap-4 rounded-card bg-surface p-6">
      <h2 className="flex items-center gap-2 font-display text-base text-ink dark:text-white">
        <KeyRound className="size-4.5 text-glaze-600" aria-hidden />
        {t('title')}
      </h2>

      <Field label={t('current')} htmlFor="pw-current" error={errors.currentPassword?.message}>
        <input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          className={inputClass(!!errors.currentPassword)}
          {...register('currentPassword')}
        />
      </Field>

      <Field
        label={t('next')}
        htmlFor="pw-new"
        hint={t('hint')}
        error={errors.newPassword?.message}
      >
        <input
          id="pw-new"
          type="password"
          autoComplete="new-password"
          className={inputClass(!!errors.newPassword)}
          {...register('newPassword')}
        />
      </Field>

      <Field label={t('confirm')} htmlFor="pw-confirm" error={errors.confirmPassword?.message}>
        <input
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          className={inputClass(!!errors.confirmPassword)}
          {...register('confirmPassword')}
        />
      </Field>

      {status === 'error' ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-input border border-danger/30 bg-danger/5 p-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errorCode === 'INVALID_CREDENTIALS' ? t('wrongCurrent') : t('failed')}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-pill bg-navy-600 px-6 text-xs font-medium text-white transition-colors duration-200 hover:bg-navy-700 disabled:opacity-60"
      >
        {status === 'submitting' ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <KeyRound className="size-4" aria-hidden />
        )}
        {t('submit')}
      </button>
    </form>
  )
}

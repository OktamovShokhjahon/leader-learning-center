'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Send, Check, AlertCircle, Loader2 } from 'lucide-react'
import { contactSchema, formatPhone, type ContactInput } from '@leader/shared/schemas'
import { Field, inputClass } from './form-field'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'submitting' | 'success' | 'error'

/** TZ §6.1 — contact page form, validated by the same shared zod schema as the API. */
export function ContactForm() {
  const t = useTranslations('pages.contact')
  const tf = useTranslations('home.form')
  const [status, setStatus] = useState<Status>('idle')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ContactInput>({ resolver: zodResolver(contactSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setStatus('submitting')
    try {
      const response = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error('REQUEST_FAILED')
      setStatus('success')
      reset()
    } catch {
      setStatus('error')
    }
  })

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-success/30 bg-success/5 px-6 py-12 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-pill bg-success/15 text-success">
          <Check className="size-7" aria-hidden />
        </span>
        <p className="font-display text-base text-ink dark:text-white">{tf('success')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div aria-hidden className="absolute left-[-9999px] size-0 overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      <Field label={tf('name')} htmlFor="contact-name" error={errors.fullName?.message}>
        <input
          id="contact-name"
          type="text"
          autoComplete="name"
          placeholder={tf('namePlaceholder')}
          className={inputClass(!!errors.fullName)}
          {...register('fullName')}
        />
      </Field>

      <Field label={tf('phone')} htmlFor="contact-phone" error={errors.phone?.message}>
        <input
          id="contact-phone"
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

      <Field label={t('message')} htmlFor="contact-message" error={errors.message?.message}>
        <textarea
          id="contact-message"
          rows={5}
          placeholder={t('messagePlaceholder')}
          className={cn(inputClass(!!errors.message), 'h-auto resize-y py-3 leading-relaxed')}
          {...register('message')}
        />
      </Field>

      {status === 'error' ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-input border border-danger/30 bg-danger/5 p-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {tf('error')}
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
            {tf('submitting')}
          </>
        ) : (
          <>
            <Send className="size-4" aria-hidden />
            {t('send')}
          </>
        )}
      </button>
    </form>
  )
}

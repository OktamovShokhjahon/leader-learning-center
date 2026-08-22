'use client'

import { useTranslations } from 'next-intl'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Shared field chrome for every form. TZ §25.6 — 44 px targets, AA contrast. */
export function inputClass(hasError?: boolean) {
  return cn(
    'h-13 w-full rounded-input border bg-background px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted dark:text-white',
    hasError ? 'border-danger focus:border-danger' : 'border-border-subtle focus:border-glaze-500',
  )
}

/**
 * TZ §21.2 — the shared zod schemas emit i18n *keys* (`passwordTooCommon`),
 * never sentences, so the API can reject something without inventing English
 * copy the browser then shows to an Uzbek speaker.
 *
 * This is where a key becomes words. Doing it inside `Field` means every form
 * on the site gets it without remembering to: the raw key can only leak if a
 * message is rendered outside a field, and anything unrecognised falls back to
 * the generic line rather than showing an identifier to a visitor.
 */
export function useValidationMessage() {
  const t = useTranslations('validation')

  return (message?: string) => {
    if (!message) return undefined
    // Keys are camelCase identifiers; anything with a space is already a sentence.
    if (/\s/.test(message)) return message
    return t.has(message as 'required') ? t(message as 'required') : t('required')
  }
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor: string
  /** A validation key from the shared schemas, or a ready sentence. */
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  const resolve = useValidationMessage()
  const message = resolve(error)

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-soft dark:text-navy-200">
        {label}
      </label>
      {children}
      {hint && !message ? <p className="text-2xs text-ink-muted">{hint}</p> : null}
      {message ? (
        <p className="flex items-center gap-1.5 text-2xs text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {message}
        </p>
      ) : null}
    </div>
  )
}

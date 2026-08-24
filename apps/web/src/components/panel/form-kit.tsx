'use client'

import { useEffect, useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Loader2, Check, type LucideIcon } from 'lucide-react'
import { LOCALES, LOCALE_SHORT, type Locale } from '@leader/shared/locales'
import { formatNumber, parseSoum } from '@leader/shared/money'
import type { ApiError } from '@/lib/api/use-api'
import { ErrorBox } from './primitives'
import { cn } from '@/lib/utils'

/**
 * The panel's form vocabulary.
 *
 * These began as unexported locals inside `user-dialog.tsx`. Every CRUD screen
 * after it needs the same six pieces, and a second copy is how two dialogs start
 * disagreeing about what a disabled button looks like — so they live here, and
 * the dialogs compose them.
 *
 * Nothing here validates. The API is the source of truth (§4.3) and it answers
 * `VALIDATION_FAILED` with a per-field map of i18n keys, which `DialogError`
 * unpacks. A `ready` boolean on the caller is for enabling the submit button,
 * not for deciding whether the data is good.
 */

export const INPUT =
  'w-full rounded-input border border-border-subtle bg-background px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-glaze-500 disabled:opacity-50 dark:text-white'

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-soft dark:text-navy-200">
        {label}
        {required ? <span className="ml-1 text-clay-500">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-2xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-2xs text-ink-muted">{hint}</span>
      ) : null}
    </label>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
}: {
  value: T | ''
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(INPUT, 'h-12 py-0', className)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

/**
 * §26.4 — money is a whole number of so'm all the way down, never a float.
 *
 * The field shows grouped digits while you type because a seven-figure fee is
 * unreadable otherwise, but what leaves through `onChange` is an integer.
 */
export function MoneyInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [text, setText] = useState(value === null ? '' : formatNumber(value, 'uz'))

  // Re-sync when the parent replaces the value (opening the dialog on a new row).
  useEffect(() => {
    setText(value === null ? '' : formatNumber(value, 'uz'))
  }, [value])

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder}
      value={text}
      onChange={(event) => {
        const raw = event.target.value
        if (raw.trim() === '') {
          setText('')
          onChange(null)
          return
        }
        const parsed = parseSoum(raw)
        if (parsed === null) {
          // Keep what they typed so a stray keystroke does not wipe the field.
          setText(raw)
          return
        }
        setText(formatNumber(parsed, 'uz'))
        onChange(parsed)
      }}
      className={cn(INPUT, 'font-mono tabular-nums')}
    />
  )
}

export function DateField({
  value,
  onChange,
  disabled,
  max,
  min,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  max?: string
  min?: string
}) {
  return (
    <input
      type="date"
      value={value}
      max={max}
      min={min}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={cn(INPUT, 'h-12 py-0')}
    />
  )
}

export function Toggle({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'h-11 rounded-input border text-xs font-medium transition-colors disabled:opacity-50',
        active
          ? 'border-transparent bg-navy-600 text-white'
          : 'border-border-subtle text-ink-soft hover:border-navy-600/40 dark:text-navy-200',
      )}
    >
      {label}
    </button>
  )
}

export function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-border-subtle text-navy-600 focus:ring-glaze-500"
      />
      <label htmlFor={id} className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-ink dark:text-white">{label}</span>
        {hint ? <span className="text-2xs text-ink-muted">{hint}</span> : null}
      </label>
    </div>
  )
}

/**
 * §21.2 — every piece of dynamic content is `{ uz, ru, en }`, with `uz`
 * required and the other two falling back to it when empty.
 *
 * Three tabs rather than three stacked inputs: an editor filling in a course
 * name should see one field, not a wall, and the tab strip is where the "this
 * one is still empty" signal belongs.
 */
export type Localized = { uz: string; ru?: string; en?: string }

export function LocalizedTabs({
  value,
  onChange,
  multiline = false,
  rows = 4,
}: {
  value: Localized
  onChange: (value: Localized) => void
  multiline?: boolean
  rows?: number
}) {
  const [active, setActive] = useState<Locale>('uz')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5">
        {LOCALES.map((locale) => {
          const filled = Boolean(value[locale]?.trim())
          return (
            <button
              key={locale}
              type="button"
              onClick={() => setActive(locale)}
              aria-pressed={active === locale}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-2xs font-medium transition-colors',
                active === locale
                  ? 'bg-navy-600 text-white'
                  : 'text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800',
              )}
            >
              {LOCALE_SHORT[locale]}
              <span
                aria-hidden
                className={cn(
                  'size-1.5 rounded-pill',
                  filled ? 'bg-success' : locale === 'uz' ? 'bg-clay-500' : 'bg-ink-muted/40',
                )}
              />
            </button>
          )
        })}
      </div>

      {multiline ? (
        <textarea
          rows={rows}
          value={value[active] ?? ''}
          onChange={(event) => onChange({ ...value, [active]: event.target.value })}
          className={cn(INPUT, 'resize-y')}
        />
      ) : (
        <input
          value={value[active] ?? ''}
          onChange={(event) => onChange({ ...value, [active]: event.target.value })}
          className={INPUT}
        />
      )}
    </div>
  )
}

export function Action({
  label,
  Icon = Check,
  pending,
  disabled = false,
  tone = 'default',
  onClick,
}: {
  label: string
  Icon?: LucideIcon
  pending?: boolean
  disabled?: boolean
  tone?: 'default' | 'primary' | 'danger'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || disabled}
      className={cn(
        'inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill text-xs font-medium transition-colors disabled:opacity-50',
        tone === 'primary'
          ? 'bg-clay-500 text-white hover:bg-clay-400'
          : tone === 'danger'
            ? 'border border-danger/30 text-danger hover:bg-danger/10'
            : 'border border-navy-600/25 text-navy-700 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800',
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Icon className="size-4" aria-hidden />
      )}
      {label}
    </button>
  )
}

export function Divider() {
  return <span className="h-px w-full bg-border-subtle" aria-hidden />
}

/**
 * The panel's one dialog shell — a bottom sheet on a phone, a centred card on a
 * desktop, because §27 requires every screen to work on a phone and a modal
 * pinned to the middle of a small viewport is the usual way that breaks.
 */
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  const t = useTranslations('panel.form')

  // Escape closes, because a dialog that traps you is worse than no dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'max-h-[92svh] w-full overflow-y-auto rounded-t-card bg-surface p-6 shadow-float sm:rounded-card',
          wide ? 'max-w-2xl' : 'max-w-lg',
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-base text-ink dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-ink-muted hover:bg-navy-50 dark:hover:bg-navy-800"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** A destructive action asks once, in words, naming what it is about to do. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  title: string
  body: string
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const t = useTranslations('panel.form')
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="text-xs leading-relaxed text-ink-soft dark:text-navy-200">{body}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Action label={t('cancel')} Icon={X} onClick={onClose} />
          <Action label={confirmLabel} tone="danger" pending={pending} onClick={onConfirm} />
        </div>
      </div>
    </Dialog>
  )
}

/**
 * `VALIDATION_FAILED` carries a per-field map of i18n keys (§21.2), and for a
 * form those fields *are* the message — "password too common" is useless
 * flattened into a generic "something went wrong".
 */
export function DialogError({ error }: { error: ApiError }) {
  const t = useTranslations('validation')
  const details = error.details as Record<string, string[]> | undefined

  if (error.code === 'VALIDATION_FAILED' && details) {
    return (
      <ul
        role="alert"
        className="flex flex-col gap-1 rounded-input border border-danger/30 bg-danger/5 p-3 text-2xs text-danger"
      >
        {Object.entries(details).map(([field, messages]) => (
          <li key={field}>{messages.map((key) => (t.has(key) ? t(key) : key)).join(' · ')}</li>
        ))}
      </ul>
    )
  }
  return <ErrorBox code={error.code} message={error.message} />
}

/** A short success line that clears itself, for saves that stay on the screen. */
export function Saved({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 rounded-input border border-success/30 bg-success/5 p-3 text-2xs text-success">
      <Check className="size-3.5" aria-hidden />
      {label}
    </p>
  )
}

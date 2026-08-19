'use client'

import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Shared field chrome for every public form. TZ §25.6 — 44 px targets, AA contrast. */
export function inputClass(hasError?: boolean) {
  return cn(
    'h-13 w-full rounded-input border bg-background px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted dark:text-white',
    hasError ? 'border-danger focus:border-danger' : 'border-border-subtle focus:border-glaze-500',
  )
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
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-soft dark:text-navy-200">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-2xs text-ink-muted">{hint}</p> : null}
      {error ? (
        <p className="flex items-center gap-1.5 text-2xs text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  )
}

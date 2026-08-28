'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Plus, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The chrome every list screen repeats: a search box, a row of filter chips and
 * a pager. All three were copy-pasted between `students-table.tsx` and
 * `users-table.tsx` before this file existed.
 */

export function FilterChip({
  label,
  active,
  onClick,
  tone,
}: {
  label: string
  active: boolean
  onClick: () => void
  /** Optional dot, for chips that stand for a status with its own colour. */
  tone?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-3 py-2 text-2xs font-medium transition-colors',
        active
          ? 'border-transparent bg-navy-600 text-white'
          : 'border-border-subtle text-ink-muted hover:text-navy-700 dark:hover:text-white',
      )}
    >
      {tone ? <span className={cn('size-1.5 rounded-pill', tone)} aria-hidden /> : null}
      {label}
    </button>
  )
}

/**
 * One filter, as a dropdown, sized to sit in the toolbar beside the search box.
 *
 * A chip row is right while the options fit on one line; past that it wraps
 * into a second and third row and the toolbar stops reading as a toolbar. A
 * native `<select>` rather than a custom listbox: this opens as the phone's own
 * picker, and it is already keyboard- and screen-reader-complete.
 *
 * `tone` lets the closed control carry the colour of what is selected, so a
 * list narrowed to something urgent still says so at a glance.
 */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  allLabel,
  tone = 'default',
}: {
  /** Names the filter for assistive tech; the closed control shows the value. */
  label: string
  value: T | null
  onChange: (value: T | null) => void
  options: { value: T; label: string }[]
  /** The "no filter" option, first in the list. */
  allLabel: string
  tone?: 'default' | 'danger'
}) {
  return (
    <span
      className={cn(
        'relative inline-flex h-12 shrink-0 items-center rounded-pill border transition-colors',
        tone === 'danger'
          ? 'border-transparent bg-danger text-white'
          : value
            ? 'border-transparent bg-navy-600 text-white'
            : 'border-border-subtle bg-surface text-ink-soft dark:text-navy-200',
      )}
    >
      <select
        aria-label={label}
        value={value ?? ''}
        onChange={(event) => onChange((event.target.value || null) as T | null)}
        className="h-full cursor-pointer appearance-none rounded-pill bg-transparent py-0 pl-5 pr-10 text-xs font-medium text-current outline-none focus-visible:ring-2 focus-visible:ring-glaze-500"
      >
        <option value="" className="text-ink">
          {allLabel}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="text-ink">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 size-3.5 opacity-70"
        aria-hidden
      />
    </span>
  )
}

/**
 * Debounced so a list does not re-query on every keystroke, and so the "at
 * least 2 characters" rule lives in one place rather than in each caller.
 */
export function SearchBox({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoFocus?: boolean
}) {
  return (
    <div className="relative min-w-60 flex-1">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-input border border-border-subtle bg-surface pl-11 pr-4 text-sm text-ink outline-none focus:border-glaze-500 dark:text-white"
      />
    </div>
  )
}

/** `value` follows the input immediately; the returned term lags by `delay`. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) {
  const t = useTranslations('panel.form')
  if (pages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="h-11 rounded-pill border border-border-subtle px-4 text-xs disabled:opacity-40"
      >
        {t('prev')}
      </button>
      <span className="font-mono text-2xs text-ink-muted">
        {page} / {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="h-11 rounded-pill border border-border-subtle px-4 text-xs disabled:opacity-40"
      >
        {t('next')}
      </button>
    </div>
  )
}

/** The "New X" button, so every list screen puts it in the same place. */
export function NewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-12 shrink-0 items-center gap-2 rounded-pill bg-clay-500 px-5 text-xs font-medium text-white transition-colors hover:bg-clay-400"
    >
      <Plus className="size-4" aria-hidden />
      {label}
    </button>
  )
}

/** A row-level button: edit, archive, open. Small, quiet, never the main event. */
export function RowAction({
  label,
  Icon,
  onClick,
  tone = 'default',
}: {
  label: string
  Icon?: React.ComponentType<{ className?: string }>
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-pill border px-3 text-2xs font-medium transition-colors',
        tone === 'danger'
          ? 'border-danger/30 text-danger hover:bg-danger/10'
          : 'border-border-subtle text-ink-soft hover:border-navy-600/40 hover:text-navy-700 dark:text-navy-200 dark:hover:text-white',
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {label}
    </button>
  )
}

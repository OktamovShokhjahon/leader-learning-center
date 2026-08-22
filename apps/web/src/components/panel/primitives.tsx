'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Loader2, AlertCircle, Inbox, type LucideIcon } from 'lucide-react'
import { formatSoum, formatNumber } from '@leader/shared/money'
import type { Locale } from '@leader/shared/locales'
import { GirihStar } from '@/components/ui/girih-star'
import { cn } from '@/lib/utils'

/** Page chrome for every panel screen — one rhythm across the whole CRM. */
export function PanelPage({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="container-site flex flex-col gap-7 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          {eyebrow ? (
            <p className="flex items-center gap-2.5 text-2xs font-medium uppercase tracking-[0.18em] text-glaze-700 dark:text-glaze-300">
              <GirihStar className="size-3 text-clay-500" />
              {eyebrow}
            </p>
          ) : null}
          <h1 className="display-section text-ink dark:text-white">{title}</h1>
          {subtitle ? (
            <p className="text-xs text-ink-soft dark:text-navy-200">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}

/** TZ §25.6 — every screen has a designed loading, empty and error state. */
export function Loading({ label }: { label?: string }) {
  const t = useTranslations('panel')
  return (
    <div className="flex items-center justify-center gap-3 rounded-card border border-border-subtle bg-surface py-16 text-xs text-ink-muted">
      <Loader2 className="size-5 animate-spin text-glaze-600" aria-hidden />
      {label ?? t('loading')}
    </div>
  )
}

export function ErrorBox({ code, message }: { code?: string; message?: string }) {
  const t = useTranslations('panel.errors')
  // The API sends a code; the sentence is ours to translate (§21.2).
  const known = code && t.has(code as 'UNKNOWN')
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-card border border-danger/30 bg-danger/5 p-5 text-xs text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {known ? t(code as 'UNKNOWN') : t('UNKNOWN')}
        {!known && message ? (
          <span className="mt-1 block font-mono text-2xs opacity-70">{message}</span>
        ) : null}
      </span>
    </p>
  )
}

export function Empty({ title, Icon = Inbox }: { title: string; Icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border-subtle bg-surface/50 py-14 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-pill bg-glaze-50 text-glaze-600 dark:bg-navy-800 dark:text-glaze-300">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-xs text-ink-soft dark:text-navy-200">{title}</p>
    </div>
  )
}

/**
 * TZ §25.2 — money uses tabular figures so columns align, and §26.4 keeps it a
 * whole number of so'm all the way to this component.
 */
export function Money({
  amount,
  className,
  compact = false,
}: {
  amount: number
  className?: string
  compact?: boolean
}) {
  const locale = useLocale() as Locale
  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {compact ? formatNumber(amount, locale) : formatSoum(amount, locale)}
    </span>
  )
}

/** A framed data panel — the same ceramic language as the public site. */
export function Panel({
  children,
  className,
  title,
  action,
}: {
  children: React.ReactNode
  className?: string
  title?: string
  action?: React.ReactNode
}) {
  return (
    <section className={cn('panel-frame-ink overflow-hidden rounded-card bg-surface', className)}>
      {title || action ? (
        <header className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
          {title ? (
            <h2 className="font-display text-sm tracking-[-0.01em] text-ink dark:text-white">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  )
}

/** Horizontally scrollable table shell — §27 requires every screen to work on a phone. */
export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-left text-xs">{children}</table>
    </div>
  )
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'border-b border-border-subtle px-5 py-3 text-2xs font-medium uppercase tracking-[0.1em] text-ink-muted',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn('border-b border-border-subtle px-5 py-3.5 align-middle', className)}>
      {children}
    </td>
  )
}

/**
 * §9.1 student statuses and §11.1 invoice statuses.
 *
 * §25.2 — the debt colours are deliberately outside the brand palette (amber →
 * orange → red) so a debtor row can never read as decoration.
 */
const STATUS_TONE: Record<string, string> = {
  active: 'bg-glaze-50 text-glaze-800 dark:bg-navy-800 dark:text-glaze-200',
  paid: 'bg-success/12 text-success',
  pending: 'bg-navy-50 text-ink-soft dark:bg-navy-800 dark:text-navy-200',
  partial: 'bg-warning/15 text-warning',
  overdue: 'bg-danger/12 text-danger',
  cancelled: 'bg-navy-50 text-ink-muted dark:bg-navy-800',
  frozen: 'bg-info/12 text-info',
  completed: 'bg-navy-50 text-ink-soft dark:bg-navy-800 dark:text-navy-200',
  dropped: 'bg-navy-100 text-ink-muted dark:bg-navy-800',
  present: 'bg-success/12 text-success',
  absent: 'bg-danger/12 text-danger',
  late: 'bg-warning/15 text-warning',
  excused: 'bg-info/12 text-info',
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-pill px-2.5 py-1 text-2xs font-medium',
        STATUS_TONE[status] ?? 'bg-navy-50 text-ink-soft dark:bg-navy-800',
      )}
    >
      {label ?? status}
    </span>
  )
}

/** §11.3 — 🟡 1–3 days · 🟠 4–10 · 🔴 more than 10. */
export function overdueTone(days: number): string {
  if (days > 10) return 'text-danger'
  if (days > 3) return 'text-clay-600'
  return 'text-warning'
}

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * TZ §25.6 — "every screen has designed empty, loading and error states, and
 * error messages say what happened and what to do next."
 */
export function EmptyState({
  Icon,
  title,
  body,
  action,
  className,
}: {
  Icon: LucideIcon
  title: string
  body?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 rounded-card border border-dashed border-border-subtle bg-surface/50 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="inline-flex size-14 items-center justify-center rounded-pill bg-glaze-50 text-glaze-600 dark:bg-navy-800 dark:text-glaze-300">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-display text-base text-ink dark:text-white">{title}</p>
        {body ? <p className="max-w-md text-xs text-ink-soft dark:text-navy-200">{body}</p> : null}
      </div>
      {action}
    </div>
  )
}

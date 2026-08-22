import * as React from 'react'
import { cn } from '@/lib/utils'
import { GirihStar } from './girih-star'

/**
 * TZ §25.3 — the structural device. Section eyebrows are the girih star plus a
 * label, so the majolica motif punctuates the page instead of decorating it.
 * Numbered markers appear only in "How it works", where the content genuinely
 * is a sequence.
 */
export function Eyebrow({
  children,
  className,
  tone = 'light',
}: {
  children: React.ReactNode
  className?: string
  tone?: 'light' | 'dark'
}) {
  return (
    <p
      className={cn(
        'flex items-center gap-2.5 text-2xs font-medium uppercase tracking-[0.18em]',
        tone === 'light' ? 'text-glaze-700 dark:text-glaze-300' : 'text-white/70',
        className,
      )}
    >
      <GirihStar className={cn('size-3.5', tone === 'light' ? 'text-clay-500' : 'text-clay-300')} />
      {children}
    </p>
  )
}

export function Section({ children, className, id, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section id={id} className={cn('py-16 md:py-24', className)} {...props}>
      {children}
    </section>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'start',
  tone = 'light',
  action,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  align?: 'start' | 'center'
  tone?: 'light' | 'dark'
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'mb-10 flex flex-col gap-4 md:mb-14',
        align === 'center' && 'items-center text-center',
        action && 'md:flex-row md:items-end md:justify-between',
      )}
    >
      <div className={cn('flex flex-col gap-3.5', align === 'center' && 'items-center')}>
        {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
        <h2
          className={cn(
            'display-section max-w-2xl',
            tone === 'light' ? 'text-ink dark:text-white' : 'text-white',
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            className={cn(
              'max-w-xl text-sm',
              tone === 'light' ? 'text-ink-soft dark:text-navy-200' : 'text-white/70',
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

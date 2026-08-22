'use client'

import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { GirihStar } from '@/components/ui/girih-star'
import { cn } from '@/lib/utils'

export type ResultEntry = {
  id: string
  studentName: string
  achievement: string
  year: number
  courseSlug: string
  courseName: string
  quote: string | null
}

/**
 * TZ §6.2 §6 — the results wall, "filterable by course".
 *
 * Filtering is client-side over a list that is already in the DOM: the whole
 * wall is server-rendered so every result is indexable, and the filter only
 * hides. Cards animate with `layout` so a filter change moves them to their new
 * positions instead of the grid snapping.
 */
export function ResultsWall({
  entries,
  allLabel,
}: {
  entries: ResultEntry[]
  allLabel: string
}) {
  const [active, setActive] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()

  const courses = useMemo(() => {
    const seen = new Map<string, string>()
    for (const entry of entries) seen.set(entry.courseSlug, entry.courseName)
    return [...seen].map(([slug, name]) => ({ slug, name }))
  }, [entries])

  const visible = active ? entries.filter((entry) => entry.courseSlug === active) : entries

  return (
    <div className="flex flex-col gap-8">
      {courses.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group">
          <FilterChip label={allLabel} selected={active === null} onSelect={() => setActive(null)} />
          {courses.map((course) => (
            <FilterChip
              key={course.slug}
              label={course.name}
              selected={active === course.slug}
              onSelect={() => setActive(course.slug)}
            />
          ))}
        </div>
      ) : null}

      <motion.ul layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((entry) => (
          <motion.li
            key={entry.id}
            layout={!reduceMotion}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="panel-frame-ink flex flex-col gap-3 rounded-card bg-background p-5"
          >
            <span className="gradient-glaze-text font-display text-xl font-semibold tracking-[-0.03em]">
              {entry.achievement}
            </span>
            <span className="text-sm font-medium text-ink dark:text-white">
              {entry.studentName}
            </span>
            {entry.quote ? (
              <p className="text-xs leading-relaxed text-ink-soft dark:text-navy-200">
                “{entry.quote}”
              </p>
            ) : null}
            <span className="mt-auto flex items-center justify-between gap-2 border-t border-border-subtle pt-3 text-2xs text-ink-muted">
              <span className="truncate">{entry.courseName}</span>
              <span className="font-mono">{entry.year}</span>
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  )
}

function FilterChip({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-xs font-medium transition-colors duration-200',
        selected
          ? 'border-transparent bg-navy-600 text-white'
          : 'border-navy-600/20 text-ink-soft hover:border-navy-600/40 hover:text-navy-700 dark:text-navy-200 dark:hover:text-white',
      )}
    >
      <GirihStar
        className={cn('size-2.5', selected ? 'text-clay-300' : 'text-clay-500/50')}
        strokeWidth={2.6}
      />
      {label}
    </button>
  )
}

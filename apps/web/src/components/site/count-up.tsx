'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { animate, useReducedMotion } from 'motion/react'
import type { Locale } from '@leader/shared/locales'

const INTL_LOCALE: Record<Locale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-US' }

/**
 * TZ §6.2 §3 — count-up animation on scroll.
 *
 * The *final* value is what renders on the server and through hydration, so the
 * real number is always in the HTML for crawlers and for users without JS. The
 * count-up only rewinds to zero once we know the element is still below the
 * fold; a stat already on screen at load simply stays at its value rather than
 * flashing back to 0.
 *
 * Runs once (§25.5 "nothing animates twice") and is skipped entirely under
 * `prefers-reduced-motion` (§25.6).
 */
export function CountUp({
  to,
  decimals = 0,
  suffix = '',
  duration = 1.6,
}: {
  to: number
  decimals?: number
  suffix?: string
  duration?: number
}) {
  const locale = useLocale() as Locale
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(to)
  const played = useRef(false)

  useEffect(() => {
    if (reduceMotion || played.current) return
    const node = ref.current
    if (!node) return

    // Already in view on first paint — leave the number alone.
    const rect = node.getBoundingClientRect()
    if (rect.top < window.innerHeight) {
      played.current = true
      return
    }

    setValue(0)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || played.current) return
        played.current = true
        observer.disconnect()
        animate(0, to, {
          duration,
          ease: [0.22, 1, 0.36, 1],
          onUpdate: setValue,
        })
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [to, duration, reduceMotion])

  const formatted = new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)

  return (
    <span ref={ref} className="tabular">
      {formatted}
      {suffix}
    </span>
  )
}

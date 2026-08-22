'use client'

import type { AnchorHTMLAttributes } from 'react'
import { track, type AnalyticsEvent, type AnalyticsParams } from '@/lib/analytics'

/**
 * TZ §6.3 — "Telegram/Instagram click tracking".
 *
 * A plain `<a>` that reports the click before the browser follows it. It stays a
 * real anchor, so middle-click, copy-link and keyboard activation all behave
 * normally and the link works with JavaScript disabled.
 */
export function TrackedLink({
  event,
  params,
  children,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  event: AnalyticsEvent
  params?: AnalyticsParams
}) {
  return (
    <a
      {...props}
      onClick={(nativeEvent) => {
        track(event, params)
        onClick?.(nativeEvent)
      }}
    >
      {children}
    </a>
  )
}

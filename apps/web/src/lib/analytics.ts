/**
 * TZ §6.3 — "Yandex.Metrica + Google Analytics 4 + Meta Pixel + Telegram/Instagram
 * click tracking; all events on the registration funnel are tracked
 * (`form_start`, `form_step_2`, `lead_submitted`)."
 *
 * One `track()` call fans out to every provider that is configured. Providers
 * with no id are simply absent — nothing is loaded, nothing is sent, and the
 * call is a no-op. That keeps the funnel instrumentation identical in
 * development, on staging and in production without any conditionals at the
 * call sites.
 */

export const ANALYTICS_IDS = {
  ga4: process.env.NEXT_PUBLIC_GA4_ID,
  metrica: process.env.NEXT_PUBLIC_YANDEX_METRICA_ID,
  metaPixel: process.env.NEXT_PUBLIC_META_PIXEL_ID,
} as const

export function analyticsEnabled() {
  return Boolean(ANALYTICS_IDS.ga4 || ANALYTICS_IDS.metrica || ANALYTICS_IDS.metaPixel)
}

/**
 * The funnel event names are fixed by the TZ. `AnalyticsEvent` is a closed union
 * so a typo cannot silently create a new, never-reported event.
 */
export type AnalyticsEvent =
  // §6.3 registration funnel
  | 'form_start'
  | 'form_step_2'
  | 'form_step_3'
  | 'lead_submitted'
  | 'lead_failed'
  // §6.3 contact-channel clicks
  | 'click_telegram'
  | 'click_instagram'
  | 'click_social'
  | 'click_phone'
  | 'click_apply_cta'
  | 'contact_submitted'

export type AnalyticsParams = Record<string, string | number | boolean | undefined>

type WindowWithAnalytics = Window & {
  gtag?: (command: string, ...args: unknown[]) => void
  ym?: (counterId: number, action: string, ...args: unknown[]) => void
  fbq?: (command: string, ...args: unknown[]) => void
}

/**
 * Meta's Pixel only recognises a fixed vocabulary of standard events; anything
 * else has to go through `trackCustom` or it is silently dropped.
 */
const META_STANDARD_EVENTS: Partial<Record<AnalyticsEvent, string>> = {
  lead_submitted: 'Lead',
  form_start: 'InitiateCheckout',
  contact_submitted: 'Contact',
}

export function track(event: AnalyticsEvent, params: AnalyticsParams = {}) {
  if (typeof window === 'undefined') return

  const w = window as WindowWithAnalytics

  try {
    w.gtag?.('event', event, params)

    if (ANALYTICS_IDS.metrica) {
      w.ym?.(Number(ANALYTICS_IDS.metrica), 'reachGoal', event, params)
    }

    const standard = META_STANDARD_EVENTS[event]
    if (standard) {
      w.fbq?.('track', standard, params)
    } else {
      w.fbq?.('trackCustom', event, params)
    }
  } catch {
    // Analytics must never break the page — a blocked script or an ad blocker
    // removing `fbq` mid-call is expected, not exceptional.
  }
}

/** Convenience for anchor handlers: `onClick={() => trackClick('click_telegram')}`. */
export function trackClick(event: AnalyticsEvent, params?: AnalyticsParams) {
  track(event, params)
}

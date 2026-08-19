import { Unbounded, Onest, JetBrains_Mono } from 'next/font/google'

/**
 * TZ §25.2 — the hard constraint is full Cyrillic + Latin coverage: the Russian
 * interface must not fall back to a system font. All three faces are
 * self-hosted by next/font with the cyrillic subset explicitly requested.
 */

export const display = Unbounded({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['500', '600', '700'],
  variable: '--font-unbounded',
  display: 'swap',
})

export const sans = Onest({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-onest',
  display: 'swap',
})

export const mono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const fontVariables = `${display.variable} ${sans.variable} ${mono.variable}`

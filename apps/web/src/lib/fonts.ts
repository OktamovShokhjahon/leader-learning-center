import { Unbounded, Golos_Text, JetBrains_Mono } from 'next/font/google'

/**
 * TZ §25.2 — the hard constraint is full Cyrillic + Latin coverage: the Russian
 * interface must not fall back to a system font. All three faces are
 * self-hosted by next/font with the cyrillic subset explicitly requested.
 *
 * G2 — body face switched from Onest to Golos Text: a free (SIL OFL) geometric
 * grotesk in the style the reference site (cambridgeonline.uz, itself running
 * the paid Aeonik) uses, chosen specifically because its `latin` subset's own
 * unicode-range explicitly includes U+02BB–02BC — the Uzbek ʻ/ʼ modifier
 * letters (o', g') — confirmed against the live Google Fonts CSS2 response,
 * not assumed.
 */

export const display = Unbounded({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['500', '600', '700'],
  variable: '--font-unbounded',
  display: 'swap',
})

export const sans = Golos_Text({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-golos',
  display: 'swap',
})

export const mono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const fontVariables = `${display.variable} ${sans.variable} ${mono.variable}`

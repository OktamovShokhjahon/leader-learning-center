/**
 * A short, recognisable label for the "Faol qurilmalar" list (TZ §8, PIC 10).
 *
 * The point of that list is that a person can spot a session that is not
 * theirs and end it. A raw user-agent string does not support that decision —
 * "Chrome · Windows" does. The full user agent is still stored server-side on
 * the session for audit.
 */
const BROWSERS: [RegExp, string][] = [
  [/\bEdg\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bYaBrowser\//, 'Yandex Browser'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bFirefox\//, 'Firefox'],
  [/\bChrome\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
]

const PLATFORMS: [RegExp, string][] = [
  [/\bWindows\b/, 'Windows'],
  [/\bAndroid\b/, 'Android'],
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
]

export function describeDevice(userAgent: string): string {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1]
  const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1]

  if (browser && platform) return `${browser} · ${platform}`
  return browser ?? platform ?? ''
}

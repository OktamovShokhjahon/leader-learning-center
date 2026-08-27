/**
 * G1 — `dd.MM.yyyy` everywhere, including places that never touch React (CSV
 * exports, the PDF receipt). No dependency: the pattern itself doesn't vary
 * by locale, only weekday/month *names* would, and nothing here prints those.
 */
export function formatDdMmYyyy(value: Date | string | number): string {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const d = String(date.getUTCDate()).padStart(2, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${d}.${m}.${date.getUTCFullYear()}`
}

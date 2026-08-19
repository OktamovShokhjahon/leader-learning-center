import { SITE } from './site'
import { getBranches } from './branches'

/**
 * TZ §6.2 §3 — the numbers strip.
 *
 * `years` and `branches` are derived from data we actually hold, so they are
 * always true. `graduates` and `averageBand` are claims about the business that
 * only the client can make: they stay `null` until supplied (§31), and the
 * section simply omits any stat whose value is null rather than inventing one.
 */
export type Stat = {
  key: 'years' | 'graduates' | 'band' | 'branches'
  value: number | null
  suffix?: string
  decimals?: number
}

export function getStats(): Stat[] {
  const years = new Date().getFullYear() - SITE.foundedYear

  return [
    { key: 'years', value: years, suffix: '+' },
    { key: 'graduates', value: null, suffix: '+' },
    { key: 'band', value: null, decimals: 1 },
    { key: 'branches', value: getBranches().length },
  ]
}

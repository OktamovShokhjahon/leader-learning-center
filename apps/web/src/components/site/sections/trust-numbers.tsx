import { getTranslations, getLocale } from 'next-intl/server'
import { ShieldCheck } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { pick } from '@leader/shared/locales'
import { ACCREDITATIONS } from '@/content/site'
import { getStats } from '@/content/stats'
import { Section } from '@/components/ui/section'
import { CountUp } from '../count-up'
import { Reveal } from '../reveal'

/**
 * TZ §6.2 §2 — trust bar.
 * These accreditations are rendered from `ACCREDITATIONS`, every entry of which
 * is currently flagged `unconfirmed`. §31 Q10 must be answered before launch:
 * publishing a lapsed Cambridge/IDP/British Council status would be a false claim.
 */
export async function TrustBar() {
  const t = await getTranslations('home.trust')
  const locale = (await getLocale()) as Locale

  return (
    <section className="border-y border-border-subtle bg-surface/60 py-8">
      <div className="container-site">
        <p className="mb-5 text-center text-2xs font-medium uppercase tracking-[0.14em] text-ink-muted">
          {t('title')}
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {ACCREDITATIONS.map((item) => (
            <li
              key={item.key}
              className="inline-flex items-center gap-2.5 text-xs font-medium text-ink-soft dark:text-navy-100"
            >
              <ShieldCheck className="size-4.5 shrink-0 text-glaze-600" aria-hidden />
              {pick(item.label, locale)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * TZ §6.2 §3 — numbers with count-up on scroll. Stats whose value the client has
 * not yet supplied are omitted entirely rather than shown as a placeholder
 * number, so the section never states something untrue.
 */
export async function Numbers() {
  const t = await getTranslations('home.numbers')
  const stats = getStats().filter((stat) => stat.value !== null)

  if (stats.length === 0) return null

  return (
    <Section className="py-14 md:py-20">
      <div className="container-site">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {stats.map((stat, index) => (
            <Reveal as="li" key={stat.key} delay={index * 0.08} className="flex flex-col gap-2">
              <span className="font-display text-2xl font-semibold text-navy-600 md:text-3xl dark:text-aqua-300">
                <CountUp
                  to={stat.value as number}
                  decimals={stat.decimals ?? 0}
                  suffix={stat.suffix ?? ''}
                />
              </span>
              <span className="text-xs text-ink-soft dark:text-navy-200">{t(stat.key)}</span>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  )
}

import { getTranslations, getLocale } from 'next-intl/server'
import { MapPin, Phone, Clock, ArrowRight, ChevronDown } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { pick } from '@leader/shared/locales'
import { Link } from '@/i18n/navigation'
import { getBranches } from '@/content/branches'
import { getCourse } from '@/content/courses'
import { Section, SectionHeading } from '@/components/ui/section'
import { Reveal } from '../reveal'

/** TZ §6.2 §11 — branch cards. Each branch also has its own page (§5.3). */
export async function BranchesSection({ heading = true }: { heading?: boolean } = {}) {
  const t = await getTranslations('home.branches')
  const locale = (await getLocale()) as Locale
  const branches = getBranches()

  return (
    <Section id="branches">
      <div className="container-site">
        {heading ? <SectionHeading eyebrow={t('eyebrow')} title={t('title')} /> : null}

        <ul className="grid gap-5 md:grid-cols-2">
          {branches.map((branch, index) => (
            <Reveal
              as="li"
              key={branch.slug}
              delay={index * 0.08}
              className="flex flex-col overflow-hidden rounded-card border border-border-subtle bg-surface shadow-raise"
            >
              {/* §5.2 — each branch shifts the signature gradient's hue */}
              <div
                className="gradient-glaze h-2"
                style={branch.accentHue ? { filter: `hue-rotate(${branch.accentHue}deg)` } : undefined}
              />

              <div className="flex flex-1 flex-col gap-4 p-6">
                <h3 className="font-display text-lg text-ink dark:text-white">
                  {pick(branch.name, locale)}
                </h3>

                <ul className="flex flex-col gap-2.5 text-xs text-ink-soft dark:text-navy-200">
                  <li className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-glaze-600" aria-hidden />
                    {pick(branch.address, locale)}
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Phone className="size-4 shrink-0 text-glaze-600" aria-hidden />
                    <a href={`tel:${branch.phones[0]?.replace(/\s/g, '')}`} className="font-mono hover:text-navy-700">
                      {branch.phones[0]}
                    </a>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Clock className="size-4 shrink-0 text-glaze-600" aria-hidden />
                    {pick(branch.workingHours, locale)}
                  </li>
                </ul>

                <div className="flex flex-wrap gap-1.5">
                  {branch.courseSlugs.slice(0, 5).map((slug) => {
                    const course = getCourse(slug)
                    if (!course) return null
                    return (
                      <span
                        key={slug}
                        className="rounded-pill bg-glaze-50 px-2.5 py-1 text-2xs text-glaze-800 dark:bg-navy-800 dark:text-glaze-200"
                      >
                        {pick(course.name, locale)}
                      </span>
                    )
                  })}
                  {branch.courseSlugs.length > 5 ? (
                    <span className="rounded-pill bg-navy-50 px-2.5 py-1 text-2xs text-ink-muted dark:bg-navy-800">
                      +{branch.courseSlugs.length - 5}
                    </span>
                  ) : null}
                </div>

                <Link
                  href={`/branches/${branch.slug}`}
                  className="mt-auto inline-flex items-center gap-1.5 pt-2 text-xs font-medium text-glaze-700 hover:gap-2.5 dark:text-glaze-300"
                >
                  {t('coursesHere')}
                  <ArrowRight className="size-4 transition-all" aria-hidden />
                </Link>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  )
}

const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const

/**
 * TZ §6.2 §13 — FAQ accordion.
 *
 * Built on native <details>/<summary>: keyboard-operable and screen-reader
 * correct with zero JavaScript, which also keeps the Lighthouse budget (§6.3).
 * The matching schema.org FAQPage JSON-LD is emitted by the page.
 */
export async function FaqSection({ heading = true }: { heading?: boolean } = {}) {
  const t = await getTranslations('home.faq')
  const tf = await getTranslations('faqItems')

  return (
    <Section id="faq" className="bg-surface/60">
      <div className="container-site max-w-3xl">
        {heading ? <SectionHeading eyebrow={t('eyebrow')} title={t('title')} align="center" /> : null}

        <ul className="flex flex-col gap-3">
          {FAQ_KEYS.map((key, index) => (
            <Reveal as="li" key={key} delay={Math.min(index, 5) * 0.05}>
              <details className="group rounded-card border border-border-subtle bg-background transition-colors open:border-glaze-300">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-medium text-ink marker:hidden dark:text-white [&::-webkit-details-marker]:hidden">
                  {tf(`${key}.q`)}
                  <ChevronDown
                    className="size-5 shrink-0 text-glaze-600 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="px-5 pb-5 text-xs leading-relaxed text-ink-soft dark:text-navy-200">
                  {tf(`${key}.a`)}
                </p>
              </details>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  )
}

export { FAQ_KEYS }

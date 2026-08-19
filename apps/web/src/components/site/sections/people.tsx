import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowRight, Trophy, MessageSquareQuote, UserRound, Newspaper } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { pick } from '@leader/shared/locales'
import { Link } from '@/i18n/navigation'
import { getTeachers, RESULTS, TESTIMONIALS } from '@/content/people'
import { Section, SectionHeading } from '@/components/ui/section'
import { EmptyState } from '@/components/ui/empty-state'
import { Reveal } from '../reveal'

/**
 * TZ §6.2 §6 — the results wall, "the strongest conversion element".
 *
 * It renders nothing but a designed empty state until the client supplies real
 * band scores (§31 Q15). Inventing exam results would be a misrepresentation,
 * so `RESULTS` ships empty on purpose.
 */
export async function ResultsSection({ heading = true }: { heading?: boolean } = {}) {
  const t = await getTranslations('home.results')
  const locale = (await getLocale()) as Locale

  return (
    <Section id="natijalar" className="bg-surface/60">
      <div className="container-site">
        {heading ? <SectionHeading eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} /> : null}

        {RESULTS.length === 0 ? (
          <EmptyState Icon={Trophy} title={t('empty')} />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {RESULTS.map((result, index) => (
              <Reveal
                as="li"
                key={result.id}
                delay={Math.min(index, 5) * 0.06}
                className="flex flex-col gap-3 rounded-card border border-border-subtle bg-background p-5"
              >
                <span className="gradient-glaze-text font-display text-xl font-semibold">
                  {result.achievement}
                </span>
                <span className="text-sm font-medium text-ink dark:text-white">
                  {result.studentName}
                </span>
                {result.quote ? (
                  <p className="text-xs leading-relaxed text-ink-soft dark:text-navy-200">
                    {pick(result.quote, locale)}
                  </p>
                ) : null}
                <span className="mt-auto font-mono text-2xs text-ink-muted">{result.year}</span>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

/** TZ §6.2 §7 — teacher cards. */
export async function TeachersSection({ limit, heading = true }: { limit?: number; heading?: boolean }) {
  const t = await getTranslations('home.teachers')
  const tc = await getTranslations('common')
  const locale = (await getLocale()) as Locale
  const teachers = limit ? getTeachers().slice(0, limit) : getTeachers()

  return (
    <Section id="oqituvchilar">
      <div className="container-site">
        {heading ? (
          <SectionHeading
            eyebrow={t('eyebrow')}
            title={t('title')}
            action={
              limit ? (
                <Link
                  href="/oqituvchilar"
                  className="inline-flex h-12 items-center gap-2 rounded-pill border border-navy-600/25 px-5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
                >
                  {tc('allTeachers')}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : undefined
            }
          />
        ) : null}

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {teachers.map((teacher, index) => (
            <Reveal
              as="li"
              key={teacher.slug}
              delay={Math.min(index, 5) * 0.06}
              className="group flex flex-col overflow-hidden rounded-card border border-border-subtle bg-surface shadow-raise transition-all duration-200 hover:-translate-y-1 hover:shadow-float"
            >
              {/* Photos arrive with the client's photo session (§31 Q15). */}
              <div className="flex aspect-[4/5] items-center justify-center bg-gradient-to-br from-navy-100 to-glaze-100 dark:from-navy-800 dark:to-navy-700">
                <UserRound className="size-14 text-navy-300 dark:text-navy-500" aria-hidden />
              </div>
              <div className="flex flex-col gap-1.5 p-5">
                <h3 className="font-display text-base text-ink dark:text-white">
                  {teacher.fullName}
                </h3>
                <p className="text-xs text-glaze-700 dark:text-glaze-300">
                  {pick(teacher.role, locale)}
                </p>
                {teacher.experienceYears > 0 ? (
                  <p className="font-mono text-2xs text-ink-muted">
                    {t('experience', { years: teacher.experienceYears })}
                  </p>
                ) : null}
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  )
}

/** TZ §6.2 §10 — text and video reviews (video plays through the protected player, §17). */
export async function TestimonialsSection({ heading = true }: { heading?: boolean } = {}) {
  const t = await getTranslations('home.testimonials')
  const locale = (await getLocale()) as Locale

  return (
    <Section className="bg-surface/60">
      <div className="container-site">
        {heading ? <SectionHeading eyebrow={t('eyebrow')} title={t('title')} /> : null}

        {TESTIMONIALS.length === 0 ? (
          <EmptyState Icon={MessageSquareQuote} title={t('empty')} />
        ) : (
          <ul className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((item, index) => (
              <Reveal
                as="li"
                key={item.id}
                delay={Math.min(index, 5) * 0.06}
                className="flex flex-col gap-4 rounded-card border border-border-subtle bg-background p-6"
              >
                <MessageSquareQuote className="size-6 text-glaze-500" aria-hidden />
                <p className="flex-1 text-sm leading-relaxed text-ink-soft dark:text-navy-200">
                  {pick(item.body, locale)}
                </p>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink dark:text-white">
                    {item.authorName}
                  </span>
                  <span className="text-2xs text-ink-muted">{pick(item.role, locale)}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

/** TZ §6.2 §12 — three latest posts. */
export async function NewsSection({ heading = true }: { heading?: boolean } = {}) {
  const t = await getTranslations('home.news')

  return (
    <Section id="yangiliklar">
      <div className="container-site">
        {heading ? <SectionHeading eyebrow={t('eyebrow')} title={t('title')} /> : null}
        <EmptyState Icon={Newspaper} title={t('empty')} />
      </div>
    </Section>
  )
}

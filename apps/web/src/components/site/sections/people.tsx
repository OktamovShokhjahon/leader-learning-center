import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowRight, Trophy, MessageSquareQuote, Award } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { pick } from '@leader/shared/locales'
import { Link } from '@/i18n/navigation'
import { getResults, TESTIMONIALS } from '@/content/people'
import { fetchTeachers, fetchCourses } from '@/content/remote'
import { Section, SectionHeading } from '@/components/ui/section'
import { EmptyState } from '@/components/ui/empty-state'
import { CeramicTile, initials } from '@/components/ui/ceramic-tile'
import { Reveal } from '../reveal'
import { ResultsWall } from './results-wall'

/**
 * TZ §6.2 §6 — the results wall, "the strongest conversion element".
 *
 * The wall itself is a client component so it can filter by course without a
 * round trip. Localised strings are resolved here, on the server, and handed
 * over already translated — the client half never touches next-intl.
 */
export async function ResultsSection({
  heading = true,
  limit,
}: {
  heading?: boolean
  limit?: number
}) {
  const t = await getTranslations('home.results')
  const tc = await getTranslations('common')
  const locale = (await getLocale()) as Locale

  const all = getResults()
  const results = limit ? all.slice(0, limit) : all

  // Course names come from the API now, so resolve the catalogue once rather
  // than awaiting inside a map.
  const catalogue = await fetchCourses()
  const entries = results.map((result) => ({
    id: result.id,
    studentName: result.studentName,
    achievement: result.achievement,
    year: result.year,
    courseSlug: result.courseSlug,
    courseName: pick(catalogue.find((course) => course.slug === result.courseSlug)?.name, locale) || result.courseSlug,
    quote: result.quote ? pick(result.quote, locale) : null,
  }))

  return (
    <Section id="results" className="bg-surface/60">
      <div className="container-site">
        {heading ? (
          <SectionHeading
            eyebrow={t('eyebrow')}
            title={t('title')}
            subtitle={t('subtitle')}
            action={
              limit && all.length > limit ? (
                <Link
                  href="/results"
                  className="inline-flex h-12 items-center gap-2 rounded-pill border border-navy-600/25 px-5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
                >
                  {tc('learnMore')}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : undefined
            }
          />
        ) : null}

        {entries.length === 0 ? (
          <EmptyState Icon={Trophy} title={t('empty')} />
        ) : (
          <ResultsWall entries={entries} allLabel={t('filterAll')} />
        )}
      </div>
    </Section>
  )
}

/** TZ §6.2 §7 — teacher cards. */
export async function TeachersSection({
  limit,
  heading = true,
}: {
  limit?: number
  heading?: boolean
}) {
  const t = await getTranslations('home.teachers')
  const tc = await getTranslations('common')
  const locale = (await getLocale()) as Locale
  const all = await fetchTeachers()
  const teachers = limit ? all.slice(0, limit) : all

  return (
    <Section id="teachers">
      <div className="container-site">
        {heading ? (
          <SectionHeading
            eyebrow={t('eyebrow')}
            title={t('title')}
            action={
              limit && all.length > limit ? (
                <Link
                  href="/teachers"
                  className="inline-flex h-12 items-center gap-2 rounded-pill border border-navy-600/25 px-5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
                >
                  {tc('allTeachers')}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : undefined
            }
          />
        ) : null}

        {teachers.length === 0 ? (
          <EmptyState Icon={Award} title={tc('contentPending')} />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {teachers.map((teacher, index) => (
              <Reveal
                as="li"
                key={teacher.slug}
                delay={Math.min(index, 5) * 0.06}
                className="group flex h-full flex-col overflow-hidden rounded-card border border-border-subtle bg-surface transition-all duration-200 hover:-translate-y-1 hover:border-glaze-300 hover:shadow-float"
              >
                <div className="flex gap-4 p-5">
                  {/* The centre's own photograph when there is one; the woven
                      tile when there is not, so a card is never a grey box.
                      Plain <img>: the API host is configured at runtime and
                      cannot be listed in next/image's remote patterns. */}
                  {teacher.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={teacher.photo}
                      alt=""
                      loading="lazy"
                      className="size-20 shrink-0 rounded-input object-cover"
                    />
                  ) : (
                    <CeramicTile
                      seed={teacher.slug}
                      label={initials(teacher.fullName)}
                      dense
                      className="size-20 shrink-0 rounded-input"
                    />
                  )}
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="font-display text-base leading-tight tracking-[-0.02em] text-ink dark:text-white">
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
                </div>

                <p className="flex-1 px-5 text-xs leading-relaxed text-ink-soft dark:text-navy-200">
                  {pick(teacher.bio, locale)}
                </p>

                <ul className="flex flex-wrap gap-1.5 p-5 pt-4">
                  {teacher.certificates.map((certificate) => (
                    <li
                      key={certificate}
                      className="rounded-pill bg-glaze-50 px-2.5 py-1 font-mono text-2xs text-glaze-800 dark:bg-navy-800 dark:text-glaze-200"
                    >
                      {certificate}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </ul>
        )}
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
                <div className="flex items-center gap-3 border-t border-border-subtle pt-4">
                  <CeramicTile
                    seed={item.id}
                    label={initials(item.authorName)}
                    dense
                    className="size-10 shrink-0 rounded-pill"
                  />
                  <span className="flex flex-col">
                    <span className="text-xs font-medium text-ink dark:text-white">
                      {item.authorName}
                    </span>
                    <span className="text-2xs text-ink-muted">{pick(item.role, locale)}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

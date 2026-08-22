import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Check, Clock, Users, BarChart3, GraduationCap, ArrowRight } from 'lucide-react'
import { isLocale, LOCALES, pick } from '@leader/shared/locales'
import { formatSoum } from '@leader/shared/money'
import { Link } from '@/i18n/navigation'
import { getCourse, getCourses, courseGradient } from '@/content/courses'
import { PageHeader } from '@/components/site/page-header'
import { Section, SectionHeading } from '@/components/ui/section'
import { CourseCard } from '@/components/site/sections/courses'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { JsonLd, courseJsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string; slug: string }> }

/** TZ §6.3 — every course, in every locale, in the static build and the sitemap. */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    getCourses().map((course) => ({ locale, slug: course.slug })),
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const course = getCourse(slug)
  if (!course) return {}

  return pageMetadata({
    locale,
    path: `/courses/${slug}`,
    title: pick(course.name, locale),
    description: pick(course.description, locale),
  })
}

export default async function CourseDetailPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const course = getCourse(slug)
  if (!course) notFound()

  const t = await getTranslations('pages.courseDetail')
  const tc = await getTranslations('common')
  const tn = await getTranslations('nav')

  const related = getCourses()
    .filter((item) => item.slug !== course.slug)
    .slice(0, 3)

  const details = [
    { label: tc('level'), value: pick(course.level, locale), Icon: GraduationCap },
    { label: tc('age'), value: pick(course.ageRange, locale), Icon: Users },
    {
      label: tc('duration'),
      value: `${course.durationMonths} ${tc('months')}`,
      Icon: Clock,
    },
    {
      label: tc('price'),
      value: `${formatSoum(course.priceMonthly, locale)} / ${tc('perMonth')}`,
      Icon: BarChart3,
    },
  ]

  return (
    <>
      <JsonLd data={courseJsonLd(course, locale)} />
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: tn('courses'), path: '/courses' },
          { name: pick(course.name, locale), path: `/courses/${course.slug}` },
        ])}
      />

      <PageHeader
        title={pick(course.name, locale)}
        subtitle={pick(course.tagline, locale)}
        breadcrumb={[
          { label: tn('courses'), href: '/courses' },
          { label: pick(course.name, locale) },
        ]}
      />

      <Section>
        <div className="container-site grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4">
              <h2 className="text-lg text-ink md:text-xl dark:text-white">{t('programme')}</h2>
              <p className="text-sm leading-relaxed text-ink-soft dark:text-navy-200">
                {pick(course.description, locale)}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-lg text-ink md:text-xl dark:text-white">{t('whatYouGet')}</h2>
              <ul className="flex flex-col gap-3">
                {course.highlights.map((highlight, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-ink-soft dark:text-navy-200">
                    <span className="mt-0.5 inline-flex size-5.5 shrink-0 items-center justify-center rounded-pill bg-glaze-100 text-glaze-700 dark:bg-navy-800 dark:text-glaze-300">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    {pick(highlight, locale)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sticky detail card */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-raise">
              <div className={`relative h-24 bg-gradient-to-br ${courseGradient(course.accent)}`}>
                <div aria-hidden className="tile-star absolute inset-0 text-white/10" />
              </div>

              <dl className="flex flex-col gap-4 p-6">
                {details.map((detail) => (
                  <div key={detail.label} className="flex items-center justify-between gap-4">
                    <dt className="inline-flex items-center gap-2 text-xs text-ink-muted">
                      <detail.Icon className="size-4" aria-hidden />
                      {detail.label}
                    </dt>
                    <dd className="text-right text-xs font-medium text-ink dark:text-white">
                      {detail.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="border-t border-border-subtle p-6">
                <p className="mb-1 font-display text-base text-ink dark:text-white">
                  {t('applyTitle')}
                </p>
                <p className="mb-4 text-xs text-ink-soft dark:text-navy-200">{t('applyBody')}</p>
                <Link
                  href={`/apply?course=${course.slug}`}
                  className="gradient-glaze flex h-13 items-center justify-center gap-2 rounded-pill text-sm font-medium text-white shadow-raise transition-all hover:shadow-float hover:brightness-110"
                >
                  {tc('apply')}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </Section>

      <Section className="bg-surface/60">
        <div className="container-site">
          <SectionHeading title={t('otherCourses')} />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item, index) => (
              <CourseCard key={item.slug} course={item} index={index} />
            ))}
          </ul>
        </div>
      </Section>

      <LeadFormSection />
    </>
  )
}

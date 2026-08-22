import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowRight, Clock, Users, BarChart3 } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { pick } from '@leader/shared/locales'
import { formatSoum } from '@leader/shared/money'
import { Link } from '@/i18n/navigation'
import { getCourses, courseGradient, type Course } from '@/content/courses'
import { Section, SectionHeading } from '@/components/ui/section'
import { Reveal } from '../reveal'

export async function CourseCard({ course, index = 0 }: { course: Course; index?: number }) {
  const t = await getTranslations('common')
  const locale = (await getLocale()) as Locale

  return (
    <Reveal as="li" delay={Math.min(index, 5) * 0.06} className="h-full">
      <Link
        href={`/courses/${course.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-card border border-border-subtle bg-surface transition-all duration-200 hover:-translate-y-1 hover:border-glaze-300 hover:shadow-float"
      >
        {/*
         * The cover is a glazed tile: the course accent seen through the girih
         * lattice, with the star scaled down so a 96px cell does not swamp a
         * card-width band. The lattice brightens on hover — the only motion the
         * card has, standing in for a photograph the client has not supplied.
         */}
        <div
          className={`relative h-28 overflow-hidden bg-gradient-to-br ${courseGradient(course.accent)}`}
        >
          <div
            aria-hidden
            className="tile-star tile-star-sm absolute inset-0 text-white/14 transition-colors duration-300 group-hover:text-white/24"
          />
          <span className="absolute bottom-3 left-5 rounded-pill border border-white/30 bg-navy-950/25 px-3 py-1 text-2xs font-medium text-white backdrop-blur-sm">
            {pick(course.level, locale)}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <h3 className="font-display text-lg leading-tight tracking-[-0.02em] text-ink dark:text-white">
            {pick(course.name, locale)}
          </h3>
          <p className="flex-1 text-xs leading-relaxed text-ink-soft dark:text-navy-200">
            {pick(course.tagline, locale)}
          </p>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-2xs text-ink-muted">
            <li className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden />
              {course.durationMonths} {t('months')}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <BarChart3 className="size-3.5" aria-hidden />
              {t('lessonsPerWeek', { count: course.lessonsPerWeek })}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              {t('groupSize', { count: course.groupSize })}
            </li>
          </ul>

          <div className="mt-1 flex items-end justify-between gap-3 border-t border-border-subtle pt-4">
            <div className="flex flex-col">
              <span className="font-mono text-sm font-medium text-navy-700 dark:text-aqua-300">
                {formatSoum(course.priceMonthly, locale)}
              </span>
              <span className="text-2xs text-ink-muted">{t('perMonth')}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-glaze-700 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-glaze-300">
              {t('learnMore')}
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </div>
        </div>
      </Link>
    </Reveal>
  )
}

/** TZ §6.2 §4 — course grid with gradient covers, level, duration, price. */
export async function CoursesSection({
  limit,
  heading = true,
}: {
  limit?: number
  /** The index page already states the title in its PageHeader. */
  heading?: boolean
}) {
  const t = await getTranslations('home.courses')
  const tc = await getTranslations('common')
  const courses = limit ? getCourses().slice(0, limit) : getCourses()

  return (
    <Section id="courses">
      <div className="container-site">
        {heading ? (
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('title')}
          subtitle={t('subtitle')}
          action={
            limit ? (
              <Link
                href="/courses"
                className="inline-flex h-12 items-center gap-2 rounded-pill border border-navy-600/25 px-5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
              >
                {tc('allCourses')}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : undefined
          }
        />
        ) : null}

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, index) => (
            <CourseCard key={course.slug} course={course} index={index} />
          ))}
        </ul>
      </div>
    </Section>
  )
}

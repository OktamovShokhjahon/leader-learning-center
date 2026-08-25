import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import { pick, type Locale } from '@leader/shared/locales'
import { Link } from '@/i18n/navigation'
import { } from '@/content/courses'
import { fetchCourses } from '@/content/remote'
import { GlazeCanvas } from '../glaze-canvas'
import { HeroIntro } from './hero-intro'
import { GirihStar } from '@/components/ui/girih-star'
import { HeroHeadline } from '../hero-headline'
import { ScrollCue } from '../scroll-cue'

/**
 * TZ §6.2 §1 / §25.4 — the hero.
 *
 * The composition is a *pishtaq*, the tall rectangular portal that fronts every
 * Khiva madrasa: a doubled rule inset from the viewport edge with the content
 * recessed inside it. Behind it the living glaze runs under a girih lattice, so
 * the colour reads as moving behind ceramic rather than as a gradient wash.
 *
 * Layer order matters for LCP: the static gradient paints first and alone is a
 * complete background, so the headline never waits on WebGL. The shader is an
 * enhancement over a page that is already correct.
 */
export async function Hero() {
  const t = await getTranslations('home.hero')
  const tc = await getTranslations('common')
  const locale = (await getLocale()) as Locale
  const courses = (await fetchCourses()).slice(0, 6)

  return (
    <section className="relative isolate flex min-h-[100svh] items-stretch overflow-hidden p-2.5 pt-20 sm:p-4 sm:pt-24">
      {/* 1 — static glaze, always painted */}
      <div aria-hidden className="gradient-glaze absolute inset-0 -z-40" />
      {/* 2 — the living glaze */}
      <GlazeCanvas className="absolute inset-0 -z-30 size-full" />
      {/* 3 — the ceramic the colour moves behind */}
      <div aria-hidden className="tile-star absolute inset-0 -z-20 text-white/[0.08]" />

      {/* The portal */}
      <div className="portal relative flex w-full flex-col justify-between rounded-[18px] px-6 py-12 sm:px-10 sm:py-14 lg:px-16 lg:py-16">
        <HeroIntro>
          <p className="flex items-center gap-3 text-2xs font-medium uppercase tracking-[0.2em] text-white/70">
            <GirihStar className="size-3.5 text-clay-300" />
            {t('eyebrow')}
          </p>

          <HeroHeadline text={t('title')} className="display-hero max-w-[16ch] text-white" />

          <p className="max-w-lg text-base leading-relaxed text-white/75">{t('subtitle')}</p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/apply"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-pill bg-clay-500 px-8 text-sm font-medium text-white transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-clay-400 active:scale-[0.98]"
            >
              {t('ctaPrimary')}
              <ArrowRight
                className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
            <Link
              href="/apply?trial=1"
              className="inline-flex h-14 items-center justify-center rounded-pill border border-white/35 px-8 text-sm font-medium text-white transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/12 active:scale-[0.98]"
            >
              {t('ctaSecondary')}
            </Link>
          </div>
        </HeroIntro>

        {/*
         * The frieze along the portal's base — the course list as a tiled band,
         * the way a doorway carries an inscription. It is real navigation, and
         * it puts the whole offering in the first screen without a second row
         * of buttons competing with the two calls to action above.
         */}
        <nav aria-label={tc('allCourses')} className="mt-14 border-t border-white/15 pt-6">
          <ul className="flex flex-wrap items-center gap-x-1 gap-y-2">
            {courses.map((course) => (
              <li key={course.slug}>
                <Link
                  href={`/courses/${course.slug}`}
                  className="inline-flex items-center gap-2.5 rounded-pill px-3 py-2 text-xs text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white"
                >
                  <GirihStar className="size-2.5 text-white/35" strokeWidth={2.4} />
                  {pick(course.name, locale)}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/courses"
                className="group inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-xs font-medium text-clay-200 transition-colors duration-200 hover:text-clay-100"
              >
                {tc('allCourses')}
                <ArrowRight
                  className="size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          </ul>
        </nav>

        <ScrollCue />
      </div>
    </section>
  )
}

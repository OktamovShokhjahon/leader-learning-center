import { getTranslations } from 'next-intl/server'
import { ArrowRight, Phone, Sparkles } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { SITE } from '@/content/site'
import { GlazeCanvas } from '../glaze-canvas'
import { HeroIntro } from './hero-intro'

/**
 * TZ §6.2 §1 — hero: headline, sub-headline, two CTAs, ambient animated
 * background (§25.4), branch/phone quick contact.
 *
 * The static CSS gradient sits underneath the canvas at all times, so the
 * section is fully painted even before (or without) WebGL — this keeps LCP fast
 * and satisfies the reduced-motion fallback in one mechanism.
 */
export async function Hero() {
  const t = await getTranslations('home.hero')

  return (
    <section className="relative isolate flex min-h-[92svh] items-center overflow-hidden pt-24">
      {/* Layer 1 — static gradient, always present */}
      <div aria-hidden className="gradient-glaze absolute inset-0 -z-30" />
      {/* Layer 2 — living glaze shader, fades in when it can run */}
      <GlazeCanvas className="absolute inset-0 -z-20 size-full" />
      {/* Layer 3 — the ceramic tile grid the colour appears to move behind */}
      <div
        aria-hidden
        className="tile-grid absolute inset-0 -z-10 text-white/[0.07]"
        style={{
          maskImage: 'radial-gradient(120% 90% at 50% 40%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(120% 90% at 50% 40%, black 40%, transparent 100%)',
        }}
      />

      <div className="container-site relative py-16 md:py-24">
        <HeroIntro>
          <p className="flex items-center gap-2.5 text-2xs font-medium uppercase tracking-[0.14em] text-white/75">
            <Sparkles className="size-3.5 text-aqua-300" aria-hidden />
            {t('eyebrow')}
          </p>

          <h1 className="max-w-4xl text-3xl text-white md:text-4xl">{t('title')}</h1>

          <p className="max-w-xl text-base leading-relaxed text-white/80">{t('subtitle')}</p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/royxatdan-otish"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-pill bg-white px-8 text-sm font-medium text-navy-700 shadow-float transition-all hover:bg-sand"
            >
              {t('ctaPrimary')}
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180"
                aria-hidden
              />
            </Link>
            <Link
              href="/royxatdan-otish?trial=1"
              className="inline-flex h-14 items-center justify-center rounded-pill border border-white/30 bg-white/10 px-8 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              {t('ctaSecondary')}
            </Link>
            <a
              href={`tel:${SITE.phones[0]?.replace(/\s/g, '')}`}
              className="inline-flex h-14 items-center justify-center gap-2.5 rounded-pill px-4 font-mono text-xs text-white/80 transition-colors hover:text-white sm:px-6"
            >
              <Phone className="size-4" aria-hidden />
              {SITE.phones[0]}
            </a>
          </div>
        </HeroIntro>
      </div>
    </section>
  )
}

import { getTranslations } from 'next-intl/server'
import { CalendarCheck, Library, Trophy, Wallet, ArrowRight, type LucideIcon } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { SITE } from '@/content/site'
import { Eyebrow, Section } from '@/components/ui/section'
import { Reveal } from '../reveal'

const FEATURES: { key: string; Icon: LucideIcon }[] = [
  { key: 'attendance', Icon: CalendarCheck },
  { key: 'library', Icon: Library },
  { key: 'ranking', Icon: Trophy },
  { key: 'payments', Icon: Wallet },
]

/**
 * TZ §6.2 §9 — personal cabinet promo. This preserves the current site's
 * `SHAXSIY KABINET` entry point (BIG_PROJECT.pdf PIC 1).
 *
 * The mock shown here is a schematic of the real cabinet, not a screenshot;
 * real screenshots replace it once Phase 7 ships.
 */
export async function CabinetSection() {
  const t = await getTranslations('home.cabinet')

  return (
    <Section className="relative overflow-hidden bg-navy-900">
      <div aria-hidden className="tile-star pointer-events-none absolute inset-0 text-white/[0.04]" />
      <div
        aria-hidden
        className="absolute -right-40 -top-40 size-[32rem] rounded-full bg-glaze-600/20 blur-3xl"
      />

      <div className="container-site relative grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Eyebrow tone="dark">{t('eyebrow')}</Eyebrow>
          <h2 className="display-section max-w-lg text-white">{t('title')}</h2>
          <p className="max-w-md text-sm leading-relaxed text-white/70">{t('subtitle')}</p>

          <ul className="flex flex-col gap-3">
            {FEATURES.map((feature) => (
              <li key={feature.key} className="flex items-center gap-3 text-sm text-white/85">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-input bg-white/10 text-aqua-300">
                  <feature.Icon className="size-4.5" aria-hidden />
                </span>
                {t(`features.${feature.key}`)}
              </li>
            ))}
          </ul>

          <Link
            href={SITE.cabinetPath}
            className="group inline-flex h-14 w-fit items-center gap-2 rounded-pill bg-white px-8 text-sm font-medium text-navy-700 shadow-float transition-colors hover:bg-sand"
          >
            {t('cta')}
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </div>

        <Reveal className="relative">
          <CabinetMock />
        </Reveal>
      </div>
    </Section>
  )
}

/**
 * A schematic of the attendance calendar from PIC 2: absences as red circles.
 * Built in markup rather than as an image so it stays sharp, themable and
 * weightless — and so it cannot go stale against the real product.
 */
function CabinetMock() {
  const days = Array.from({ length: 30 }, (_, index) => index + 1)
  const absent = new Set([4, 11, 19])
  const late = new Set([23])

  return (
    <div className="panel-frame rounded-card bg-navy-800/70 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-sm text-white">Sentabr 2026</span>
        <span className="rounded-pill bg-success/15 px-3 py-1 font-mono text-2xs text-success">
          90%
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5" aria-hidden>
        {days.map((day) => (
          <span
            key={day}
            className={[
              'flex aspect-square items-center justify-center rounded-full font-mono text-2xs',
              absent.has(day)
                ? 'border-2 border-danger text-danger'
                : late.has(day)
                  ? 'border-2 border-warning text-warning'
                  : 'bg-white/8 text-white/60',
            ].join(' ')}
          >
            {day}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 text-2xs">
        <div className="flex items-center justify-between text-white/70">
          <span>General English</span>
          <span className="font-mono">14:00 — 15:30</span>
        </div>
        <div className="flex items-center justify-between text-white/50">
          <span>Kurs puli</span>
          <span className="font-mono">700 000 so&apos;m</span>
        </div>
      </div>
    </div>
  )
}

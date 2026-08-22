import { getTranslations } from 'next-intl/server'
import {
  GraduationCap,
  Users,
  LayoutDashboard,
  Eye,
  ClipboardCheck,
  Award,
  type LucideIcon,
} from 'lucide-react'
import { Section, SectionHeading } from '@/components/ui/section'
import { Reveal } from '../reveal'

const WHY_ITEMS: { key: string; Icon: LucideIcon }[] = [
  { key: 'teachers', Icon: GraduationCap },
  { key: 'groups', Icon: Users },
  { key: 'cabinet', Icon: LayoutDashboard },
  { key: 'parents', Icon: Eye },
  { key: 'mock', Icon: ClipboardCheck },
  { key: 'certificate', Icon: Award },
]

/** TZ §6.2 §5 — differentiators with icons. Deliberately unnumbered (§25.3). */
export async function WhySection() {
  const t = await getTranslations('home.why')

  return (
    <Section className="bg-surface/60">
      <div className="container-site">
        <SectionHeading eyebrow={t('eyebrow')} title={t('title')} align="center" />

        {/*
         * Six fields inside one framed panel, divided by hairlines — the same
         * ceramic logic as the stat band, so the two read as one system rather
         * than as two different card styles.
         */}
        <ul className="panel-frame-ink grid overflow-hidden rounded-card bg-background sm:grid-cols-2 lg:grid-cols-3">
          {WHY_ITEMS.map((item, index) => (
            <Reveal
              as="li"
              key={item.key}
              delay={Math.min(index, 5) * 0.06}
              className="group flex h-full flex-col gap-3.5 border-b border-border-subtle p-7 transition-colors duration-200 last:border-b-0 hover:bg-glaze-50/60 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:odd:border-r sm:border-border-subtle lg:[&:nth-last-child(-n+3)]:border-b-0 lg:odd:border-r-0 lg:[&:not(:nth-child(3n))]:border-r dark:hover:bg-navy-800/50"
            >
              <span className="inline-flex size-12 items-center justify-center rounded-input bg-glaze-50 text-glaze-700 transition-colors duration-200 group-hover:bg-glaze-100 dark:bg-navy-800 dark:text-glaze-300">
                <item.Icon className="size-5.5" aria-hidden />
              </span>
              <h3 className="font-display text-base leading-tight tracking-[-0.02em] text-ink dark:text-white">
                {t(`items.${item.key}.title`)}
              </h3>
              <p className="text-xs leading-relaxed text-ink-soft dark:text-navy-200">
                {t(`items.${item.key}.body`)}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  )
}

const HOW_STEPS = ['apply', 'trial', 'test', 'start'] as const

/**
 * TZ §6.2 §8 / §25.3 — the *only* numbered section on the page, because this
 * content genuinely is a sequence.
 */
export async function HowSection() {
  const t = await getTranslations('home.how')

  return (
    <Section>
      <div className="container-site">
        <SectionHeading eyebrow={t('eyebrow')} title={t('title')} />

        <ol className="grid gap-6 md:grid-cols-4">
          {HOW_STEPS.map((step, index) => (
            <Reveal as="li" key={step} delay={index * 0.08} className="relative flex flex-col gap-4">
              {/* connector rail */}
              {index < HOW_STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-12 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-gradient-to-r from-glaze-300 to-transparent md:block"
                />
              ) : null}

              <span className="gradient-glaze relative z-10 inline-flex size-10 items-center justify-center rounded-pill font-display text-sm font-semibold text-white shadow-raise">
                {index + 1}
              </span>
              <h3 className="font-display text-base text-ink dark:text-white">
                {t(`steps.${step}.title`)}
              </h3>
              <p className="text-xs leading-relaxed text-ink-soft dark:text-navy-200">
                {t(`steps.${step}.body`)}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  )
}

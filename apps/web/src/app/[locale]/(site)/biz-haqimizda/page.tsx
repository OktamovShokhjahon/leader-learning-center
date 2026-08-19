import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Eye, Award, HeartHandshake, type LucideIcon } from 'lucide-react'
import { isLocale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { Section, SectionHeading } from '@/components/ui/section'
import { Numbers, TrustBar } from '@/components/site/sections/trust-numbers'
import { TeachersSection } from '@/components/site/sections/people'
import { BranchesSection } from '@/components/site/sections/branches-faq'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { Reveal } from '@/components/site/reveal'
import { JsonLd, organizationJsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

const VALUES: { key: string; Icon: LucideIcon }[] = [
  { key: 'transparency', Icon: Eye },
  { key: 'quality', Icon: Award },
  { key: 'care', Icon: HeartHandshake },
]

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return pageMetadata({ locale, path: '/biz-haqimizda', namespace: 'about' })
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('pages.about')
  const tn = await getTranslations('nav')

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: tn('about'), path: '/biz-haqimizda' }])} />

      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumb={[{ label: tn('about') }]}
      />

      <Numbers />
      <TrustBar />

      <Section>
        <div className="container-site grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="flex flex-col gap-4">
            <h2 className="text-lg text-ink md:text-xl dark:text-white">{t('historyTitle')}</h2>
            <p className="text-sm leading-relaxed text-ink-soft dark:text-navy-200">
              {t('historyBody')}
            </p>
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col gap-4">
            <h2 className="text-lg text-ink md:text-xl dark:text-white">{t('missionTitle')}</h2>
            <p className="text-sm leading-relaxed text-ink-soft dark:text-navy-200">
              {t('missionBody')}
            </p>
          </Reveal>
        </div>
      </Section>

      <Section className="bg-surface/60">
        <div className="container-site">
          <SectionHeading title={t('valuesTitle')} align="center" />
          <ul className="grid gap-5 md:grid-cols-3">
            {VALUES.map((value, index) => (
              <Reveal
                as="li"
                key={value.key}
                delay={index * 0.08}
                className="flex flex-col gap-3.5 rounded-card border border-border-subtle bg-background p-6"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-input bg-glaze-50 text-glaze-700 dark:bg-navy-800 dark:text-glaze-300">
                  <value.Icon className="size-5.5" aria-hidden />
                </span>
                <h3 className="font-display text-base text-ink dark:text-white">
                  {t(`values.${value.key}.title`)}
                </h3>
                <p className="text-xs leading-relaxed text-ink-soft dark:text-navy-200">
                  {t(`values.${value.key}.body`)}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </Section>

      <TeachersSection limit={4} />
      <BranchesSection />
      <LeadFormSection />
    </>
  )
}

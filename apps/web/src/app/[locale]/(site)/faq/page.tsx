import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { JsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'
import { FaqSection, FAQ_KEYS } from '@/components/site/sections/branches-faq'
import { faqJsonLd } from '@/lib/json-ld'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return pageMetadata({ locale, path: '/faq', namespace: 'faq' })
}

export default async function FaqPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('pages.faq')
  const tn = await getTranslations('nav')
  const tf = await getTranslations('faqItems')
  const faqItems = FAQ_KEYS.map((key) => ({ question: tf(`${key}.q`), answer: tf(`${key}.a`) }))

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: tn('faq'), path: '/faq' }])} />
      <JsonLd data={faqJsonLd(faqItems)} />
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumb={[{ label: tn('faq') }]}
      />
      <FaqSection heading={false} />
      <LeadFormSection />
    </>
  )
}

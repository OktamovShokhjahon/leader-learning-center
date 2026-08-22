import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { JsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'
import { NewsSection } from '@/components/site/sections/news'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return pageMetadata({ locale, path: '/news', namespace: 'news' })
}

export default async function NewsPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('pages.news')
  const tn = await getTranslations('nav')

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: tn('news'), path: '/news' }])} />
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumb={[{ label: tn('news') }]}
      />
      <NewsSection heading={false} />
      <LeadFormSection />
    </>
  )
}

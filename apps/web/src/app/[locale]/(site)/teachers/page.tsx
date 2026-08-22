import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { TeachersSection } from '@/components/site/sections/people'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { JsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return pageMetadata({ locale, path: '/teachers', namespace: 'teachers' })
}

export default async function TeachersPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('pages.teachers')
  const tn = await getTranslations('nav')

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: tn('teachers'), path: '/teachers' }])} />
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumb={[{ label: tn('teachers') }]}
      />
      <TeachersSection />
      <LeadFormSection />
    </>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { CoursesSection } from '@/components/site/sections/courses'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { JsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return pageMetadata({ locale, path: '/courses', namespace: 'courses' })
}

export default async function CoursesPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('pages.courses')
  const tn = await getTranslations('nav')

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: tn('courses'), path: '/courses' },
        ])}
      />
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumb={[{ label: tn('courses') }]}
      />
      <CoursesSection heading={false} />
      <LeadFormSection />
    </>
  )
}

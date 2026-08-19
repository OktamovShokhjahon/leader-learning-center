import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Images } from 'lucide-react'
import { isLocale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { Section } from '@/components/ui/section'
import { EmptyState } from '@/components/ui/empty-state'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { JsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return pageMetadata({ locale, path: '/galereya', namespace: 'gallery' })
}

export default async function GalleryPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('pages.gallery')
  const tn = await getTranslations('nav')

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: tn('gallery'), path: '/galereya' }])} />
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumb={[{ label: tn('gallery') }]}
      />
      <Section>
        <div className="container-site">
          {/* Photo and video albums land here once the client's photo session happens (§31 Q15). */}
          <EmptyState Icon={Images} title={t('empty')} />
        </div>
      </Section>
      <LeadFormSection />
    </>
  )
}

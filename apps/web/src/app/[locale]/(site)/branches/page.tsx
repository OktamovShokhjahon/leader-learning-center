import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { BranchesSection } from '@/components/site/sections/branches-faq'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { JsonLd, branchJsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'
import { getBranches } from '@/content/branches'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return pageMetadata({ locale, path: '/branches', namespace: 'branches' })
}

export default async function BranchesPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('pages.branches')
  const tn = await getTranslations('nav')

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: tn('branches'), path: '/branches' }])} />
      {/* TZ §6.3 — LocalBusiness per branch */}
      {getBranches().map((branch) => (
        <JsonLd key={branch.slug} data={branchJsonLd(branch, locale)} />
      ))}

      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumb={[{ label: tn('branches') }]}
      />
      <BranchesSection />
      <LeadFormSection />
    </>
  )
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { Section } from '@/components/ui/section'
import { RegisterForm } from '@/components/site/register-form'
import { HowSection } from '@/components/site/sections/why-how'
import { JsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return pageMetadata({ locale, path: '/royxatdan-otish', namespace: 'register' })
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('pages.register')
  const tn = await getTranslations('nav')

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(locale, [{ name: tn('apply'), path: '/royxatdan-otish' }])}
      />
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumb={[{ label: tn('apply') }]}
      />

      <Section>
        <div className="container-site max-w-2xl">
          <div className="rounded-card border border-border-subtle bg-surface p-6 shadow-raise md:p-8">
            {/* useSearchParams needs a Suspense boundary for static generation. */}
            <Suspense fallback={<div className="h-96 animate-pulse rounded-input bg-navy-50 dark:bg-navy-800" />}>
              <RegisterForm />
            </Suspense>
          </div>
        </div>
      </Section>

      <HowSection />
    </>
  )
}

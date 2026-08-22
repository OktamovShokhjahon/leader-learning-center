import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { TestImport } from '@/components/panel/test-import'

export const metadata = { robots: { index: false, follow: false } }

/**
 * Authoring online tests — `test.manage`, which is SuperAdmin and Teacher only.
 * The nav hides this from an Admin, and the API refuses it (§4.3).
 */
export default async function TestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages.tests')

  return (
    <PanelPage title={t('title')} subtitle={t('subtitle')} eyebrow={t('eyebrow')}>
      <TestImport />
    </PanelPage>
  )
}

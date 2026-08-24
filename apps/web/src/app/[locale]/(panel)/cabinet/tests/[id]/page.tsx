import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { TestRunner } from '@/components/panel/test-runner'

export const metadata = { robots: { index: false, follow: false } }

export default async function TestPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages.test')

  return (
    <PanelPage title={t('title')} subtitle={t('subtitle')} eyebrow={t('eyebrow')}>
      <TestRunner moduleId={id} />
    </PanelPage>
  )
}

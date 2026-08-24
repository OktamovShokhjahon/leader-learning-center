import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { FinanceDashboard } from '@/components/panel/finance-dashboard'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function BossPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <PanelPage title={t('finance.title')} subtitle={t('finance.subtitle')} eyebrow={t('finance.eyebrow')}>
      <FinanceDashboard />
    </PanelPage>
  )
}

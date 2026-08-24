import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { PaymentApprovals } from '@/components/panel/payment-approvals'

export const metadata = { robots: { index: false, follow: false } }

export default async function ApprovalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages.approvals')

  return (
    <PanelPage title={t('title')} subtitle={t('subtitle')} eyebrow={t('eyebrow')}>
      <PaymentApprovals />
    </PanelPage>
  )
}

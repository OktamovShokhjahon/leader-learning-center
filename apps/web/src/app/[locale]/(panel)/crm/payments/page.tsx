import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { PaymentScreen } from '@/components/panel/payment-screen'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function PaymentsPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <PanelPage title={t('payments.title')} subtitle={t('payments.subtitle')} eyebrow={t('payments.eyebrow')}>
      <PaymentScreen />
    </PanelPage>
  )
}

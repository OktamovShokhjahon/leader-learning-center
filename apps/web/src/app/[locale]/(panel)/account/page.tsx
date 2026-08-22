import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { PanelShell } from '@/components/panel/panel-shell'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function AccountPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <PanelPage title={t('account.title')} subtitle={t('account.subtitle')} eyebrow={t('account.eyebrow')}>
      <PanelShell />
    </PanelPage>
  )
}

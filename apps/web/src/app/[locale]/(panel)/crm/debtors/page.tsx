import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { DebtorsTable } from '@/components/panel/debtors-table'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function DebtorsPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission action="debtor.view">
      <PanelPage title={t('debtors.title')} subtitle={t('debtors.subtitle')} eyebrow={t('debtors.eyebrow')}>
        <DebtorsTable />
      </PanelPage>
    </RequirePermission>
  )
}

import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { PayrollScreen } from '@/components/panel/payroll-screen'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/** TZ §14 — salary schemes and the monthly payroll run. */
export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission roles={['superadmin']}>
      <PanelPage
        title={t('payroll.title')}
        subtitle={t('payroll.subtitle')}
        eyebrow={t('payroll.eyebrow')}
      >
        <PayrollScreen />
      </PanelPage>
    </RequirePermission>
  )
}

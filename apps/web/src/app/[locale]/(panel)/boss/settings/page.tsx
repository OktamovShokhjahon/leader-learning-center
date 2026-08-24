import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { SettingsScreen } from '@/components/panel/settings-screen'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/** TZ §21.1 — the numbers and switches the whole system reads. */
export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission roles={['superadmin']}>
      <PanelPage
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        eyebrow={t('settings.eyebrow')}
      >
        <SettingsScreen />
      </PanelPage>
    </RequirePermission>
  )
}

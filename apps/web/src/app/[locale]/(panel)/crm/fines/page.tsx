import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { FinesTable } from '@/components/panel/fines-table'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/** TZ §12 — jarima, for students and employees alike. */
export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission action="fine.issue">
      <PanelPage
        title={t('fines.title')}
        subtitle={t('fines.subtitle')}
        eyebrow={t('fines.eyebrow')}
      >
        <FinesTable />
      </PanelPage>
    </RequirePermission>
  )
}

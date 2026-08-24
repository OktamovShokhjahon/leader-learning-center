import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { LeadsBoard } from '@/components/panel/leads-board'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/** TZ §7.2 — the lead funnel a Manager works through. */
export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission action="lead.manage">
      <PanelPage
        title={t('leads.title')}
        subtitle={t('leads.subtitle')}
        eyebrow={t('leads.eyebrow')}
      >
        <LeadsBoard />
      </PanelPage>
    </RequirePermission>
  )
}

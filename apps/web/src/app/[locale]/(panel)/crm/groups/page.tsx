import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { GroupsList } from '@/components/panel/groups-list'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function GroupsPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <PanelPage title={t('groups.title')} subtitle={t('groups.subtitle')} eyebrow={t('groups.eyebrow')}>
      <GroupsList />
    </PanelPage>
  )
}

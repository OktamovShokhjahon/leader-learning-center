import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { UsersTable } from '@/components/panel/users-table'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/**
 * TZ §23 `STAFF` — one screen for the boss, an Admin and a Manager alike.
 *
 * What each of them sees is decided by the API, not by this route: the list
 * comes back scoped to the branches they hold a role in (every branch, for a
 * SuperAdmin), and the row actions are refused server-side for anyone above
 * their own rank. So there is no separate `/boss/users` to keep in step.
 */
export default async function StaffPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <PanelPage
      title={t('staff.title')}
      subtitle={t('staff.subtitle')}
      eyebrow={t('staff.eyebrow')}
    >
      <UsersTable />
    </PanelPage>
  )
}

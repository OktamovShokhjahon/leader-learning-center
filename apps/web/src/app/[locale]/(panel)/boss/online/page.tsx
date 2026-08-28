import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { OnlineLessonsTable } from '@/components/panel/online-lessons-table'

/**
 * Online darslar — the one authoring screen for the video, its test and its
 * handouts. Replaces `/boss/lessons`, `/crm/tests` and `/boss/library`.
 *
 * Per-user and behind a login, so never prerendered — see the note in the
 * `(panel)` layout.
 */
export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission roles={['superadmin']}>
      <PanelPage
        title={t('online.title')}
        subtitle={t('online.subtitle')}
        eyebrow={t('online.eyebrow')}
      >
        <OnlineLessonsTable />
      </PanelPage>
    </RequirePermission>
  )
}

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { LibraryTable } from '@/components/panel/library-table'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission roles={['superadmin']}>
      <PanelPage title={t('library.title')} subtitle={t('library.subtitle')} eyebrow={t('library.eyebrow')}>
        <LibraryTable />
      </PanelPage>
    </RequirePermission>
  )
}

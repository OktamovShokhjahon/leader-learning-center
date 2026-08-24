import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { BranchesTable } from '@/components/panel/branches-table'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/** TZ §5.3 — the branches everything else is scoped by. */
export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission roles={['superadmin']}>
      <PanelPage
        title={t('branches.title')}
        subtitle={t('branches.subtitle')}
        eyebrow={t('branches.eyebrow')}
      >
        <BranchesTable />
      </PanelPage>
    </RequirePermission>
  )
}

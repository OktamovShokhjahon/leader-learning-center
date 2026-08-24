import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { BranchesTable } from '@/components/panel/branches-table'

/**
 * Per-user and behind a login, so never prerendered — see the note in the
 * `(panel)` layout. Route segment config has to live on the page itself:
 * the `[locale]` layout above supplies `generateStaticParams`, and that wins
 * over a `dynamic` export on an intermediate layout.
 */
export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/** TZ §5.3 — the branches everything else is scoped by. */
export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
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

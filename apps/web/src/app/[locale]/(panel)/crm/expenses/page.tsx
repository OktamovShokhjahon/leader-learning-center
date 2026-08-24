import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { ExpensesScreen } from '@/components/panel/expenses-screen'

/**
 * Per-user and behind a login, so never prerendered — see the note in the
 * `(panel)` layout. Route segment config has to live on the page itself:
 * the `[locale]` layout above supplies `generateStaticParams`, and that wins
 * over a `dynamic` export on an intermediate layout.
 */
export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/** TZ §13 — harajat. Manager sees their own petty-cash rows; the boss sees the branch. */
export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission action="expense.create">
      <PanelPage
        title={t('expenses.title')}
        subtitle={t('expenses.subtitle')}
        eyebrow={t('expenses.eyebrow')}
      >
        <ExpensesScreen />
      </PanelPage>
    </RequirePermission>
  )
}

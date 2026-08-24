import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { ExpensesScreen } from '@/components/panel/expenses-screen'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/** TZ §13 — harajat. Manager sees their own petty-cash rows; the boss sees the branch. */
export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
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

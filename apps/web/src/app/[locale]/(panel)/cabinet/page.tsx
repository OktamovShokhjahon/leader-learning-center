import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { CabinetView } from '@/components/panel/cabinet-view'

export const metadata = { robots: { index: false, follow: false } }

/**
 * TZ §10.2 / §16 — the student and parent cabinet.
 *
 * The signed-in user is not itself a student: a `User` may be linked to a
 * student record, or be a parent linked to several children. Resolving which
 * record to show is the client's job here, because only it holds the session.
 */
export default async function CabinetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages.cabinet')

  return (
    <PanelPage title={t('title')} subtitle={t('subtitle')} eyebrow={t('eyebrow')}>
      <CabinetView />
    </PanelPage>
  )
}

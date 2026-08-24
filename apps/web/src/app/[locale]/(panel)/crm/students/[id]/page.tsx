import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { StudentCabinet } from '@/components/panel/student-cabinet'

export const metadata = { robots: { index: false, follow: false } }

/**
 * TZ §9.1 — the student card.
 *
 * Staff see the same attendance calendar and money history the student sees in
 * their own cabinet, so the two views cannot drift apart and a manager on the
 * phone is looking at exactly what the parent is looking at.
 */
export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages.student')

  return (
    <PanelPage title={t('title')} eyebrow={t('eyebrow')}>
      <StudentCabinet studentId={id} />
    </PanelPage>
  )
}

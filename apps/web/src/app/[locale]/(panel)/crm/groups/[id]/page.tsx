import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { AttendanceGrid } from '@/components/panel/attendance-grid'

export const metadata = { robots: { index: false, follow: false } }

/**
 * TZ §10.1 — "Open group → today's lesson is at the top → one tap per student."
 * The group id comes from the path, so the teacher lands here in one tap from
 * the group list and marks in the second (§1, two clicks from the dashboard).
 */
export default async function GroupAttendancePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages.attendance')

  return (
    <PanelPage title={t('title')} subtitle={t('subtitle')} eyebrow={t('eyebrow')}>
      <AttendanceGrid groupId={id} />
    </PanelPage>
  )
}

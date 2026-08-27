import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { ScheduleGrid } from '@/components/panel/schedule-grid'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/** §9.3 — the week's timetable, filterable by teacher/room/group. */
export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission action="attendance.mark">
      <PanelPage title={t('schedule.title')} subtitle={t('schedule.subtitle')} eyebrow={t('schedule.eyebrow')}>
        <ScheduleGrid />
      </PanelPage>
    </RequirePermission>
  )
}

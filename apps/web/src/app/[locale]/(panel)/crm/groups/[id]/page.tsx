import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { AttendanceGrid } from '@/components/panel/attendance-grid'

/**
 * Per-user and behind a login, so never prerendered — see the note in the
 * `(panel)` layout. Route segment config has to live on the page itself:
 * the `[locale]` layout above supplies `generateStaticParams`, and that wins
 * over a `dynamic` export on an intermediate layout.
 */
export const dynamic = 'force-dynamic'

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
  const t = await getTranslations('panel.pages.attendance')

  return (
    <PanelPage title={t('title')} subtitle={t('subtitle')} eyebrow={t('eyebrow')}>
      <AttendanceGrid groupId={id} />
    </PanelPage>
  )
}

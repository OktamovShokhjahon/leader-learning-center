import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { StudentCabinet } from '@/components/panel/student-cabinet'

/**
 * Per-user and behind a login, so never prerendered — see the note in the
 * `(panel)` layout. Route segment config has to live on the page itself:
 * the `[locale]` layout above supplies `generateStaticParams`, and that wins
 * over a `dynamic` export on an intermediate layout.
 */
export const dynamic = 'force-dynamic'

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
  const t = await getTranslations('panel.pages.student')

  return (
    <PanelPage title={t('title')} eyebrow={t('eyebrow')}>
      <StudentCabinet studentId={id} />
    </PanelPage>
  )
}

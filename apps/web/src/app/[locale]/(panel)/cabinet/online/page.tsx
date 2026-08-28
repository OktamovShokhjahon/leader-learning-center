import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { OnlineLessons } from '@/components/panel/online-lessons'

/**
 * The student's online darslar — the video, the handouts and the test in one
 * chain per course. Replaces the three cabinet screens it merges.
 *
 * Per-user and behind a login, so never prerendered.
 */
export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getTranslations('panel.pages')

  return (
    <PanelPage
      title={t('onlineStudent.title')}
      subtitle={t('onlineStudent.subtitle')}
      eyebrow={t('onlineStudent.eyebrow')}
    >
      <OnlineLessons />
    </PanelPage>
  )
}

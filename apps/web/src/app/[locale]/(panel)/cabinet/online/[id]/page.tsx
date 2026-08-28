import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { OnlineLessonView } from '@/components/panel/online-lesson-view'

export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string; id: string }> }

export default async function Page({ params }: Props) {
  const { locale, id } = await params
  if (!isLocale(locale)) notFound()
  const t = await getTranslations('panel.pages')

  return (
    <PanelPage
      title={t('onlineLesson.title')}
      subtitle={t('onlineLesson.subtitle')}
      eyebrow={t('onlineLesson.eyebrow')}
    >
      <OnlineLessonView lessonId={id} />
    </PanelPage>
  )
}

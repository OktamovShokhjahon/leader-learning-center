import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { StudentLibrary } from '@/components/panel/student-library'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <PanelPage title={t('libraryStudent.title')} subtitle={t('libraryStudent.subtitle')} eyebrow={t('libraryStudent.eyebrow')}>
      <StudentLibrary />
    </PanelPage>
  )
}

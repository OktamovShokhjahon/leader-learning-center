import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { AttemptReview } from '@/components/panel/attempt-review'

/**
 * Per-user and behind a login, so never prerendered — see the note in the
 * `(panel)` layout. Route segment config has to live on the page itself:
 * the `[locale]` layout above supplies `generateStaticParams`, and that wins
 * over a `dynamic` export on an intermediate layout.
 */
export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

export default async function AttemptPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  if (!isLocale(locale)) notFound()
  const t = await getTranslations('panel.pages.attempt')

  return (
    <PanelPage title={t('title')} subtitle={t('subtitle')} eyebrow={t('eyebrow')}>
      <AttemptReview attemptId={id} />
    </PanelPage>
  )
}

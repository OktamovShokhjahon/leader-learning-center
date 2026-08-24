import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { CoursesTable } from '@/components/panel/courses-table'
import { RoomsTable } from '@/components/panel/rooms-table'

/**
 * Per-user and behind a login, so never prerendered — see the note in the
 * `(panel)` layout. Route segment config has to live on the page itself:
 * the `[locale]` layout above supplies `generateStaticParams`, and that wins
 * over a `dynamic` export on an intermediate layout.
 */
export const dynamic = 'force-dynamic'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/**
 * TZ §21.1 — "Courses and prices · Rooms".
 *
 * One screen for both, because they are the two things a group needs to exist
 * and neither is big enough to earn its own tab in the nav. The gate is
 * `content.manage`, which reads courses; rooms carry `group.manage` on the API
 * side and their own controls stay hidden for anyone who lacks it.
 */
export default async function CoursesPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission action="content.manage" full>
      <PanelPage
        title={t('courses.title')}
        subtitle={t('courses.subtitle')}
        eyebrow={t('courses.eyebrow')}
      >
        <div className="flex flex-col gap-10">
          <CoursesTable />
          <RoomsTable />
        </div>
      </PanelPage>
    </RequirePermission>
  )
}

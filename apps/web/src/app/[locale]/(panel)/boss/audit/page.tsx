import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PanelPage } from '@/components/panel/primitives'
import { RequirePermission } from '@/components/panel/require-permission'
import { AuditLog } from '@/components/panel/audit-log'

export const metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

/** TZ §21.3 — the audit log. Read-only by design; nothing here deletes. */
export default async function Page({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('panel.pages')

  return (
    <RequirePermission roles={['superadmin']}>
      <PanelPage
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
        eyebrow={t('audit.eyebrow')}
      >
        <AuditLog />
      </PanelPage>
    </RequirePermission>
  )
}

import { getTranslations } from 'next-intl/server'
import { FileText, Mail, Phone } from 'lucide-react'
import { PageHeader } from '@/components/site/page-header'
import { Section } from '@/components/ui/section'
import { SITE } from '@/content/site'

/**
 * TZ §6.1 — the public offer and privacy policy are *legally required before
 * online payment goes live* (§11.4). Their text must be written by the centre's
 * lawyer; publishing invented legal terms would be worse than publishing none.
 *
 * So these pages ship as real, indexed routes carrying an honest notice and the
 * contact details, and the lawyer's text drops straight in.
 */
export async function LegalPage({
  titleKey,
  navKey,
}: {
  titleKey: 'offerTitle' | 'privacyTitle'
  navKey: 'offer' | 'privacy'
}) {
  const t = await getTranslations('pages.legal')
  const tn = await getTranslations('nav')

  return (
    <>
      <PageHeader title={t(titleKey)} breadcrumb={[{ label: tn(navKey) }]} />
      <Section>
        <div className="container-site max-w-3xl">
          <div className="flex flex-col items-start gap-5 rounded-card border border-warning/30 bg-warning/5 p-6 md:p-8">
            <span className="inline-flex size-12 items-center justify-center rounded-input bg-warning/15 text-warning">
              <FileText className="size-5.5" aria-hidden />
            </span>
            <p className="text-sm leading-relaxed text-ink-soft dark:text-navy-200">
              {t('pending')}
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <a
                href={`tel:${SITE.phones[0]?.replace(/\s/g, '')}`}
                className="inline-flex items-center gap-2 font-mono text-navy-700 hover:underline dark:text-aqua-300"
              >
                <Phone className="size-4" aria-hidden />
                {SITE.phones[0]}
              </a>
              <a
                href={`mailto:${SITE.email}`}
                className="inline-flex items-center gap-2 text-navy-700 hover:underline dark:text-aqua-300"
              >
                <Mail className="size-4" aria-hidden />
                {SITE.email}
              </a>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}

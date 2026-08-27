import { getTranslations, getLocale } from 'next-intl/server'
import { FileText } from 'lucide-react'
import { pick, type Locale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { Section } from '@/components/ui/section'
import { OFFER, PRIVACY, type LegalSection } from '@/content/legal'
import { formatDate } from '@/lib/date'

/**
 * TZ §6.1 — the public offer and privacy policy, both legally required before
 * online payment goes live (§11.4).
 *
 * The text is a working draft written from what the system actually does, so
 * the centre's lawyer reviews something accurate rather than a blank page. The
 * notice at the top says exactly that, because a visitor should not mistake a
 * draft for a signed document.
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
  const locale = (await getLocale()) as Locale

  const sections: LegalSection[] = navKey === 'offer' ? OFFER : PRIVACY
  const updated = formatDate(new Date(), locale)

  return (
    <>
      <PageHeader title={t(titleKey)} breadcrumb={[{ label: tn(navKey) }]} />
      <Section>
        <article className="container-site flex max-w-3xl flex-col gap-10">
          <p className="flex items-start gap-3 rounded-card border border-warning/30 bg-warning/5 p-5 text-xs leading-relaxed text-ink-soft dark:text-navy-200">
            <FileText className="mt-0.5 size-4.5 shrink-0 text-warning" aria-hidden />
            {t('draftNotice')}
          </p>

          {sections.map((section, index) => (
            <section key={index} className="flex flex-col gap-4">
              <h2 className="font-display text-lg leading-tight tracking-[-0.02em] text-ink dark:text-white">
                {pick(section.heading, locale)}
              </h2>
              {section.body.map((paragraph, paragraphIndex) => (
                <p
                  key={paragraphIndex}
                  className="text-sm leading-relaxed text-ink-soft dark:text-navy-200"
                >
                  {pick(paragraph, locale)}
                </p>
              ))}
            </section>
          ))}

          <p className="border-t border-border-subtle pt-6 font-mono text-2xs text-ink-muted">
            {t('lastUpdated', { date: updated })}
          </p>
        </article>
      </Section>
    </>
  )
}

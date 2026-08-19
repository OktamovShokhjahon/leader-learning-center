import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations, getLocale } from 'next-intl/server'
import { MapPin, Phone, Mail, Clock, Instagram, Send } from 'lucide-react'
import { isLocale, pick, type Locale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { Section } from '@/components/ui/section'
import { ContactForm } from '@/components/site/contact-form'
import { getBranches } from '@/content/branches'
import { SITE } from '@/content/site'
import { JsonLd, breadcrumbJsonLd, branchJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return pageMetadata({ locale, path: '/aloqa', namespace: 'contact' })
}

export default async function ContactPage({ params }: Props) {
  const { locale: rawLocale } = await params
  if (!isLocale(rawLocale)) notFound()
  setRequestLocale(rawLocale)

  const locale = (await getLocale()) as Locale
  const t = await getTranslations('pages.contact')
  const tc = await getTranslations('common')
  const tn = await getTranslations('nav')
  const branches = getBranches()

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: tn('contact'), path: '/aloqa' }])} />
      {branches.map((branch) => (
        <JsonLd key={branch.slug} data={branchJsonLd(branch, locale)} />
      ))}

      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumb={[{ label: tn('contact') }]}
      />

      <Section>
        <div className="container-site grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <a
                href={`tel:${SITE.phones[0]?.replace(/\s/g, '')}`}
                className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-4 transition-colors hover:border-glaze-300"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-input bg-glaze-50 text-glaze-700 dark:bg-navy-800 dark:text-glaze-300">
                  <Phone className="size-5" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-2xs uppercase tracking-[0.14em] text-ink-muted">
                    {tc('phone')}
                  </span>
                  <span className="font-mono text-sm text-ink dark:text-white">
                    {SITE.phones[0]}
                  </span>
                </span>
              </a>

              <a
                href={`mailto:${SITE.email}`}
                className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-4 transition-colors hover:border-glaze-300"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-input bg-glaze-50 text-glaze-700 dark:bg-navy-800 dark:text-glaze-300">
                  <Mail className="size-5" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-2xs uppercase tracking-[0.14em] text-ink-muted">Email</span>
                  <span className="text-sm text-ink dark:text-white">{SITE.email}</span>
                </span>
              </a>

              <div className="flex gap-3">
                <a
                  href={SITE.telegram}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex flex-1 items-center justify-center gap-2 rounded-card border border-border-subtle bg-surface p-4 text-xs font-medium text-ink transition-colors hover:border-glaze-300 dark:text-white"
                >
                  <Send className="size-4.5 text-glaze-600" aria-hidden />
                  Telegram
                </a>
                <a
                  href={SITE.instagram}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex flex-1 items-center justify-center gap-2 rounded-card border border-border-subtle bg-surface p-4 text-xs font-medium text-ink transition-colors hover:border-glaze-300 dark:text-white"
                >
                  <Instagram className="size-4.5 text-clay-500" aria-hidden />
                  Instagram
                </a>
              </div>
            </div>

            <ul className="flex flex-col gap-4">
              {branches.map((branch) => (
                <li
                  key={branch.slug}
                  className="flex flex-col gap-2 rounded-card border border-border-subtle bg-surface p-5"
                >
                  <h2 className="font-display text-base text-ink dark:text-white">
                    {pick(branch.name, locale)}
                  </h2>
                  <p className="flex items-start gap-2.5 text-xs text-ink-soft dark:text-navy-200">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-glaze-600" aria-hidden />
                    {pick(branch.address, locale)}
                  </p>
                  <p className="flex items-center gap-2.5 text-xs text-ink-soft dark:text-navy-200">
                    <Clock className="size-4 shrink-0 text-glaze-600" aria-hidden />
                    {pick(branch.workingHours, locale)}
                  </p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${branch.geo.lat},${branch.geo.lng}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 text-xs font-medium text-glaze-700 hover:underline dark:text-glaze-300"
                  >
                    {pick(
                      {
                        uz: 'Xaritada ochish',
                        ru: 'Открыть на карте',
                        en: 'Open on the map',
                      },
                      locale,
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-card border border-border-subtle bg-surface p-6 shadow-raise md:p-8">
            <h2 className="mb-6 font-display text-lg text-ink dark:text-white">{t('formTitle')}</h2>
            <ContactForm />
          </div>
        </div>
      </Section>
    </>
  )
}

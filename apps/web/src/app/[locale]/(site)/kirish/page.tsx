import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Info, Phone } from 'lucide-react'
import { isLocale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { Section } from '@/components/ui/section'
import { SITE } from '@/content/site'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return {
    ...(await pageMetadata({ locale, path: '/kirish', namespace: 'login' })),
    // The cabinet is private; keep it out of the index (§6.3 covers public pages only).
    robots: { index: false, follow: true },
  }
}

/**
 * TZ §6.1 — `/kirish` is the entry point to all panels and preserves the
 * current site's SHAXSIY KABINET link (BIG_PROJECT.pdf PIC 1).
 *
 * The real sign-in form (phone + password, phone + SMS OTP, argon2id, JWT with
 * refresh rotation — §8) is built in Phase 1 together with the API. Until then
 * this route exists so no navigation link is broken, and it says plainly what
 * the state is rather than showing a form that cannot work.
 */
export default async function LoginPage({ params }: Props) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const t = await getTranslations('pages.login')
  const tn = await getTranslations('nav')

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} breadcrumb={[{ label: tn('login') }]} />
      <Section>
        <div className="container-site max-w-lg">
          <div className="flex flex-col items-start gap-5 rounded-card border border-info/30 bg-info/5 p-6 md:p-8">
            <span className="inline-flex size-12 items-center justify-center rounded-input bg-info/15 text-info">
              <Info className="size-5.5" aria-hidden />
            </span>
            <p className="text-sm leading-relaxed text-ink-soft dark:text-navy-200">
              {t('pending')}
            </p>
            <a
              href={`tel:${SITE.phones[0]?.replace(/\s/g, '')}`}
              className="inline-flex h-12 items-center gap-2 rounded-pill border border-navy-600/25 px-5 font-mono text-xs text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
            >
              <Phone className="size-4" aria-hidden />
              {SITE.phones[0]}
            </a>
          </div>
        </div>
      </Section>
    </>
  )
}

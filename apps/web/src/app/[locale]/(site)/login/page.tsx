import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { Section } from '@/components/ui/section'
import { LoginForm } from '@/components/site/login-form'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return {
    ...(await pageMetadata({ locale, path: '/login', namespace: 'login' })),
    // The cabinet is a private surface; §6.3's SEO targets cover public pages.
    robots: { index: false, follow: true },
  }
}

/**
 * TZ §6.1 — `/login` is the entry point to all panels, preserving the current
 * site's SHAXSIY KABINET link (BIG_PROJECT.pdf PIC 1).
 *
 * Sign-in is real: it authenticates against `POST /api/v1/auth/login` (§8,
 * argon2id + JWT + rotating refresh cookie) through the BFF, and redirects to
 * the panel for the account's role. The panels themselves are Phase 1/7 work,
 * so a successful sign-in currently lands on a route that is still being built.
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
        <div className="container-site max-w-md">
          <div className="rounded-card border border-border-subtle bg-surface p-6 shadow-raise md:p-8">
            <LoginForm />
          </div>
        </div>
      </Section>
    </>
  )
}

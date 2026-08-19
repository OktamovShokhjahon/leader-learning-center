import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale, getTranslations } from 'next-intl/server'
import { isLocale, LOCALES, type Locale } from '@leader/shared/locales'
import { fontVariables } from '@/lib/fonts'
import { SITE } from '@/content/site'
import '../globals.css'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F1E8' },
    { media: '(prefers-color-scheme: dark)', color: '#05141F' },
  ],
  width: 'device-width',
  initialScale: 1,
}

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export async function generateMetadata({
  params,
}: Omit<LayoutProps, 'children'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const t = await getTranslations({ locale, namespace: 'meta' })

  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: t('defaultTitle'),
      template: `%s — ${SITE.name}`,
    },
    description: t('defaultDescription'),
    applicationName: SITE.name,
    // TZ §6.3 — hreflang alternates for all three locales
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      type: 'website',
      siteName: SITE.name,
      locale,
      url: `${SITE.url}/${locale}`,
      title: t('defaultTitle'),
      description: t('defaultDescription'),
    },
    icons: { icon: '/favicon.ico', apple: '/brand/logo.png' },
  }
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  // Enables static rendering of all pages under this layout (TZ §6.3).
  setRequestLocale(locale as Locale)
  const messages = await getMessages()

  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}

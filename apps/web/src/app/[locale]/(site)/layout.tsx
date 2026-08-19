import { setRequestLocale } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { notFound } from 'next/navigation'
import { Header } from '@/components/site/header'
import { Footer } from '@/components/site/footer'

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

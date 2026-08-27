import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { isLocale } from '@leader/shared/locales'
import { AuthProvider } from '@/lib/auth/auth-context'
import { Header } from '@/components/site/header'
import { PanelNav } from '@/components/panel/panel-nav'

/**
 * The panels (§24.1 route groups `(crm)`, `(boss)`, `(cabinet)`).
 *
 * `AuthProvider` is mounted here rather than in the root layout so the public
 * site ships none of the auth client code, and so the refresh call on mount
 * only fires for someone actually opening a panel.
 */
export default async function PanelLayout({
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
    <AuthProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <Header variant="panel" />
        <PanelNav />
        {/* The sidebar is fixed, so the content is inset rather than laid out
            beside it — that keeps `container-site` inside each page working
            unchanged, and leaves the mobile drawer nothing to push around. */}
        <main id="main" className="min-w-0 flex-1 pt-20 lg:pl-60">
          {children}
        </main>
      </div>
    </AuthProvider>
  )
}

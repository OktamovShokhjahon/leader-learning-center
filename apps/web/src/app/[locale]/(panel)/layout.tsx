import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
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

/**
 * Nothing under `(panel)` is prerendered.
 *
 * These pages are per-user and behind a login: every one carries
 * `robots: noindex`, and what they render depends entirely on who is asking.
 * A build-time HTML snapshot of "your account" or "the audit log" is not a
 * cheaper version of the page — it is a different page, belonging to nobody.
 *
 * Leaving them static also made the build itself fragile. Prerendering ran
 * every panel screen through a server render with no session, no cookies and
 * no API reachable, and a throw anywhere in that path failed the whole build
 * behind a production-masked digest. Two Vercel builds of the identical commit
 * died on different pages — `/uz/account`, then `/uz/boss/audit` — which is the
 * signature of a hazard shared by all of them, hit in whatever order the build
 * workers happened to pick, not of one broken screen.
 *
 * `force-dynamic` applies to this segment and everything below it, so the
 * public site keeps its static export and only the panels opt out.
 */
export const dynamic = 'force-dynamic'

export default async function PanelLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  // Reading a request header is what actually opts this subtree out of
  // prerendering. `export const dynamic` above is ignored here, because the
  // `[locale]` layout supplies `generateStaticParams` and that wins; touching a
  // runtime API is the mechanism Next honours either way.
  await headers()

  return (
    <AuthProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <Header variant="panel" />
        <PanelNav />
        <main id="main" className="flex-1 pt-20">
          {children}
        </main>
      </div>
    </AuthProvider>
  )
}

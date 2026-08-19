'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Menu, X, Phone, UserRound } from 'lucide-react'
import { Link, usePathname } from '@/i18n/navigation'
import { MAIN_NAV, SITE } from '@/content/site'
import { LanguageSwitcher } from './language-switcher'
import { cn } from '@/lib/utils'

export function Header() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile sheet on navigation and lock the body while it is open.
  useEffect(() => setMenuOpen(false), [pathname])
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-pill bg-navy-600 px-4 py-2 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
      >
        {t('skipToContent')}
      </a>

      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-border-subtle bg-background/85 backdrop-blur-lg'
            : 'border-b border-transparent',
        )}
      >
        <div className="container-site flex h-18 items-center justify-between gap-4 py-3">
          <Link href="/" className="flex shrink-0 items-center" aria-label={SITE.name}>
            <Image
              src="/brand/logo.png"
              alt={SITE.name}
              width={180}
              height={66}
              priority
              className="h-9 w-auto md:h-10"
            />
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label={SITE.name}>
            {MAIN_NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-pill px-3.5 py-2 text-xs font-medium transition-colors',
                    active
                      ? 'bg-glaze-50 text-glaze-800 dark:bg-navy-800 dark:text-glaze-200'
                      : 'text-ink-soft hover:bg-navy-50 hover:text-navy-700 dark:text-navy-100 dark:hover:bg-navy-800',
                  )}
                >
                  {t(item.key)}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <a
              href={`tel:${SITE.phones[0]?.replace(/\s/g, '')}`}
              className="hidden h-11 items-center gap-2 rounded-pill px-3 font-mono text-xs text-ink-soft transition-colors hover:bg-navy-50 hover:text-navy-700 xl:inline-flex dark:text-navy-100"
            >
              <Phone className="size-4" aria-hidden />
              {SITE.phones[0]}
            </a>

            <LanguageSwitcher />

            <Link
              href={SITE.cabinetPath}
              className="hidden h-11 items-center gap-2 rounded-pill border border-navy-600/25 px-4 text-xs font-medium text-navy-700 transition-colors hover:border-navy-600/50 hover:bg-navy-50 md:inline-flex dark:text-navy-100 dark:hover:bg-navy-800"
            >
              <UserRound className="size-4" aria-hidden />
              {t('login')}
            </Link>

            <Link
              href="/royxatdan-otish"
              className="gradient-glaze hidden h-11 items-center rounded-pill px-5 text-xs font-medium text-white shadow-raise transition-all hover:shadow-float hover:brightness-110 sm:inline-flex"
            >
              {t('apply')}
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
              aria-expanded={menuOpen}
              className="inline-flex size-11 items-center justify-center rounded-pill text-navy-700 transition-colors hover:bg-navy-50 lg:hidden dark:text-navy-100 dark:hover:bg-navy-800"
            >
              {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      <div
        className={cn(
          'fixed inset-0 z-[55] lg:hidden',
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!menuOpen}
      >
        <div
          onClick={() => setMenuOpen(false)}
          className={cn(
            'absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-300',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-surface shadow-float transition-transform duration-300',
            menuOpen ? 'translate-x-0' : 'translate-x-full',
          )}
          style={{ transitionTimingFunction: 'var(--ease-enter)' }}
        >
          <div className="flex h-18 items-center justify-between border-b border-border-subtle px-5">
            <Image src="/brand/logo.png" alt={SITE.name} width={140} height={51} className="h-8 w-auto" />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label={t('closeMenu')}
              className="inline-flex size-11 items-center justify-center rounded-pill text-navy-700 hover:bg-navy-50 dark:text-navy-100"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
            {MAIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-input px-4 py-3.5 text-base font-medium text-ink transition-colors hover:bg-navy-50 dark:text-white dark:hover:bg-navy-800"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-2 border-t border-border-subtle p-4">
            <Link
              href="/royxatdan-otish"
              className="gradient-glaze flex h-12 items-center justify-center rounded-pill text-sm font-medium text-white"
            >
              {t('apply')}
            </Link>
            <Link
              href={SITE.cabinetPath}
              className="flex h-12 items-center justify-center gap-2 rounded-pill border border-navy-600/25 text-sm font-medium text-navy-700 dark:text-navy-100"
            >
              <UserRound className="size-4" aria-hidden />
              {t('login')}
            </Link>
            <a
              href={`tel:${SITE.phones[0]?.replace(/\s/g, '')}`}
              className="flex h-12 items-center justify-center gap-2 font-mono text-xs text-ink-soft dark:text-navy-100"
            >
              <Phone className="size-4" aria-hidden />
              {SITE.phones[0]}
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

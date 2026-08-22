'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Menu, X, ArrowRight } from 'lucide-react'
import { Link, usePathname } from '@/i18n/navigation'
import { MAIN_NAV, SITE } from '@/content/site'
import { LanguageSwitcher } from './language-switcher'
import { GirihStar } from '@/components/ui/girih-star'
import { cn } from '@/lib/utils'

/**
 * The top bar is deliberately quiet, because the hero is loud.
 *
 * One call to action, not four: "Ro'yxatdan o'tish" is the only filled control
 * in the bar. Sign-in is a plain text link, and the phone number lives in the
 * footer and on the contact page rather than competing here.
 *
 * The active page is marked with the girih star rather than a filled pill —
 * same motif as every section eyebrow, so the navigation belongs to the same
 * system as the page.
 */
export function Header({ variant = 'site' }: { variant?: 'site' | 'panel' }) {
  /**
   * The panel wears the same bar as the site so the product feels like one
   * thing, but it carries none of the marketing navigation: someone marking
   * attendance has no use for Natijalar, and the Apply CTA is aimed at a
   * visitor who is not signed in. The panel's own nav sits directly below.
   */
  const isPanel = variant === 'panel'
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (isPanel) return
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isPanel])

  /**
   * The transparent bar only works over the hero's dark glaze. The panels have
   * a light background and no hero, so there the bar always carries its ground —
   * otherwise white nav text and an inverted logo sit on sand and vanish.
   */
  const onGround = isPanel || scrolled

  useEffect(() => setMenuOpen(false), [pathname])
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

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
          'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300',
          onGround
            ? 'border-b border-border-subtle bg-background/88 backdrop-blur-xl'
            : 'border-b border-transparent',
        )}
      >
        <div className="container-site flex h-20 items-center justify-between gap-6">
          <Link href="/" className="shrink-0" aria-label={SITE.name}>
            <Image
              src="/brand/logo.png"
              alt={SITE.name}
              width={180}
              height={66}
              priority
              className={cn(
                'h-9 w-auto transition-[filter] duration-300 md:h-10',
                // Over the hero the bar is transparent, so the mark inverts to
                // stay legible on the glaze; once the bar has a ground, it does not.
                onGround ? '' : 'brightness-0 invert',
              )}
            />
          </Link>

          {isPanel ? null : (
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label={SITE.name}>
            {MAIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'group inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-xs font-medium transition-colors duration-200',
                  onGround
                    ? isActive(item.href)
                      ? 'text-navy-700 dark:text-white'
                      : 'text-ink-soft hover:text-navy-700 dark:text-navy-200 dark:hover:text-white'
                    : isActive(item.href)
                      ? 'text-white'
                      : 'text-white/70 hover:text-white',
                )}
              >
                <GirihStar
                  className={cn(
                    'size-2 transition-opacity duration-200',
                    isActive(item.href)
                      ? 'opacity-100 text-clay-500'
                      : 'opacity-0 group-hover:opacity-40',
                  )}
                  strokeWidth={2.6}
                />
                {t(item.key)}
              </Link>
            ))}
          </nav>
          )}

          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher tone={onGround ? 'light' : 'dark'} />

            {/* Sign-in and Apply are aimed at a visitor; inside a panel the
                person is already signed in, and the panel nav sits below. */}
            {isPanel ? null : (
              <>
                <Link
                  href={SITE.cabinetPath}
                  className={cn(
                    'hidden h-11 items-center rounded-pill px-3 text-xs font-medium transition-colors duration-200 md:inline-flex',
                    onGround
                      ? 'text-ink-soft hover:text-navy-700 dark:text-navy-200 dark:hover:text-white'
                      : 'text-white/75 hover:text-white',
                  )}
                >
                  {t('login')}
                </Link>

                <Link
                  href="/apply"
                  className="group hidden h-11 items-center gap-2 rounded-pill bg-clay-500 px-5 text-xs font-medium text-white transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-clay-400 active:scale-[0.98] sm:inline-flex"
                >
                  {t('apply')}
                  <ArrowRight
                    className="size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>

                <button
                  type="button"
                  onClick={() => setMenuOpen((value) => !value)}
                  aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
                  aria-expanded={menuOpen}
                  className={cn(
                    'inline-flex size-11 items-center justify-center rounded-pill transition-colors duration-200 lg:hidden',
                    onGround
                      ? 'text-navy-700 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800'
                      : 'text-white hover:bg-white/12',
                  )}
                >
                  {menuOpen ? (
                    <X className="size-5" aria-hidden />
                  ) : (
                    <Menu className="size-5" aria-hidden />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/*
        The mobile sheet carries only marketing links, so a panel does not
        render it at all — hidden dead DOM is still DOM. It enters from the
        trigger's edge and exits faster than it enters.
      */}
      {isPanel ? null : (
        <div
          className={cn('fixed inset-0 z-[55] lg:hidden', menuOpen ? 'pointer-events-auto' : 'pointer-events-none')}
          aria-hidden={!menuOpen}
        >
          <div
            onClick={() => setMenuOpen(false)}
            className={cn(
              'absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity',
              menuOpen ? 'opacity-100 duration-300' : 'opacity-0 duration-200',
            )}
          />
          <div
            className={cn(
              'absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-surface shadow-float transition-transform ease-[cubic-bezier(0.32,0.72,0,1)]',
              menuOpen ? 'translate-x-0 duration-300' : 'translate-x-full duration-200',
            )}
          >
            <div className="flex h-20 items-center justify-between border-b border-border-subtle px-5">
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

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-4">
              {MAIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className="flex items-center gap-3 rounded-input px-4 py-3.5 text-base font-medium text-ink transition-colors hover:bg-navy-50 dark:text-white dark:hover:bg-navy-800"
                >
                  <GirihStar
                    className={cn('size-2.5 text-clay-500', isActive(item.href) ? 'opacity-100' : 'opacity-0')}
                    strokeWidth={2.6}
                  />
                  {t(item.key)}
                </Link>
              ))}
            </nav>

            <div className="flex flex-col gap-2 border-t border-border-subtle p-4">
              <Link
                href="/apply"
                className="flex h-13 items-center justify-center rounded-pill bg-clay-500 text-sm font-medium text-white"
              >
                {t('apply')}
              </Link>
              <Link
                href={SITE.cabinetPath}
                className="flex h-13 items-center justify-center rounded-pill border border-navy-600/25 text-sm font-medium text-navy-700 dark:text-navy-100"
              >
                {t('login')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type Locale } from '@leader/shared/locales'
import { usePathname, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/**
 * TZ §21.2 — locale lives in the path and is persisted in a cookie by the
 * next-intl middleware, so the choice survives the next visit.
 */
export function LanguageSwitcher({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const t = useTranslations('nav')
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const change = (next: Locale) => {
    setOpen(false)
    if (next === locale) return
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('changeLanguage')}
        disabled={isPending}
        className={cn(
          'inline-flex h-11 items-center gap-1.5 rounded-pill px-3 text-xs font-medium transition-colors',
          tone === 'light'
            ? 'text-ink-soft hover:bg-navy-50 hover:text-navy-700'
            : 'text-white/80 hover:bg-white/12 hover:text-white',
        )}
      >
        <Globe className="size-4" aria-hidden />
        {LOCALE_SHORT[locale]}
        <ChevronDown
          className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 min-w-44 overflow-hidden rounded-card border border-border-subtle bg-surface p-1 shadow-float"
        >
          {LOCALES.map((item) => (
            <li key={item}>
              <button
                type="button"
                role="option"
                aria-selected={item === locale}
                onClick={() => change(item)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left text-xs transition-colors',
                  item === locale
                    ? 'bg-glaze-50 font-medium text-glaze-800 dark:bg-navy-800 dark:text-glaze-200'
                    : 'text-ink-soft hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800',
                )}
              >
                {LOCALE_LABELS[item]}
                {item === locale ? <Check className="size-4" aria-hidden /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

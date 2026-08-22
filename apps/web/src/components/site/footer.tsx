import Image from 'next/image'
import { getTranslations, getLocale } from 'next-intl/server'
import { Instagram, Send, Facebook, Youtube, Phone, Mail, MapPin } from 'lucide-react'
import type { Locale } from '@leader/shared/locales'
import { pick } from '@leader/shared/locales'
import { Link } from '@/i18n/navigation'
import { SITE, FOOTER_NAV } from '@/content/site'
import { getBranches } from '@/content/branches'
import { LanguageSwitcher } from './language-switcher'
import { TrackedLink } from './tracked-link'

const SOCIALS = [
  { href: SITE.instagram, Icon: Instagram, label: 'Instagram', event: 'click_instagram' },
  { href: SITE.telegram, Icon: Send, label: 'Telegram', event: 'click_telegram' },
  { href: SITE.facebook, Icon: Facebook, label: 'Facebook', event: 'click_social' },
  { href: SITE.youtube, Icon: Youtube, label: 'YouTube', event: 'click_social' },
] as const

export async function Footer() {
  const t = await getTranslations()
  const locale = (await getLocale()) as Locale
  const branches = getBranches()
  const year = new Date().getFullYear()

  return (
    <footer className="relative overflow-hidden bg-navy-900 text-navy-100">
      <div
        aria-hidden
        className="tile-star pointer-events-none absolute inset-0 text-white/[0.04]"
      />

      <div className="container-site relative py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="flex flex-col gap-6">
            {/*
             * The mark is navy-on-transparent, so on the navy footer it needs a
             * ground of its own. `brightness-0 invert` would flatten it to a
             * white silhouette and throw away the two-tone logo the client
             * actually uses — instead it sits on a light ceramic tile, which
             * keeps the real brand colours and matches the panel language.
             */}
            <span className="panel-frame-ink inline-flex w-fit rounded-card bg-sand px-5 py-3.5">
              <Image
                src="/brand/logo.png"
                alt={SITE.name}
                width={200}
                height={73}
                className="h-10 w-auto"
              />
            </span>
            <p className="max-w-sm text-xs leading-relaxed text-navy-200">{t('footer.tagline')}</p>

            <div className="flex flex-col gap-2.5 text-xs">
              <a
                href={`tel:${SITE.phones[0]?.replace(/\s/g, '')}`}
                className="inline-flex items-center gap-2.5 font-mono text-navy-100 transition-colors hover:text-aqua-300"
              >
                <Phone className="size-4 shrink-0 text-aqua-400" aria-hidden />
                {SITE.phones[0]}
              </a>
              <a
                href={`mailto:${SITE.email}`}
                className="inline-flex items-center gap-2.5 text-navy-100 transition-colors hover:text-aqua-300"
              >
                <Mail className="size-4 shrink-0 text-aqua-400" aria-hidden />
                {SITE.email}
              </a>
              {branches.map((branch) => (
                <span key={branch.slug} className="inline-flex items-start gap-2.5 text-navy-200">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-aqua-400" aria-hidden />
                  {pick(branch.address, locale)}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {SOCIALS.map(({ href, Icon, label, event }) => (
                <TrackedLink
                  key={label}
                  href={href}
                  event={event}
                  params={{ channel: label, placement: 'footer' }}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  className="inline-flex size-11 items-center justify-center rounded-pill bg-white/8 text-navy-100 transition-colors hover:bg-white/16 hover:text-white"
                >
                  <Icon className="size-4.5" aria-hidden />
                </TrackedLink>
              ))}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {FOOTER_NAV.map((group) => (
              <nav key={group.key} aria-label={t(`footer.${group.key}`)}>
                <h3 className="mb-4 font-sans text-2xs font-semibold uppercase tracking-[0.14em] text-aqua-400">
                  {t(`footer.${group.key}`)}
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-xs text-navy-200 transition-colors hover:text-white"
                      >
                        {t(`nav.${item.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
          <p className="text-2xs text-navy-300">
            © {year} {SITE.name}. {t('footer.rights')}
          </p>
          <div className="[&_button]:text-navy-200">
            <LanguageSwitcher tone="dark" />
          </div>
        </div>
      </div>
    </footer>
  )
}

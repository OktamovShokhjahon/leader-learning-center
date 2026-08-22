import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LOCALES, type Locale } from '@leader/shared/locales'

/**
 * TZ §6.3 — per-locale title, description, Open Graph and hreflang alternates
 * on every public page. One helper so no page can forget an alternate.
 */
export async function pageMetadata({
  locale,
  path,
  namespace,
  title,
  description,
}: {
  locale: Locale
  /** Route path without the locale prefix, e.g. `/courses`. */
  path: string
  /** Namespace under `pages.*` holding `title` and `metaDescription`. */
  namespace?: string
  title?: string
  description?: string
}): Promise<Metadata> {
  let resolvedTitle = title
  let resolvedDescription = description

  if (namespace) {
    const t = await getTranslations({ locale, namespace: `pages.${namespace}` })
    resolvedTitle ??= t('title')
    resolvedDescription ??= t('metaDescription')
  }

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}${path}`])),
    },
    openGraph: {
      type: 'website',
      locale,
      url: `/${locale}${path}`,
      title: resolvedTitle,
      description: resolvedDescription,
    },
  }
}

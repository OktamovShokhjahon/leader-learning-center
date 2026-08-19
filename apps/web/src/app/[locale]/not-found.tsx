import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function NotFound() {
  const t = await getTranslations('notFound')

  return (
    <div className="container-site flex min-h-[70svh] flex-col items-center justify-center gap-5 py-24 text-center">
      <span className="gradient-glaze-text font-display text-4xl font-bold">404</span>
      <h1 className="text-xl md:text-2xl">{t('title')}</h1>
      <p className="max-w-md text-sm text-ink-soft dark:text-navy-200">{t('body')}</p>
      <Link
        href="/"
        className="gradient-glaze mt-2 inline-flex h-13 items-center rounded-pill px-7 text-sm font-medium text-white shadow-raise"
      >
        {t('home')}
      </Link>
    </div>
  )
}

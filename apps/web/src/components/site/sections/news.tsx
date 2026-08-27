import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowRight, CalendarDays, Newspaper } from 'lucide-react'
import { pick, type Locale } from '@leader/shared/locales'
import { Link } from '@/i18n/navigation'
import { getPosts } from '@/content/posts'
import { formatDate } from '@/lib/date'
import { Section, SectionHeading } from '@/components/ui/section'
import { EmptyState } from '@/components/ui/empty-state'
import { Reveal } from '../reveal'

/**
 * TZ §6.2 §12 / §6.1 — the news list, used both as the home-page teaser
 * (`limit={3}`) and as the `/news` index.
 *
 * `POSTS` is empty until the centre writes real news, so this renders the
 * designed empty state (§25.6) rather than placeholder articles.
 */
export async function NewsSection({ limit, heading = true }: { limit?: number; heading?: boolean }) {
  const t = await getTranslations('home.news')
  const tc = await getTranslations('common')
  const locale = (await getLocale()) as Locale
  const all = getPosts()
  const posts = limit ? all.slice(0, limit) : all

  return (
    <Section id="news">
      <div className="container-site">
        {heading ? (
          <SectionHeading
            eyebrow={t('eyebrow')}
            title={t('title')}
            action={
              limit && all.length > limit ? (
                <Link
                  href="/news"
                  className="inline-flex h-12 items-center gap-2 rounded-pill border border-navy-600/25 px-5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
                >
                  {tc('allNews')}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : undefined
            }
          />
        ) : null}

        {posts.length === 0 ? (
          <EmptyState Icon={Newspaper} title={t('empty')} />
        ) : (
          <ul className="grid gap-5 md:grid-cols-3">
            {posts.map((post, index) => (
              <Reveal as="li" key={post.slug} delay={Math.min(index, 5) * 0.06} className="h-full">
                <Link
                  href={`/news/${post.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-card border border-border-subtle bg-surface p-6 shadow-raise transition-all duration-200 hover:-translate-y-1 hover:shadow-float"
                >
                  <p className="inline-flex items-center gap-2 font-mono text-2xs text-ink-muted">
                    <CalendarDays className="size-3.5" aria-hidden />
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
                  </p>
                  <h3 className="font-display text-base text-ink dark:text-white">
                    {pick(post.title, locale)}
                  </h3>
                  <p className="flex-1 text-xs leading-relaxed text-ink-soft dark:text-navy-200">
                    {pick(post.excerpt, locale)}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-glaze-700 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-glaze-300">
                    {tc('learnMore')}
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

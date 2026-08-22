import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { CalendarDays, ArrowLeft } from 'lucide-react'
import { isLocale, LOCALES, pick } from '@leader/shared/locales'
import { Link } from '@/i18n/navigation'
import { getPost, getPosts } from '@/content/posts'
import { PageHeader } from '@/components/site/page-header'
import { Section } from '@/components/ui/section'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { JsonLd, breadcrumbJsonLd, articleJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string; slug: string }> }

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => getPosts().map((post) => ({ locale, slug: post.slug })))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const post = getPost(slug)
  if (!post) return {}

  return pageMetadata({
    locale,
    path: `/news/${slug}`,
    title: pick(post.title, locale),
    description: pick(post.excerpt, locale),
  })
}

export default async function PostPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const post = getPost(slug)
  if (!post) notFound()

  const tn = await getTranslations('nav')
  const title = pick(post.title, locale)
  const published = new Date(post.publishedAt)

  return (
    <>
      <JsonLd data={articleJsonLd(post, locale)} />
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: tn('news'), path: '/news' },
          { name: title, path: `/news/${post.slug}` },
        ])}
      />

      <PageHeader
        title={title}
        breadcrumb={[{ label: tn('news'), href: '/news' }, { label: title }]}
      />

      <Section>
        <article className="container-site max-w-3xl">
          <p className="mb-8 inline-flex items-center gap-2 font-mono text-2xs text-ink-muted">
            <CalendarDays className="size-4" aria-hidden />
            <time dateTime={post.publishedAt}>
              {published.toLocaleDateString(
                locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-GB',
                { day: '2-digit', month: '2-digit', year: 'numeric' },
              )}
            </time>
          </p>

          <div className="flex flex-col gap-5">
            {post.body.map((paragraph, index) => (
              <p key={index} className="text-sm leading-relaxed text-ink-soft dark:text-navy-200">
                {pick(paragraph, locale)}
              </p>
            ))}
          </div>

          <Link
            href="/news"
            className="mt-12 inline-flex h-12 items-center gap-2 rounded-pill border border-navy-600/25 px-5 text-xs font-medium text-navy-700 transition-colors hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-800"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {tn('news')}
          </Link>
        </article>
      </Section>

      <LeadFormSection />
    </>
  )
}

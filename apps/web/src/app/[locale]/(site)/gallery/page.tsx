import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Images } from 'lucide-react'
import { isLocale, pick, type Locale } from '@leader/shared/locales'
import { PageHeader } from '@/components/site/page-header'
import { Section } from '@/components/ui/section'
import { Eyebrow } from '@/components/ui/section'
import { EmptyState } from '@/components/ui/empty-state'
import { GalleryGrid } from '@/components/site/gallery-grid'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { getAlbums } from '@/content/gallery'
import { JsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return pageMetadata({ locale, path: '/gallery', namespace: 'gallery' })
}

export default async function GalleryPage({ params }: Props) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()
  setRequestLocale(raw)

  const locale = raw as Locale
  const t = await getTranslations('pages.gallery')
  const tn = await getTranslations('nav')
  const albums = getAlbums()

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: tn('gallery'), path: '/gallery' }])} />
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumb={[{ label: tn('gallery') }]}
      />

      {albums.length === 0 ? (
        <Section>
          <div className="container-site">
            <EmptyState Icon={Images} title={t('empty')} />
          </div>
        </Section>
      ) : (
        albums.map((album, index) => (
          <Section
            key={album.slug}
            id={album.slug}
            className={index % 2 === 1 ? 'bg-surface/60' : undefined}
          >
            <div className="container-site flex flex-col gap-7">
              <div className="flex flex-col gap-3">
                <Eyebrow>{new Date(album.date).getFullYear()}</Eyebrow>
                <h2 className="display-section text-ink dark:text-white">
                  {pick(album.title, locale)}
                </h2>
                <p className="max-w-xl text-sm text-ink-soft dark:text-navy-200">
                  {pick(album.description, locale)}
                </p>
              </div>

              <GalleryGrid
                label={pick(album.title, locale)}
                entries={album.items.map((entry) => ({
                  id: entry.id,
                  caption: pick(entry.caption, locale),
                  image: entry.image,
                }))}
              />
            </div>
          </Section>
        ))
      )}

      <LeadFormSection />
    </>
  )
}

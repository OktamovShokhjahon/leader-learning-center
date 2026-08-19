import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { MapPin, Phone, Clock, ExternalLink } from 'lucide-react'
import { isLocale, LOCALES, pick } from '@leader/shared/locales'
import { getBranch, getBranches } from '@/content/branches'
import { getCourse } from '@/content/courses'
import { PageHeader } from '@/components/site/page-header'
import { Section, SectionHeading } from '@/components/ui/section'
import { CourseCard } from '@/components/site/sections/courses'
import { LeadFormSection } from '@/components/site/sections/lead-form-section'
import { JsonLd, branchJsonLd, breadcrumbJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/page-meta'

export const revalidate = 300

type Props = { params: Promise<{ locale: string; slug: string }> }

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => getBranches().map((branch) => ({ locale, slug: branch.slug })))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const branch = getBranch(slug)
  if (!branch) return {}

  return pageMetadata({
    locale,
    path: `/filiallar/${slug}`,
    title: pick(branch.name, locale),
    description: `${pick(branch.name, locale)} — ${pick(branch.address, locale)}. ${pick(branch.workingHours, locale)}`,
  })
}

export default async function BranchDetailPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  const branch = getBranch(slug)
  if (!branch) notFound()

  const t = await getTranslations('home.branches')
  const tc = await getTranslations('common')
  const tn = await getTranslations('nav')

  const courses = branch.courseSlugs.map(getCourse).filter((course) => course !== undefined)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${branch.geo.lat},${branch.geo.lng}`

  return (
    <>
      <JsonLd data={branchJsonLd(branch, locale)} />
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: tn('branches'), path: '/filiallar' },
          { name: pick(branch.name, locale), path: `/filiallar/${branch.slug}` },
        ])}
      />

      <PageHeader
        title={pick(branch.name, locale)}
        subtitle={pick(branch.address, locale)}
        breadcrumb={[
          { label: tn('branches'), href: '/filiallar' },
          { label: pick(branch.name, locale) },
        ]}
      />

      <Section>
        <div className="container-site grid gap-8 md:grid-cols-3">
          <InfoCard Icon={MapPin} label={tc('address')} value={pick(branch.address, locale)}>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-glaze-700 hover:underline dark:text-glaze-300"
            >
              {t('viewOnMap')}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </InfoCard>

          <InfoCard Icon={Phone} label={tc('phone')} value="">
            <ul className="flex flex-col gap-1">
              {branch.phones.map((phone) => (
                <li key={phone}>
                  <a
                    href={`tel:${phone.replace(/\s/g, '')}`}
                    className="font-mono text-sm text-ink hover:text-glaze-700 dark:text-white"
                  >
                    {phone}
                  </a>
                </li>
              ))}
            </ul>
          </InfoCard>

          <InfoCard
            Icon={Clock}
            label={tc('workingHours')}
            value={pick(branch.workingHours, locale)}
          />
        </div>
      </Section>

      <Section className="bg-surface/60">
        <div className="container-site">
          <SectionHeading title={t('coursesHere')} />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course, index) => (
              <CourseCard key={course.slug} course={course} index={index} />
            ))}
          </ul>
        </div>
      </Section>

      <LeadFormSection />
    </>
  )
}

function InfoCard({
  Icon,
  label,
  value,
  children,
}: {
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  value: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface p-6">
      <span className="inline-flex size-11 items-center justify-center rounded-input bg-glaze-50 text-glaze-700 dark:bg-navy-800 dark:text-glaze-300">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </span>
      {value ? <p className="text-sm text-ink dark:text-white">{value}</p> : null}
      {children}
    </div>
  )
}

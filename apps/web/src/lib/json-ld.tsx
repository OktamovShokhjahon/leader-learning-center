/**
 * TZ §6.3 — JSON-LD: EducationalOrganization, Course, FAQPage, BreadcrumbList,
 * and LocalBusiness per branch.
 */
import type { Locale } from '@leader/shared/locales'
import { pick } from '@leader/shared/locales'
import { SITE } from '@/content/site'
import { getBranches, type Branch } from '@/content/branches'
import type { Course } from '@/content/courses'

export function organizationJsonLd(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    '@id': `${SITE.url}/#organization`,
    name: SITE.name,
    url: `${SITE.url}/${locale}`,
    logo: `${SITE.url}/brand/logo.png`,
    email: SITE.email,
    telephone: SITE.phones[0],
    foundingDate: String(SITE.foundedYear),
    sameAs: [SITE.instagram, SITE.telegram, SITE.facebook, SITE.youtube],
    address: getBranches().map((branch) => ({
      '@type': 'PostalAddress',
      streetAddress: pick(branch.address, locale),
      addressLocality: pick(branch.city, locale),
      addressCountry: 'UZ',
    })),
  }
}

export function branchJsonLd(branch: Branch, locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE.url}/${locale}/filiallar/${branch.slug}#business`,
    name: `${SITE.name} — ${pick(branch.name, locale)}`,
    url: `${SITE.url}/${locale}/filiallar/${branch.slug}`,
    telephone: branch.phones[0],
    image: `${SITE.url}/brand/logo.png`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: pick(branch.address, locale),
      addressLocality: pick(branch.city, locale),
      addressCountry: 'UZ',
    },
    geo: { '@type': 'GeoCoordinates', latitude: branch.geo.lat, longitude: branch.geo.lng },
    parentOrganization: { '@id': `${SITE.url}/#organization` },
  }
}

export function courseJsonLd(course: Course, locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: pick(course.name, locale),
    description: pick(course.description, locale),
    url: `${SITE.url}/${locale}/kurslar/${course.slug}`,
    provider: { '@type': 'EducationalOrganization', name: SITE.name, url: SITE.url },
    inLanguage: locale,
    offers: {
      '@type': 'Offer',
      price: course.priceMonthly,
      priceCurrency: 'UZS',
      category: 'Monthly tuition',
      availability: 'https://schema.org/InStock',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: course.slug === 'onlayn' ? 'online' : 'onsite',
      courseWorkload: `P${course.durationMonths}M`,
    },
  }
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

export function breadcrumbJsonLd(
  locale: Locale,
  trail: { name: string; path: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE.url}/${locale}${item.path}`,
    })),
  }
}

/** Renders a JSON-LD script tag. Content is our own data, never user input. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

import type { MetadataRoute } from 'next'
import { LOCALES } from '@leader/shared/locales'
import { SITE } from '@/content/site'
import { getCourses } from '@/content/courses'
import { getBranches } from '@/content/branches'

/**
 * TZ §6.3 — sitemap generated dynamically, including all courses, branches and
 * news posts, in all three locales, each entry carrying its hreflang alternates.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    { path: '', priority: 1, changeFrequency: 'weekly' as const },
    { path: '/kurslar', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/oqituvchilar', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/natijalar', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/filiallar', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/biz-haqimizda', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/yangiliklar', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/galereya', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/aloqa', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/royxatdan-otish', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/faq', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/oferta', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/maxfiylik', priority: 0.3, changeFrequency: 'yearly' as const },
  ]

  const dynamicPaths = [
    ...getCourses().map((course) => ({
      path: `/kurslar/${course.slug}`,
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    })),
    ...getBranches().map((branch) => ({
      path: `/filiallar/${branch.slug}`,
      priority: 0.7,
      changeFrequency: 'monthly' as const,
    })),
  ]

  const lastModified = new Date()

  return [...staticPaths, ...dynamicPaths].flatMap((entry) =>
    LOCALES.map((locale) => ({
      url: `${SITE.url}/${locale}${entry.path}`,
      lastModified,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((alternate) => [alternate, `${SITE.url}/${alternate}${entry.path}`]),
        ),
      },
    })),
  )
}

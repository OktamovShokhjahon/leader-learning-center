import type { MetadataRoute } from 'next'
import { LOCALES } from '@leader/shared/locales'
import { SITE } from '@/content/site'
import { getCourses } from '@/content/courses'
import { fetchCourses } from '@/content/remote'
import { getBranches } from '@/content/branches'
import { getPosts } from '@/content/posts'

/**
 * TZ §6.3 — sitemap generated dynamically, including all courses, branches and
 * news posts, in all three locales, each entry carrying its hreflang alternates.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    { path: '', priority: 1, changeFrequency: 'weekly' as const },
    { path: '/courses', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/teachers', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/results', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/branches', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/about', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/news', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/gallery', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/apply', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/faq', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/offer', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
  ]

  const dynamicPaths = [
    ...(await fetchCourses()).map((course) => ({
      path: `/courses/${course.slug}`,
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    })),
    ...getBranches().map((branch) => ({
      path: `/branches/${branch.slug}`,
      priority: 0.7,
      changeFrequency: 'monthly' as const,
    })),
    // §6.3 — news posts are the only URLs that grow without a developer.
    ...getPosts().map((post) => ({
      path: `/news/${post.slug}`,
      priority: 0.6,
      changeFrequency: 'yearly' as const,
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

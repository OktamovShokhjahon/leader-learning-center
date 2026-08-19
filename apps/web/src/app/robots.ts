import type { MetadataRoute } from 'next'
import { SITE } from '@/content/site'

/** TZ §6.3 — robots.txt generated dynamically alongside the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The panels and the BFF are private surfaces, not public pages.
        disallow: ['/api/', '/uz/kirish', '/ru/kirish', '/en/kirish'],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}

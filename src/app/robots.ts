import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/**
 * Savborne — robots
 *
 * Every app route is behind the wallet gate, so there is nothing for a crawler
 * to index beyond the entry page. `/card/*` is deliberately excluded: those are
 * per-player share cards, and a savers' names should not end up in a search
 * index because someone pasted a link into a public place.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/card/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}

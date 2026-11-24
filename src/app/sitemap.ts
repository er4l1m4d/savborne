import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/**
 * Savborne — sitemap
 *
 * One entry, on purpose. Everything else in the app is either gated behind a
 * wallet-signed session or private to a player, and listing those would only
 * feed a crawler a wall of "Preparing Savborne…".
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}

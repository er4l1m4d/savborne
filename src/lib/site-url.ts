/**
 * Savborne — canonical site URL
 *
 * Link previews, robots and the sitemap all need absolute URLs, and all of them
 * must name the *stable* production host. `VERCEL_URL` is the per-deployment
 * host (savborne-<hash>.vercel.app), which would pin those artefacts to a frozen
 * build; `VERCEL_PROJECT_PRODUCTION_URL` is the project's production domain.
 *
 * The localhost fallback keeps dev quiet instead of emitting a build warning.
 */

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')

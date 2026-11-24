import type { NextConfig } from "next";
import path from "node:path";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Response headers. The frame-ancestors rule is the one that matters: Savborne
  // renders Deposit and Withdraw, so a page that could frame it could sit an
  // invisible overlay over those buttons. It stays frameable by Nimiq's own
  // hosts because the open-link wrapper is a legitimate framer; everyone else
  // is refused. Deliberately a partial CSP (frame-ancestors only) rather than a
  // full policy: a script-src list would have to enumerate Next's inline
  // hydration and the Supabase origins, and a policy that breaks the app is
  // worse than the hole it closes.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "frame-ancestors 'self'",
              'https://*.nimiq.com',
              'https://nimiq.com',
              'https://nimpay.app',
              'https://*.nimpay.app',
              'https://*.nimiq.app',
            ].join(' '),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  // Keep the security-upgrade guard armed: `next build` re-checks the installed
  // version against the advisory feed and fails closed if a new one lands, so a
  // dependency that ships later inherits the same protection (16.4.1 -> 16.4.6,
  // 2026-11-23).
  experimental: {
    agentUpgrade: "security",
  },
  // The public tunnel for local development is machine-specific, so the host
  // list comes from ALLOWED_DEV_ORIGINS (e.g. "*.instabox.tech") rather than
  // being committed as product configuration.
  ...(allowedDevOrigins && allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  // `@nimiq/core` is a WASM/worker package that Turbopack cannot bundle for a
  // server route (its node build imports `comlink` workers and `.mjs` wasm
  // loaders). Keep it external and let Node require it at runtime. This is a
  // server-only dependency: the browser build is loaded from
  // `@nimiq/core/web` inside `src/lib/vault/phrase.ts`.
  serverExternalPackages: ["@nimiq/core"],
  // NOTE: `cacheComponents` and `partialPrefetching` are Next.js 16
  // experimental features. `cacheComponents` rejects `runtime = 'nodejs'`
  // on route handlers, and `partialPrefetching` requires `cacheComponents`.
  // Supabase-js needs Node runtime for its connection handling, so both
  // experimental flags are disabled. Add them back if the app moves to
  // Edge-compatible DB access.
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

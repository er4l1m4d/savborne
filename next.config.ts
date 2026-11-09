import type { NextConfig } from "next";
import path from "node:path";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
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

import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The InstaBox tunnel serves the dev server under a public hostname. Next 16
  // blocks cross-origin dev assets (including the client chunks needed for
  // hydration) unless the host is listed here, which leaves the Nimiq Pay
  // WebView stuck on the server-rendered "Preparing Savborne" state.
  allowedDevOrigins: ["*.instabox.tech"],
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

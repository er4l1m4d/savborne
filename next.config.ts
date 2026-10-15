import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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

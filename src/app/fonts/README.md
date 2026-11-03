# Vendored fonts

These files are the app's typefaces, committed so `next build` never has to reach
Google. `src/app/layout.tsx` loads them with `next/font/local`.

| File | Family | Weight | Subset |
| --- | --- | --- | --- |
| `plus-jakarta-sans-latin-var.woff2` | Plus Jakarta Sans | `200 800` (variable) | latin |
| `silkscreen-400-latin.woff2` | Silkscreen | 400 | latin |
| `silkscreen-700-latin.woff2` | Silkscreen | 700 | latin |

Regenerate with `npm run fonts:vendor` (`scripts/vendor-fonts.mjs`). That script
is the only thing in the repo that talks to `fonts.googleapis.com`; it fetches the
latin subset, verifies the `wOF2` magic bytes, and overwrites these files.

## Why vendored

`next/font/google` downloads the stylesheet and every font file during the build.
On 2026-11-03 a Vercel production build of a docs-only commit failed during that
fetch with 20 × `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'`
/ `next/font/google queries have exactly one entry`. The same commit built cleanly
locally, and upstream tracks this as an intermittent Turbopack font-URL bug
(vercel/next.js#99114, #97344, #97376). Self-hosting takes the network out of the
build path permanently. Details are in `ERRORS.md`.

## Subset

Latin only, matching the previous `subsets: ["latin"]` config. Text outside that
range falls back to the system stack, exactly as it did before. If the app ever
needs another script, add its slice here and to `scripts/vendor-fonts.mjs`.

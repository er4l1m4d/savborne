# Savborne

A savings RPG that runs inside [Nimiq Pay](https://nimiq.com) as a Mini App. Enter for the [Nimiq Mini Apps Competition, Cycle III](https://miniappscompetition.com) — Save track.

**Never holds, moves, or controls your money.** Connect one dedicated NIM savings account. Every time you open the app and check in, Savborne reads that account's balance via `getBalance` and turns your saving progress into XP, items, missions, badges, and rank.

## The loop

Connect a savings account → check in daily → earn XP and streaks → unlock items at balance brackets (Entry / Bronze / Silver / Gold) → battle other players or the AI → climb the leaderboard.

## Tech stack

- **Next.js 16 (App Router)** — frontend + API routes, deployed on Vercel
- **Supabase** (Postgres + RLS) — game state, matchmaking queue, atomic XP ledger
- **`@nimiq/mini-app-sdk`** — provider bridge inside the Nimiq Pay WebView
- **Tailwind CSS v4** — pixel-RPG design tokens (dark green shell, mint/coral/butter accents)
- **Jakarta Sans + Silkscreen** — body + display fonts

## Getting a local copy running

Requirements: Node.js 20+, a Supabase project, and (to test inside a wallet) a phone with Nimiq Pay installed.

```bash
git clone https://github.com/er4l1m4d/savborne.git
cd savborne
npm install
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

Apply the schema by pasting **`supabase/FINAL-SCHEMA.sql`** into the Dashboard
SQL Editor and running it — it is fully idempotent (safe to re-run on any
state of the database). Timestamped files in `supabase/migrations/` are the
historical record and the path for `supabase db push` where the pooler is
reachable.

## Testing inside Nimiq Pay

Because `getBalance` only works from within the Nimiq Pay WebView, local testing requires a public HTTPS URL. Either:

```bash
# Option A — Vercel preview
npm i -g vercel && vercel --env-file .env.local

# Option B — tunnel the local dev server
npx localtunnel --port 3000
```

Then open the URL inside Nimiq Pay, or via a deeplink:
`nimiqpay://miniapp?url=<your-tunnel-url>`

## Repo layout

| Path | Purpose |
|---|---|
| `src/app/` | Next.js App Router pages + API routes |
| `src/lib/` | Supabase + Nimiq SDK wrappers, game logic (constants, awards, missions, streaks, time) |
| `src/components/` | Shared UI (VersionGate, later the tab shell and battle widgets) |
| `supabase/migrations/` | SQL schema and RPC functions |
| `docs/` | Product spec, UI direction, type & colour specimen |
| `savborne-spike/` | Standalone proof-of-concept for `getBalance` — gitignored, not part of the app |
| `ERRORS.md` | Running log of every build-time and runtime error and its fix |

## Competition context

- **Cycle III window:** 14 October 2026 → 11 November 2026
- **Track:** Save (individual savings with a game layer)
- **Early access checkpoint:** 28 October 2026 — the live URL must work inside Nimiq Pay for real users by then
- **Target submission:** 8 November 2026

## Licence

MIT — © 2026 Oluwadamilare (GitHub: [er4l1m4d](https://github.com/er4l1m4d))

## Contact

`damilareogooluwade@outlook.com`

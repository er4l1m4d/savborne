# Savborne

A savings RPG that runs inside [Nimiq Pay](https://nimiq.com) as a Mini App. Enter for the [Nimiq Mini Apps Competition, Cycle III](https://miniappscompetition.com) — Save track.

**Never holds, moves, or controls your money.** Onboarding generates a 24-word phrase on your device and derives a vault address from it. Deposits are signed by your Nimiq Pay wallet and withdrawals are signed in-browser by that phrase; the server can read the vault address on chain but cannot move a single luna. If you lose the phrase and your device, the NIM in the vault is unrecoverable — Savborne cannot restore it. Check in daily and Savborne reads the vault balance over Nimiq's RPC and turns your saving progress into XP, items, missions, badges, and rank.

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
SQL Editor and running it - it is fully idempotent (safe to re-run on any
state of the database). It is the only SQL file; the timestamped migrations
were removed in favour of the single source of truth.

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
| `src/lib/` | Supabase + Nimiq SDK wrappers, vault crypto/signing, game logic (constants, awards, missions, streaks, time) |
| `src/lib/vault/` | Vault: address, RPC, verification, settlement, phrase crypto, receipts, card data |
| `src/components/` | Shared UI (VersionGate, VaultGuard, VaultTour, tab shell, battle widgets) |
| `supabase/FINAL-SCHEMA.sql` | The one idempotent SQL file: schema, seeds, RLS, grants and RPCs |
| `docs/` | Product spec, plans, handoff notes |
| `scripts/vault-e2e.mjs` | Testnet end-to-end probe for the money path (`npm run vault:e2e`) |
| `ERRORS.md` | Running log of every build-time and runtime error and its fix |

## Competition context

- **Cycle III window:** 14 October 2026 → 11 November 2026
- **Track:** Save (individual savings with a game layer)
- **Vault build:** 2 November 2026 — non-custodial vault (deposit, on-chain proof,
  check-in against the real balance, withdraw) live on testnet; device pass pending
- **Target submission:** 8 November 2026

## Licence

MIT — © 2026 Oluwadamilare (GitHub: [er4l1m4d](https://github.com/er4l1m4d))

## Contact

`damilareogooluwade@outlook.com`

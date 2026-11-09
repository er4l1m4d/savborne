# Check-in and standing integrity - backlog

**Date:** 2026-11-09
**Status:** release gate landed in code on `battle-ui-redesign`; migration pending deployment
**Origin:** Home UI review discussion about automatic check-ins and players hiding withdrawals.
**Release gate:** do not expose ranked battles publicly until item 1 below is fixed.

## Why this exists

The current check-in is the only time the server reads a player's vault balance.
The balance read itself is trustworthy: `/api/check-ins` reads the chain
server-side and never accepts a client-reported amount. The weakness is that the
player controls **when** that read happens, and several counters/writes are not
idempotent.

That lets a player hide a withdrawal by not checking in, keep a stale bracket on
the leaderboard, or spam the endpoint to inflate `check_in_count` and unlock
ranked without five days.

## Implementation status (2026-11-09)

The release gate is implemented on `battle-ui-redesign`:

- `supabase/FINAL-SCHEMA.sql` adds the generated `utc_date`, the unique
  `(player_address, utc_date)` index, the distinct-day backfill, the
  `commit_check_in` transaction and the `consume_rate_limit` fixed window. It
  is the only SQL file; the old migrations are in git history.
- `POST /api/check-ins` rate-limits before any read, returns the idempotent
  full response on a same-day POST, and writes only through
  `commit_check_in`.
- `/api/queue/join` continues to gate on the derived `check_in_count`.

Route tests and the SQL contract test pass. The live five-POST, concurrency
and rate-limit checks still require a Supabase project and `.env.local`; apply
the migration before ranked is public.

## Gaps

### Standing and fairness

1. A withdrawal can be hidden indefinitely by never checking in; `current_balance_luna` and `bracket` stay old.
2. The leaderboard uses `players.bracket` and level, which only change at check-in.
3. Ranked queue join uses the stored bracket and `check_in_count`; both can be stale or inflated.
4. Week Warrior / Iron Saver are revoked only when a check-in detects a lower reading.
5. Golden Crown and bracket status can be held after a demotion until check-in; items are meant to stay, the crown badge is not.
6. `withdrawal_in_progress` and the Steady Saver reset are only updated at check-in.
7. Intraday withdraw-and-redeposit is invisible to any sampled read.

### Ledger and rewards

8. `check_in_count` increments on every POST, even the same UTC day. Ranked requires 5; a script can unlock it in a minute.
9. `check_ins` has no unique `(player_address, utc_date)`; duplicate rows are accepted.
10. Concurrent POSTs can both read "no check-in today" and both award; no idempotency key or unique constraint.
11. The check-in insert, player update and reward writes are not one transaction; a failure can leave an orphan row or partial reward.
12. A retry after a partial failure can see the orphan row as "already checked in today" and skip the reward it owed.
13. The disabled Home button is client-side only; the API accepts direct POSTs.
14. Check-in has no wallet signature; it trusts `X-Player-Address`. A script or third party can trigger it for a known address, automate the ritual, or grief a player's withdrawal flags/badges.
15. There is no rate limit on `/api/check-ins`.

### Freshness and operations

16. Home shows `players.current_balance_luna` (last check-in) while Vault reads the chain live; the two can disagree.
17. There is no scheduled reading; history exists only when the player checks in.
18. An RPC failure blocks the only reading; no retry/catch-up queue.
19. Readings have no `source` (`player`/`cron`) or `claimed_at`; a future snapshot/claim flow needs a schema change.
20. Bracket unlocks, items and celebrations are gated by the player opening the app. That is partly a design choice.

## Not a gap

The server reads the vault balance from the chain. A player cannot submit a fake
amount, and a failed read is not treated as zero.

## Fix order

### 1. Release gate - ledger correctness

- Add `utc_date` and unique `(player_address, utc_date)` to the reading table.
- Derive `check_in_count` from distinct UTC days, not POSTs.
- Move the insert + player update + rewards into one Postgres function/transaction.
- Use `ON CONFLICT DO NOTHING` and an idempotency key / `claimed_at`.
- Rate-limit the endpoint.

Closes gaps 8-13, 19. Small migration and API change; no UI redesign.

### 2. Trust

- Require a signed message with nonce/timestamp for player-triggered check-in/claim; verify server-side (the delete flow already has this pattern).
- Give the cron a separate `CRON_SECRET`, never a player header.

Closes gaps 14-15.

### 3. Separate reading from claiming (Option 2)

- A protected 00:00 UTC job reads every vault from the chain and upserts one row per player/day.
- The job updates `current_balance_luna`, `bracket`, withdrawal flags, crown/streak badge revocation and pending celebrations.
- It does not award daily XP or the check-in streak.
- The player claim loads the stored reading, awards XP/streak/missions and marks it claimed.
- Decide whether snapshots count for the streak or only claims do. If snapshots count, the streak is automatic and the claim is a reward; if only claims count, a forgotten claim still breaks the streak.

Closes gaps 1-6, 16-18 for day-level changes.

### 4. Read standing at the moment it matters

- At ranked queue join and match creation, read the vault balance from the chain (or a short TTL cache) and derive the bracket there.
- Refresh the leaderboard on read or use a short cache.

Closes gap 7 and the "stale at the moment of truth" risk. Full intraday accuracy needs chain event indexing.

### 5. Continuous monitoring (only if intraday timing matters)

- Index vault transactions/events or poll more frequently. This is the only way to see a withdraw-and-redeposit between samples.

## Policy limits

- **Intraday withdraw-and-redeposit** cannot be seen without continuous monitoring; any sampling policy has a window.
- **Proof of human presence** is impossible. A signature proves wallet control, not that a person tapped. A user can automate their own approved wallet.

## Acceptance tests for the release gate

- Five POSTs in one UTC day leave `check_in_count` at 1 and do not unlock ranked.
- Two concurrent POSTs produce one reading and one reward set.
- A failed player update leaves no orphan reading and no partial reward.
- A direct POST without a valid signature is rejected after step 2.
- The ranked gate uses distinct-day count.

## Relevant code

- `src/app/api/check-ins/route.ts`
- `src/app/api/queue/join/route.ts`
- `src/app/api/leaderboards/route.ts`
- `src/lib/game/streaks.ts`
- `src/lib/vault/rpc.ts`
- `supabase/FINAL-SCHEMA.sql` (`check_ins`, `players`, `daily_xp`,
  `api_rate_limits`)

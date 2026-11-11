# Spec - standing freshness (daily readings vs the claimed ritual)

**Date:** 2026-11-11
**Status:** implemented and decided: the streak counts claimed days.
**Closes:** backlog gaps 1-7, 16-20 for day-level changes.

## Decision

**The streak is the ritual. Standing is the reading.**

- A **reading** is a balance snapshot for one player and UTC day. It can come
  from the player's check-in (`source = 'player'`) or the daily cron
  (`source = 'cron'`). Readings keep `current_balance_luna`, `bracket`,
  withdrawal flags and status badges fresh.
- A **claim** is a player check-in. It marks the day's reading
  `claimed_at = now` and awards XP, missions, streak progress and unlocks
  exactly once.
- `players.check_in_count` counts **claimed days only**. A cron snapshot can
  never unlock ranked.
- A forgotten claim breaks the streak even though the cron recorded the
  balance. That is the point of the ritual: showing up is the game.

This is the final product rule. A cron reading keeps standing fresh but never
performs the ritual; only a claim advances the streak or ranked count.

## Daily flow

1. **00:00 UTC cron** (`GET /api/cron/read-vaults`, `Authorization: Bearer
   $CRON_SECRET`):
   - pages vaults 100 at a time, concurrency 5, 8s per RPC call, 45s budget;
   - reads each vault on chain, derives the bracket in TypeScript, calls
     `record_reading`;
   - `record_reading` upserts the day's reading, updates the player's balance,
     bracket, withdrawal flags, and revokes Golden Crown below Gold and the
     withdrawal badges on a lower balance;
   - it awards **no** XP, streak day, mission or claim;
   - a cursor in `cron_state` resumes an incomplete page next run;
   - it never accepts a player header and never returns an address.

2. **Player check-in** (`POST /api/check-ins`):
   - still requires the wallet proof; the session is added on top;
   - if today's reading exists and is already claimed -> idempotent response;
   - if today's reading exists but is unclaimed -> claim it using the **stored**
     balance, no chain read;
   - if no reading exists -> read the chain and insert the day;
   - `commit_check_in` wraps the reading, player patch, XP, missions, items and
     badges in one transaction and sets `claimed_at` exactly once.

3. **Ranked queue join** reads the vault balance from chain on every join and
   derives the bracket there. `match_me` still re-checks the stored bracket at
   match time.

4. **Leaderboard** derives each row's bracket from that player's latest reading
   (SQL) with no cache, so a claim or snapshot is visible immediately. It no
   longer trusts `players.bracket`.

## Known limits

- Intraday withdraw-and-redeposit between two samples is invisible. Only
  continuous chain indexing would see it. This is stated as an accepted limit,
  not solved here.
- The cron runs once per day on Vercel Hobby. That matches the day-level
  product rule; it is not a real-time indexer.
- A failed reading is an error, never a zero balance. `NIMIQ_RPC_URLS` adds
  ordered fallback endpoints; each attempt has a timeout.
- `record_reading` revokes the crown/badges but does not re-award them. A
  re-award happens on the next claim through the existing reward pipeline
  (Golden Crown re-award polish is deferred).

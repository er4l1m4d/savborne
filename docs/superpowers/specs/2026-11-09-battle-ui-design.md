# Battle UI redesign - design

**Date:** 2026-11-09
**Status:** approved 2026-11-09 (all open decisions resolved)
**Branch:** `battle-ui-redesign` (from `main` at `b9a8cbf`)
**Depends on:** Foundation 2 primitives, the completed Economy and Home batches.
**Reference:** `Savborne-handoff.html` figures `A_BattleMenu`, `A_RankedLocked`,
`A_Queue`, `A_QueueTimeout`, `A_FriendWait`, `A_Battle`, `A_ItemSheet`,
`A_InBattleWait`, `A_Win`, `A_Loss`, `A_Tie`, `A_ConnLost`, `A_DailyLimit`,
and the check-in backlog `docs/superpowers/backlog/2026-11-09-check-in-integrity.md`.

---

## 1. Goal

Rebuild `/battle` and `/battle/[id]` around the handoff's Battle flow:

- A mode menu with Ranked, Friend and AI, plus the Ranked Locked and Daily Limit
  states.
- A real queue screen and a queue-timeout state.
- A friend-challenge-sent screen.
- An arena with both combatants, HP, sprites, a 2x2 move grid and an item sheet.
- An in-battle wait state and a connection-lost state.
- Win, loss and tie results as their own screen.

At the same time, land the check-in integrity release gate from the backlog so
ranked cannot be unlocked by five POSTs in one UTC day.

Success means:

- Every Battle screen at 360/390/430 matches the handoff's structure, rhythm
  and type hierarchy, using Foundation 2 primitives.
- The existing battle, queue, friend and AI APIs keep their contracts; the only
  additions are additive response fields and one cancel route.
- No battle-table or rules changes.
- Ranked is exposed only behind a distinct-UTC-day check-in count, an atomic
  check-in commit and a rate limit.

---

## 2. Scope

### In

- Restructure `/battle` into Ranked / Friend / AI mode cards.
- Ranked Locked card with Level and Check-ins progress bars.
- Daily Limit state with reset countdown and a Missions link.
- `/battle/queue`: searching, widening rating range, cancel, and timeout.
- `/battle/friend/[id]`: challenge sent, expiry countdown, copy link, cancel.
- `/battle/[id]`: arena, sprites, HP plates, 2x2 move grid, item
  `BottomSheet`, in-battle wait, connection-lost overlay.
- `/battle/[id]/result`: win, loss and tie screens.
- Additive Battle GET fields needed by the UI (levels, brackets, owned items,
  current move).
- `POST /api/battles/[id]/cancel` for the creator of an unanswered challenge.
- Check-in release gate: `utc_date` uniqueness, distinct-day count, atomic
  commit RPC and rate limit.
- Unit, route and source-contract tests; before/after renders and audit.

### Out

- Home or Economy screens.
- Battle rules, damage, turn order, AI strategy, settlement or XP values.
- Matchmaking logic, queue table shape or polling interval.
- Real-time transport; polling stays.
- New art assets. The existing `assets/characters.json` rival sprites are used.
- Onboarding, sound, haptics or new motion vocabulary.
- Retroactive repair of check-in rewards lost to legacy orphan rows.

---

## 3. Decisions

| Decision | Choice |
|---|---|
| Menu hierarchy | Ranked is coral when eligible. When locked, AI is coral and Ranked is an off panel. At the daily limit all three are off panels. |
| Mode card | `Button` gains an additive `size="mode"`: full width, 96px minimum, row layout, 18/16px padding, left aligned. Off cards use `PixelPanel tone="off"`. |
| Ranked Locked | Inline on `/battle`, not a separate route. Two `Meter`s and a secondary "Go to Missions" link. |
| Daily Limit | Coral reset panel with three used pips, a UTC-midnight countdown, three off cards and a secondary "Go to Missions" link. |
| Queue | Dedicated `/battle/queue`. Joins on mount, polls every 10s, leaves on back/unmount. Timeout at `RANKED.queueTimeoutSeconds = 185`. Search continues after timeout. |
| Queue timeout actions | Battle the AI leaves the queue then starts an AI battle. Challenge a friend leaves the queue, creates a challenge and opens the friend screen. |
| Friend challenge | Dedicated `/battle/friend/[id]` for the creator. A pending creator visiting `/battle/[id]` is redirected there. The joiner keeps the accept state on `/battle/[id]`. |
| Cancel challenge | Add `POST /api/battles/[id]/cancel`; creator only; pending with no opponent only; sets `abandoned`. |
| Results | Dedicated `/battle/[id]/result`. `/battle/[id]` redirects to it when a battle completes. |
| Result rating | Show the current rating from `/api/profile`, labelled "Ranked rating"; do not invent a delta. Unranked/AI show the W-L-T record instead. |
| Arena art | Human opponent: `CharacterArt` from the opponent's bracket. AI: `RivalArt`, chosen deterministically from the battle id so both players see the same rival. Viewer: `CharacterArt` from the viewer's bracket. |
| HP colours | Opponent coral, viewer mint, fixed regardless of percentage. |
| Status tags | `.sv-section-label` at 12px ("YOUR MOVE", "THEIRS", "ACTED", "OFFLINE"), not the 10px `.sv-state`. |
| Item sheet | `BottomSheet` with available, used and locked rows. Additive GET `viewer.ownedItems` supplies the locked set. |
| Connection lost | In-page overlay inside `/battle/[id]`, not a route. The poll keeps retrying; "Reconnect" fetches immediately. |
| Additive primitives | `Meter`; `Button` sizes `mode` and `item`; `BottomSheet` `headerAction`; `ScreenShell` `backLabel`; `RivalArt`. No new type sizes. |
| Mode title size | `.sv-subheading` (20px). The handoff's 24px Jakarta title is not in the Foundation 2 scale; the system wins. |
| Check-in gate | New migration with `check_ins.utc_date`, a unique `(player_address, utc_date)` index, a `commit_check_in` RPC and a `consume_rate_limit` RPC. |
| Check-in count | `players.check_in_count` is set from `count(*)` on `check_ins` inside the commit transaction, which equals distinct UTC days because of the unique index. |
| Check-in duplicate | A same-day POST returns `200` with the full normal response shape, `alreadyCheckedIn: true` and empty award arrays, without a chain read or write. |
| Check-in rate limit | Database fixed window: 10 requests per 60 seconds per player address, before any table or chain read. |

---

## 4. Screen anatomy

All screens use `ScreenShell`. Panels are `PixelPanel`; buttons and links are
`Button`/`ButtonLink`; status pills are `Chip`; notes are `Banner`; grouped
rows are `Row`.

### 4.1 Battle menu (`/battle`)

`ScreenShell variant="tab" title="Battle"`, actions:

```tsx
<Chip
  variant="outline"
  color={limitReached ? 'var(--coral-text)' : undefined}
>
  {battlesLeft} battles left today
</Chip>
```

Body order:

1. Error `Banner` when an action fails.
2. When the daily limit is reached, the Daily Limit panel first.
3. Ranked card:
   - Eligible: coral `ModeCard`, glyph `ranked`, title `Ranked`, blurb
     `Find a ranked match in your bracket.`, meta
     `Rating {rating} · {Bracket}`.
   - Locked: off `PixelPanel` with glyph `lock`, title `Ranked · Locked`,
     blurb `Reach Level 3 and complete 5 check-ins to unlock ranked battles.`,
     two `Meter` rows (`Level {level} of 3`, `Check-ins {count} of 5`) and a
     secondary `ButtonLink href="/missions"` `Go to Missions`.
4. Friend `ModeCard`, glyph `friend`, title `Friend`, blurb
   `Challenge a friend. Unranked.`
5. AI `ModeCard`: coral when ranked is locked, otherwise secondary. Title
   `AI Opponent`, blurb `Battle the Savborne AI. Unranked.` Icon is
   `RivalArt` at 32px (the handoff's robot glyph is not in
   `assets/glyphs.json`).
6. Off panel: `Battles reset at 00:00 UTC (1:00 AM Lagos time). Ranked, friend
   and AI battles all count toward the daily limit of 3.`

`ModeCard` is one component with two renderings:

- actionable: `Button variant={primary ? 'primary' : 'secondary'} size="mode"`;
- unavailable: `PixelPanel tone="off"` with the same inner content and no
  button role.

Both render a 36px icon slot, a `.sv-subheading` title, a `.sv-label` blurb and
an optional `.sv-label` meta line. The body text is
`min-w-0 flex-1`.

The ranked card is eligible only when
`level >= RANKED.minLevel && checkInCount >= RANKED.minCheckIns && bracket !== null`,
matching the queue-join route. If level and check-ins pass but `bracket` is
null, the locked card shows an extra line:
`Add at least 1 NIM to your savings account to unlock ranked.`

### 4.2 Ranked Locked

This is the locked Ranked card in 4.1. Progress values are capped at the
requirement, and the fill is mint. The link goes to `/missions` because XP and
check-ins both advance there. The card is not a disabled button; it is an off
panel with no action of its own.

### 4.3 Daily Limit

`PixelPanel tone="coral"`:

- Three 12px-high bars in a row, all coral, `aria-label="3 of 3 battles used"`.
- `.sv-subheading`:
  `You've started 3 battles today. New battles unlock at 00:00 UTC (1:00 AM Lagos time).`
- Baseline row: `Next battles in` (`.sv-label` muted) and a tabular
  `14h 52m` figure.

Then the three mode cards as off panels with their titles and blurbs, and a
secondary `ButtonLink href="/missions"` `Go to Missions`.

The countdown updates every 30 seconds from `nextUtcMidnight(now)`. When it
reaches zero the screen calls `refresh()` so `battlesToday` becomes 0 without a
manual reload.

### 4.4 Queue (`/battle/queue`)

`ScreenShell variant="pushed" title="Ranked" backHref="/battle"`, action
`Chip` `{Bracket} bracket`. If the player somehow has no bracket, the action is
omitted.

Body, searching:

1. `.sv-subheading`: `Searching for a ranked opponent in your bracket...`
2. `VersusCards` height 250:
   - viewer: mint panel, `CharacterArt` 80px, name, `Rating {rating}`;
   - opponent: off panel, 64px `?`, `Opponent`, `Not found yet`.
3. Stats panel: `Time in queue` label and `0:42` in `.sv-number-m`; `Rating
   range` label and `±{range}` in `.sv-subheading`.
4. Secondary `Button` `Leave queue` at the bottom.

The page joins on mount through `POST /api/queue/join`, then polls
`POST /api/queue/poll` every 10s. A match replaces the route with
`/battle/[id]`. The displayed timer advances locally every second from a
started-at ref and is corrected by each poll's `waitedSeconds`. The range uses
the server's `range`, falling back to `ratingRangeForWait(seconds)`.

Leaving (button, back link, or unmount) calls `POST /api/queue/leave`;
matched rows are protected server-side by the route's `neq('status',
'matched')` guard.

Timeout (`waitedSeconds >= 185`), while polling continues:

1. Stats panel becomes the hero: `Time in queue`, `3:05` in
   `.sv-number-xl`, `Rating range now ±600`.
2. `.sv-subheading` `No match yet.` and `.sv-body`
   `We'll keep searching. You can battle the AI or a friend while you wait.`
3. `Button size="mode" variant="primary"` `Battle the AI` with subline
   `Unranked. Counts toward today's 3 battles.`
4. `Button size="mode" variant="secondary"` `Challenge a friend` with subline
   `Unranked.`
5. Secondary `Leave queue`.

If the queue row disappears (`left: true`), show `Banner tone="info"` "Your
search ended. Start again from Battle." and a secondary link back. If
join/poll fails, show an error `Banner` and the back link.

### 4.5 Queue Timeout

This is the timeout branch of 4.4, not a separate route. It keeps the same
header and polling loop.

### 4.6 Friend Challenge Sent (`/battle/friend/[id]`)

`ScreenShell variant="pushed" backHref="/battle"` with `Chip` `Friend ·
Unranked`.

1. `.sv-heading` `Challenge sent`.
2. `.sv-body` `Your challenge is still waiting. It expires in 24 hours.`
3. `VersusCards` height 230:
   - viewer: `CharacterArt`, name, `Level {level} · {Bracket}`;
   - friend: off panel, `?`, `Friend`, `Waiting to join`.
4. Waiting panel: `Waiting for a friend` and a mint `.sv-figure`
   `23h 58m left`, from `createdAt + BATTLE.challengeExpiryHours`.
5. Off note: `Friend challenges are unranked and count toward your daily limit
   of 3 battles.`
6. Actions:
   - primary `Copy challenge link` (copies `${origin}/battle/${id}`);
   - secondary `Back to Battle`;
   - secondary `Cancel challenge` (opens a `BottomSheet` confirmation, then
     calls the cancel route and returns to `/battle`).

States:

- `active`: replace with `/battle/[id]`.
- `completed`: replace with `/battle/[id]/result`.
- `abandoned`: `PixelPanel` `Challenge expired`, `Nobody answered in time -
  no XP lost.`, secondary `Back to Battle`.
- not the creator: replace with `/battle/[id]`.
- error: `Banner` plus a back link.

The joiner's pending state stays on `/battle/[id]`: `{name} challenges you`,
`5 turns. No chance. Winner has more health.`, primary `Accept challenge`.

### 4.7 Battle arena (`/battle/[id]`)

`ScreenShell variant="pushed" title={`Turn {n} of 5`}`, with a 44px leave
icon action (`Glyph name="leave"`) linked to `/battle`.

Body:

1. `.sv-label text-fg-muted` `{Ranked|Unranked}. Opponent: {name}.`
2. `Arena` height 410 (380 below 390px):
   - opponent plate top-left, viewer plate bottom-right;
   - each plate 46% wide, max 168px, shell background, 2px bevel border;
   - plate row: name (truncated with a `title`), `Lv {level}`, status tag;
   - 14px `Meter`: opponent coral, viewer mint;
   - `{hp} / 100 HP` in `.sv-label` muted;
   - opponent sprite top-right 96px, mirrored; viewer sprite bottom-left
     112px.
   - Status tags: `THEIRS` on the opponent plate, `YOUR MOVE` on the viewer
     plate when it is the viewer's turn, `ACTED` after the viewer locks a move,
     `OFFLINE` when disconnected.
3. Copper Compass line when `viewer.opponentLastMove` is present:
   `.sv-label text-mint` `◈ Copper Compass: their last move was {move}.`
4. Compact last-turn line when `lastTurn` is present:
   `.sv-label text-fg-muted` with both moves and damage. No panel.
5. If `viewer.hasMovedThisTurn`: the in-battle wait panel (4.9).
   Else: `.sv-subheading` `Choose your move`, then a 2x2 grid of
   `Button size="move"`:
   - Attack: coral primary, glyph `attack`;
   - Defend: secondary, glyph `defend`;
   - Use item: secondary, glyph `useItem`, opens the item sheet; disabled when
     no owned item is inactive;
   - Special Move: secondary, glyph `special`, disabled on cooldown with a
     `.sv-label` `(cooldown: 1 turn)` below the label.
6. When `turnDeadline` is present, `.sv-label text-fg-faint` centered
   `Auto-Defend in {n}s`.

If the battle is `pending` and the viewer is not the creator, render the accept
state from 4.6 with the full arena omitted. If `abandoned`, render the expired
panel.

### 4.8 Item sheet

`BottomSheet open onClose title="Use an item" headerAction={close icon button}`.

Inside:

- `.sv-label text-fg-muted` `Each item can be used once per battle.`
- Available rows first, then used, then locked. Each row is a `Button
  size="item"`:
  - available: `variant="secondary"`, mint border, `ItemArt` 32px, name
    `.sv-label`, blurb `.sv-label text-fg-muted`, trailing `Use` in mint;
  - used: disabled, `Used` trailing;
  - locked: disabled, dashed soft border, blurb
    `Locked: reach {Bracket} to unlock.`
- Selecting an available item submits `{ move: 'item', itemKey }` and closes
  the sheet.

The sheet traps focus, closes on Escape/scrim, and returns focus to the Use
item button (existing `BottomSheet` behaviour).

### 4.9 In-battle wait

`PixelPanel tone="mint"`:

1. Row: `.sv-label text-fg-muted` `Your move is locked in` and a `Chip` with the
   submitted move name.
2. `.sv-subheading` `Waiting for your opponent to choose.`
3. 14px `Meter` with `secondsLeft / BATTLE.turnTimerSeconds`, mint fill, and a
   `.sv-figure text-fg-muted` `0:16 left`.

The timer comes from `battle.turnDeadline` and the existing 1s clock. At zero
the next poll resolves the turn with Defend.

### 4.10 Results (`/battle/[id]/result`)

`ScreenShell variant="pushed"` with no header; the result is the header.

Above `ResultPanel`, a centered `.sv-label text-fg-muted` subline:
`{Ranked|Unranked|Friend · Unranked} · vs {opponentName}`.

`ResultPanel`:
- 250px arena with viewer left and opponent right; the loser at 0.55 opacity,
  the winner at full opacity, both full on a tie;
- two tiles:
  - tile 1: `+{xp} XP`, label `Battle win` / `Battle loss` / `Battle tie`;
  - tile 2: ranked `{rating}`, label `Ranked rating`; unranked/AI
    `{wins}-{losses}-{ties}`, label `Record`.
- unlocks: when the viewer won, `profile.player.wins === 1` and
  `first_blade` is active, a `Row` with `BadgeArt badge="first_blade"
  state="earned"` and `First Blade earned` / `Your first battle win`.
- items used: when `viewer.activeItems` is non-empty, a `PixelPanel` `Items
  used` with `Row`s of `ItemArt` and name.
- actions: primary `Back to Battle` (`/battle`), secondary `Go to Home` (`/`).

If the battle is not completed, replace with `/battle/[id]`. If the profile
fetch fails, keep the XP tile and show a second tile `—` with the same label so
the grid stays two columns.

The title and arena play `sv-pop` once on mount; reduced motion collapses it.

### 4.11 Connection lost

When a poll fails, the battle screen sets `offline` and records the failure
time. It renders:

- the arena at 0.55 opacity with the viewer plate tag `OFFLINE`;
- `PixelPanel tone="coral"`:
  - alert glyph and `.sv-label` `Offline` in coral;
  - `.sv-subheading` `Connection lost. Your move will be saved if you reconnect
    within 60 seconds.`;
  - 14px coral `Meter` for the grace window and `.sv-figure` `0:47`;
  - `.sv-label text-fg-muted` `Until you reconnect, your next move defaults to
    Defend.`;
- primary `Reconnect`, which calls `fetchState()` immediately and shows the
  button's loading dots while it runs.

The 3s poll keeps running. A successful poll clears the overlay without a tap.
At zero the copy becomes `Reconnect to keep playing. Your next move may already
have defaulted to Defend.` and the button stays.

---

## 5. Data and APIs

### 5.1 Unchanged contracts

- `POST /api/battles/ai`
- `POST /api/battles/friend`
- `GET /api/battles/[id]`
- `POST /api/battles/[id]/join`
- `POST /api/battles/[id]/move`
- `POST /api/queue/join`
- `POST /api/queue/leave`
- `POST /api/queue/poll`
- `GET /api/profile`
- `GET /api/players/me`

No battle or queue schema changes.

### 5.2 Additive GET fields

`GET /api/battles/[id]` adds fields only; no existing field changes shape:

```ts
battle.opponentLevel: number | null
battle.opponentBracket: Bracket | null
viewer.level: number
viewer.bracket: Bracket | null
viewer.ownedItems: ItemKey[]        // all non-badge owned items
viewer.currentMove: { move: BattleMove; itemKey: ItemKey | null } | null
```

The route already reads the players rows for names and `player_items` for
ownership; the additions reuse those reads. `currentMove` is found in the
already-loaded `moves` for the viewer and current turn.

### 5.3 New cancel route

`POST /api/battles/[id]/cancel`

- Requires `X-Player-Address`.
- 404 when the battle does not exist.
- 403 when the caller is not `player_a`.
- 409 when `status !== 'pending'` or `player_b` is not null.
- On success sets `status = 'abandoned'` and returns `{ ok: true }`.

No schema change; `abandoned` already exists.

### 5.4 Result data

The result screen uses only existing data plus `GET /api/profile`:

- XP: `XP_VALUES.battleWin/battleLoss/battleTie` by outcome.
- Rating and record: `/api/profile`.
- Badges: `/api/profile` `activeBadges`.
- Items used: `GET /api/battles/[id]` `viewer.activeItems`.
- Outcome: `battle.winner` versus `viewer.address` (`null` = tie).

No rating delta is promised because the pre-battle rating is not persisted.

### 5.5 Helpers

New pure module `src/lib/battle-ui.ts`:

```ts
battlesLeft(battlesToday: number): number
rankedEligible(player: { level: number; checkInCount: number; bracket: string | null }): boolean
rankedProgress(player: { level: number; checkInCount: number }): {
  level: { value: number; max: number; label: string }
  checkIns: { value: number; max: number; label: string }
}
ratingRangeForWait(seconds: number): number
queueTimeLabel(seconds: number): string          // 0:42
formatCountdown(ms: number): string              // 14h 52m, 23h 58m, 0:16
nextUtcMidnight(now: Date): Date
battleOutcome(winner: string | null, viewerAddress: string): 'win' | 'loss' | 'tie'
battleXpForOutcome(outcome: 'win' | 'loss' | 'tie'): number
resultCopy(outcome: 'win' | 'loss' | 'tie'): { title: string; tone: 'mint' | 'coral' | 'cream' }
```

`RANKED.queueTimeoutSeconds = 185` is added to `constants.ts`.

New pure module `src/lib/game/rivals.ts`:

```ts
export const RIVAL_KEYS = [
  'Rival · Mint Wraith',
  'Rival · Hollow Ghost',
  'Rival · Hooded Miser',
  'Rival · Cutpurse',
] as const
export type RivalKey = (typeof RIVAL_KEYS)[number]
export function rivalForBattle(battleId: string): RivalKey
```

---

## 6. Check-in release gate

This section is required before ranked is exposed. It is a ledger fix, not a
UI change.

### 6.1 Migration

Add to `supabase/FINAL-SCHEMA.sql` (the only SQL file; migrations were removed):

1. Deduplicate existing `check_ins` rows by UTC day, keeping the earliest row
   per `(player_address, utc_date)`.
2. Add `check_ins.utc_date date generated always as
   (((recorded_at at time zone 'utc'))::date) stored`.
3. Add a unique index `check_ins_player_day_uidx` on
   `(player_address, utc_date)`.
4. Backfill `players.check_in_count` from
   `select count(*) from check_ins where player_address = players.address`.
5. Add `api_rate_limits(key text primary key, window_start timestamptz not
   null, count int not null)` with RLS enabled and no anon/authenticated
   policies.

### 6.2 Atomic commit

New service-role function `commit_check_in(...) returns jsonb`:

```text
p_address text
p_balance_luna bigint
p_recorded_at timestamptz
p_player jsonb          -- current_balance_luna, last_check_in_at, xp, level,
                        -- streak_current, streak_best, shields, shields_earned,
                        -- bracket, withdrawal_in_progress, last_withdrawal_at,
                        -- steady_hand_started_at
p_daily_xp int
p_missions jsonb        -- [{ mission_key, completed_at, reset_at }]
p_items jsonb           -- [{ item_key, unlocked_at }]
p_badges jsonb          -- [{ badge_key, action: 'award' | 'revoke', at }]
```

Inside one transaction:

1. `insert into check_ins (...) on conflict (player_address, utc_date) do
   nothing returning *`.
2. If no row was inserted, return
   `{ claimed: false, check_in_count: <players.check_in_count> }` and write
   nothing else.
3. `select count(*)` from `check_ins` for the player and use it as
   `players.check_in_count`; never add one to the previous value.
4. Update the player fields from `p_player`, with `check_in_count` taken from
   step 3.
5. Upsert `daily_xp` by adding `p_daily_xp`.
6. Insert `player_missions` rows.
7. Insert `player_items` rows with `on conflict do nothing`.
8. Award badges with `on conflict do nothing` on the active partial index;
   revoke badges by setting `revoked_at`.
9. Return `{ claimed: true, check_in_count }`.

Grant execute to `service_role` only; revoke from `public`, `anon` and
`authenticated`.

### 6.3 Rate limit

New service-role function `consume_rate_limit(p_key text, p_limit int,
p_window_seconds int) returns jsonb`:

- Fixed window in `api_rate_limits`.
- On a new or expired window, reset the count to 1 and the window start to
  `now()`.
- Otherwise increment.
- Return `{ allowed, remaining, retryAfterSeconds }`.

`/api/check-ins` calls it before any table or chain read with
`p_key = 'check-in:' || address`, `p_limit = 10`, `p_window_seconds = 60`.
A denied request is `429 { error: 'rate_limited', retryAfterSeconds }`.

### 6.4 Route changes

`POST /api/check-ins` keeps its response shape and adds
`alreadyCheckedIn: boolean` and `checkInCount: number`.

Order:

1. Header check.
2. Rate limit RPC. Deny with 429.
3. Load player and vault; 404 / 409 vault_required.
4. Load recent history. If `alreadyCheckedInToday(history)` is true, return
   `200` with the full normal response shape and
   `alreadyCheckedIn: true, awarded: [], unlockedItems: [], badgeActions: [],
   bracketChanged: false, withdrawalDetected: false, leveledUp: false`, using
   `player.current_balance_luna`, `player.bracket`, `player.xp`, `player.level`,
   `player.streak_current`, `player.shields` and `player.check_in_count`. This
   happens before the chain read.
5. Read the chain balance and compute missions, awards, streak, badges and
   unlocks exactly as today.
6. Build the commit payload and call `commit_check_in`.
7. If `claimed` is false, return the same idempotent `alreadyCheckedIn` shape.
8. If `claimed` is true, return the current response plus `checkInCount` from
   the RPC.

The route no longer writes `check_ins`, `players`, `daily_xp`,
`player_missions`, `player_items` or `player_badges` directly. Those writes
exist only inside `commit_check_in`.

### 6.5 Acceptance

- Five POSTs in one UTC day leave `check_in_count` at 1 and do not unlock
  ranked.
- Two concurrent POSTs produce one reading and one reward set.
- A failed player update rolls back the reading and every reward.
- A same-day direct POST returns `alreadyCheckedIn` without a chain read.
- The ranked gate in `/api/queue/join` reads the derived `check_in_count`.
- The 11th request in a minute for one address is `429` and reads no chain.

The real-database checks need `.env.local` and a Supabase project; they are
listed as a deployment step, not a sandbox test.

---

## 7. State machines

| Screen | States |
|---|---|
| `/battle` | `loading` -> `ready` (ranked eligible) / `locked` / `limit` / `error` |
| `/battle/queue` | `joining` -> `searching` -> `matched` (navigate) / `timedOut` (search continues) / `ended` / `error` |
| `/battle/friend/[id]` | `loading` -> `pending` / `active` (navigate) / `abandoned` / `cancelling` / `error` |
| `/battle/[id]` | `loading` -> `pending` (accept) / `active` (`yourMove` / `waiting` / `offline`) -> `completed` (navigate) / `abandoned` / `error` |
| `/battle/[id]/result` | `loading` -> `win` / `loss` / `tie` / `error` |

---

## 8. Responsive and accessibility

- 360px:
  - the header title and `{n} battles left today` chip fit on one row; the
    chip may wrap to a second row rather than truncate;
  - mode titles wrap inside the card, never truncate an action;
  - VS cards are about 140px each and keep the 80px sprite;
  - the arena is 380px high; plates are 46% wide;
  - the move grid stays 2x2; labels may wrap below the glyph;
  - result tiles are 2 columns;
  - the item sheet scrolls inside 80dvh.
- 430px: same structure, wider cards; no fixed large gutters.
- All interactive targets are at least 44x44. Icon buttons are 44x44.
- `Meter` uses `role="progressbar"` with `aria-valuemin/max/now` only when a
  label is supplied; HP meters are `aria-hidden` because adjacent text states
  the value.
- Sprites are decorative (`aria-hidden`); names and HP carry the meaning.
- Colour is never the only signal: status tags, labels and text state the same
  thing.
- Focus: global 2px mint outline; the sheet traps focus and restores it; the
  move grid is in DOM order Attack, Defend, Use item, Special.
- Reduced motion: existing `.sv-sheet`, `.sv-pop`, `.sv-shake` collapse; no new
  motion beyond `sv-pop` on the result.
- No text below 12px. `.sv-state` stays available but the Battle screens use
  `.sv-section-label` for status tags.

---

## 9. Testing and evidence

### Unit tests

- `battle-ui`: battles left, ranked eligibility (including no bracket),
  progress capping, rating range boundaries (59/60/119/120/179/180/181),
  queue time formatting, countdown formatting, next UTC midnight across
  months/years, outcome mapping, XP mapping, result copy.
- `rivals`: deterministic per battle id; all four reachable over a fixed id
  set.
- `constants`: `queueTimeoutSeconds` is 185.

### Route tests

- `/api/battles/[id]` GET: additive fields, `currentMove`, `ownedItems`,
  opponent level/bracket, AI name.
- `/api/battles/[id]/cancel`: 401, 404, 403, 409 (active / already joined),
  200 (creator, pending), status update payload.
- `/api/check-ins`: rate limit 429; duplicate 200; commit payload contains the
  chain balance; no direct table writes; commit `claimed: false` path; RPC
  outage 503.
- SQL contract: migration contains the generated `utc_date`, unique index,
  distinct count, `commit_check_in`, `consume_rate_limit`, service-role grants.

### Source-contract tests

- `/battle` uses `ScreenShell`, `ModeCard`, `Chip`, `Meter`, `rankedEligible`,
  `BATTLE.dailyLimit`, `Go to Missions`.
- Queue page uses `VersusCards`, `RATING range`, `Leave queue`, `Battle the
  AI`, `Challenge a friend`, `queueTimeoutSeconds`.
- Friend page uses `VersusCards`, `Copy challenge link`, `Cancel challenge`,
  `challengeExpiryHours`.
- Battle page uses `Arena`, `BottomSheet`, `Meter`, `Use item`, `Waiting for
  your opponent`, `Connection lost`, `Reconnect`.
- Result page uses `ResultPanel`, `CharacterArt`/`RivalArt`, `Back to Battle`,
  `Go to Home`.
- No `text-[10px]`/`text-[11px]` in new code; no `.vpx` panels; no inline
  primary buttons.

### Commands per task

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected lint stays at 0 errors; warnings may change with new files but must
not add errors.

### Renders

- Before: current `/battle` and `/battle/[id]` at 360/390/430.
- After, per task:
  - menu eligible, locked, daily limit;
  - queue searching, queue timeout;
  - friend wait, expired;
  - battle your-move, waiting, item sheet, connection lost;
  - result win, loss, tie.
- Each state at 360/390/430, fixture data, `docs/superpowers/renders/battle/`.
- Audit per render: `overflowX === 0`, no element wider than the viewport, no
  interactive target below 44x44, min font 12, focus order, mint outline.
- A review page at `docs/superpowers/renders/battle/review/index.html` with the
  before pair and notes.

---

## 10. Deviations and rulings

1. **Mode title is 20px, not 24px.** Foundation 2 has no 24px Jakarta role and
   the batch does not add type sizes.
2. **Ranked Locked is inline.** The handoff caption names `/battle/ranked
   (locked)`, but the figure is the menu with a locked card. The menu is the
   screen.
3. **Friend wait is `/battle/friend/[id]`.** The handoff path is
   `/battle/friend`; the id makes refresh and direct entry safe. A pending
   creator on `/battle/[id]` is redirected.
4. **Result rating is current, not a delta.** The pre-battle rating is not
   persisted. Unranked results show the record instead.
5. **Daily Limit has a Missions link.** The figure's caption asks for one; the
   visual does not draw it.
6. **AI uses rival art.** The handoff's robot glyph is not in
   `assets/glyphs.json`. The deterministic rival is real art already in the
   project.
7. **Connection lost is an overlay.** It is not a route; the battle state stays
   server-side and the poll drives recovery.
8. **Cancel route is additive.** The handoff has "Cancel challenge" and there
   is no existing endpoint. The route only abandons an unanswered challenge.
9. **Polling, not realtime.** The existing 3s battle poll and 10s queue poll
   stay.
10. **Check-in gate migration is manual.** The sandbox has no `.env.local`, so
    applying the migration and running the live acceptance checks is the
    user's deployment step before ranked is public.

---

## 11. Approved decisions (2026-11-09)

All recommended options were selected in review:

1. **Battle API surface:** add the four Battle GET fields and the
   `POST /api/battles/[id]/cancel` route. Existing fields and routes do not
   change.
2. **Shared primitives:** add `Meter`, `Button` sizes `mode`/`item`,
   `BottomSheet` `headerAction`, `ScreenShell` `backLabel` and `RivalArt`.
3. **Result rating:** show the current rating from `/api/profile`; do not add
   a rating delta. Unranked and AI results show the W-L-T record.
4. **Check-in gate:** land the full release gate -- unique UTC day,
   distinct-day count, atomic `commit_check_in`, and the DB rate-limit table
   and RPC.
5. **Friend route:** use `/battle/friend/[id]`, with pending creators
   redirected from `/battle/[id]`.
6. **Mode titles:** use `.sv-subheading` (20px); no new type role.
7. **Daily Limit:** add the secondary `Go to Missions` link.

The remaining deployment step is applying the check-in migration to the live
Supabase project and running the five-POST/concurrency/rate-limit checks. The
sandbox has no `.env.local`, so that step is the user's.


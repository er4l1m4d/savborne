# Missions API gaps - design

**Date:** 2026-11-11
**Status:** awaiting approval
**Branch:** `missions-api-gaps` (from `main` at `2e67f75`)
**Reference:** `docs/superpowers/audits/2026-11-05-ui-gap-audit.md` sections 7,
18 and 19 (Remaining items 1 and 2), `Savborne-handoff.html` figure
`A_Missions`.
**Depends on:** the merged Foundation 2 primitives, the Missions UI port, the
Ranks and app-routes batches and the `Meter` primitive.

---

## 1. Goal

Close the two Missions API gaps recorded in the UI gap audit:

1. Weekly XP is reported as a check-in count, not the sum of the week's weekly
   mission rewards. `/api/missions` uses `weeklyRows.length`; `/api/players/me`
   repeats it; `settleMissions` and the check-in route multiply a count by 33.
2. Weekly Strategist has no progress payload, so the handoff's `1 of 2 wins`
   meter cannot render.

The batch makes the weekly XP figure exact in all four places, adds an additive
`progress` object to the Weekly Strategist mission, fixes the settlement win
count so AI wins never feed a human mission, and renders the handoff's meter
with the existing `Meter` primitive.

This is a corrective API batch with one small UI addition. There is no schema
change, no new ledger and no response field rename.

---

## 2. Scope

### In

- One shared server module for exact weekly mission XP and this week's human
  battle wins, with a pure core for unit tests.
- The helper used by `GET /api/missions`, `GET /api/players/me`,
  `settleMissions` and the check-in route.
- An additive `progress: { current, target }` on the `weekly_strategist`
  mission item only.
- A `WEEKLY_STRATEGIST_WINS` constant so the evaluator and the payload share
  the target.
- Excluding AI battles from the settlement win count and using the shared
  human-win count as-is.
- The Weekly Strategist meter row using `Meter` at 14px and the existing
  grouped panel / row rhythm.
- Unit, route and source-contract tests, renders, audit and review notes.
- Spec, plan and the new audit section.

### Out

- SQL, schema, migrations, RLS and `supabase/FINAL-SCHEMA.sql`.
- A `weekly_xp` ledger or any new table.
- Renaming or removing any existing API field, status code or response shape.
- Progress payloads for other missions. There is no clear case in this batch.
- Changes to XP values, caps, reset arithmetic or mission award timing.
- A new meter component, ad-hoc panels, chips or buttons.
- Live Supabase / Nimiq checks: `.env.local` is absent. Tests, build and
  fixture renders do not need it.

---

## 3. Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Helper scope | Replace all four approximations: `/api/missions`, `/api/players/me`, `settleMissions`, check-in `weeklyXpThisWeek`. |
| 2 | Helper shape | `weeklyMissionXp(db, address, now)` reads the two tables; `sumWeeklyMissionXp(credits, defs, now)` is the pure, unit-tested core. |
| 3 | Weekly XP source | `player_missions` rows completed at or after the UTC week start, deduped by mission key, joined to `missions.xp_reward` where `missions.type = 'weekly'`, summed, then clamped to `WEEKLY_MISSION_XP_CAP`. |
| 4 | Progress shape | Additive `progress?: { current: number; target: number }`; present only on `weekly_strategist`. |
| 5 | Progress current | Human battle wins this UTC week: `winner = player`, `mode in ('ranked','unranked')`, `completed_at >= weekStart`, `completed_at < now`, clamped to the target. AI is excluded. |
| 6 | Progress target | `WEEKLY_STRATEGIST_WINS = 2` in `src/lib/constants.ts`; the evaluator and the API use it. |
| 7 | AI wins | `weeklyHumanWins` excludes `mode = 'ai'`. `battleServer` uses that helper instead of a local count query, so the award and the meter count the same battles. |
| 8 | Settlement off-by-one | The current query already excludes the just-completed battle with `completed_at < now`, so the shared count is the number of wins **before** this one. The existing `- 1` is removed; the evaluator still adds this battle's win. |
| 9 | Meter | Existing `Meter`, 14px high, 90px wide, mint, non-interactive, labelled as a progressbar. No new primitive. |
| 10 | Row layout | On `weekly_strategist`, the meter + `{current} of {target} wins` line replaces the description. Title + line + 8px row padding stays at the 58px minimum. |
| 11 | Completed row | At 2 wins the completed row keeps the meter and `2 of 2 wins`; the label and XP are muted, the meter is full mint. |
| 12 | Renders | Weekly Strategist at 0, 1 and 2 wins at 360/390/430. Other Missions states are re-captured only if this row change affects them. |

### 3.1 Why all four call sites

There is one weekly XP number. Leaving the settle or check-in path on a count
would let the cap headroom and the header disagree with the endpoints. The four
call sites now share one module, and a source-contract test pins that they do.

### 3.2 Why the settlement count changes

`battleServer` currently counts `mode in ('ranked','unranked','ai')` and then
subtracts one. The query is already bounded by `completed_at < now`, so the
current battle is excluded and the subtraction undercounts by one. With the
old code a player's **third** human win is the first one that can satisfy
`weeklyWinsBefore + 1 >= 2`, while the new meter would show `2 of 2` after the
second. Using the shared human-win count as-is fixes both the AI overcount and
the off-by-one, so the award fires on the second human win and agrees with the
meter.

---

## 4. Server design

### 4.1 `src/lib/game/weekly-missions.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { WEEKLY_MISSION_XP_CAP } from '../constants'
import { utcWeekStart } from './time'

export type WeeklyCredit = {
  mission_key: string
  completed_at: string
}

export type MissionXpDef = {
  key: string
  type: string
  xp_reward: number
}

/** Pure core: dedupe, weekly filter, exact rewards, cap clamp. */
export function sumWeeklyMissionXp(
  credits: WeeklyCredit[],
  defs: MissionXpDef[],
  now: Date,
): number

/** Exact weekly mission XP earned since Monday 00:00 UTC. */
export async function weeklyMissionXp(
  db: SupabaseClient,
  address: string,
  now: Date,
): Promise<number>

/** Human battle wins this UTC week, excluding AI. */
export async function weeklyHumanWins(
  db: SupabaseClient,
  address: string,
  now: Date,
): Promise<number>
```

`weeklyMissionXp` queries:

```ts
db.from('player_missions')
  .select('mission_key, completed_at')
  .eq('player_address', address)
  .gte('completed_at', weekStart.toISOString())
```

then, only when there is at least one row:

```ts
db.from('missions')
  .select('key, type, xp_reward')
  .in('key', [...new Set(rows.map((r) => r.mission_key))])
```

`sumWeeklyMissionXp` re-filters credits by `completed_at >= weekStart` (so the
window is testable against a fake), keeps one entry per mission key, ignores
keys whose definition is not `type = 'weekly'`, sums `xp_reward`, and returns
`min(WEEKLY_MISSION_XP_CAP, max(0, total))`.

`weeklyHumanWins` queries:

```ts
db.from('battles')
  .select('id')
  .eq('winner', address)
  .in('mode', ['ranked', 'unranked'])
  .gte('completed_at', weekStart.toISOString())
  .lt('completed_at', now.toISOString())
```

and returns `data.length`. Selecting ids avoids a count-header dependency and
is bounded by the number of human wins in a week.

Read failures keep the current routes' degrade-to-empty behaviour: a missing
credit row set contributes 0. The cap remains enforced by `computeAward` from
an undercounted state, exactly as today.

### 4.2 `GET /api/missions`

Response additions, everything else unchanged:

```json
{
  "missions": [
    {
      "key": "weekly_strategist",
      "name": "Weekly Strategist",
      "description": "Win two battles this week",
      "type": "weekly",
      "xpReward": 40,
      "bracketRequired": null,
      "completed": false,
      "completedAt": null,
      "nextResetAt": "2026-11-16T00:00:00.000Z",
      "progress": { "current": 1, "target": 2 }
    }
  ],
  "counters": {
    "dailyXpEarned": 10,
    "dailyXpCap": 25,
    "weeklyXpEarned": 60,
    "weeklyXpCap": 100
  }
}
```

- `progress` appears only when `key === 'weekly_strategist'`; every other item
  is exactly as it is today.
- `counters.weeklyXpEarned` is now the exact sum from `weeklyMissionXp`.
- `counters.dailyXpEarned`, both caps and every item field keep their names and
  types.
- 401 for a missing player header stays first and queries nothing.

### 4.3 `GET /api/players/me`

No shape change. `player.weeklyXpEarnedThisWeek` now returns the exact weekly
mission XP from the helper instead of the check-in count. The route no longer
queries `check_ins` for it.

### 4.4 `POST /api/check-ins`

No response change. The local `weeklyXpThisWeek()` approximation and its `* 33`
comment are removed; the handler initialises `weeklyXpEarnedThisWeek` from the
helper so daily/weekly cap headroom matches the endpoints. `commit_check_in`,
awards, caps and status codes are untouched.

### 4.5 `settleMissions`

No response change. The local `player_missions` count and `* 33` state
initialisation are replaced with `await weeklyMissionXp(db, address, now)`.
The dedupe/window logic for crediting and the transactional writes are
untouched.

### 4.6 `battleServer`

- Import `weeklyHumanWins`.
- Replace the local `battles` count query with
  `const weeklyWinsBefore = await weeklyHumanWins(db, address, now)`.
- Pass that number directly; remove `Math.max(0, (weeklyWinsBefore ?? 1) - 1)`.
- `evaluateForBattle` still receives `isHumanOpponent: battle.mode !== 'ai'`
  and still requires a human win.
- `WEEKLY_STRATEGIST_WINS` replaces the literal `2` in the evaluator.

The stale `weeklyWinsBefore` comment in `missions.ts` changes from "battles
started" to "human wins in this UTC week before this battle".

---

## 5. UI design

### 5.1 Row

`Mission` gains `progress?: { current: number; target: number }`.

`MissionRow` body:

```tsx
<div className="flex flex-col gap-0.5 py-2">
  <span className="text-[15px] leading-[1.35] font-semibold sv-break ...">
    {m.name}
  </span>
  {m.progress ? (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Meter
        value={m.progress.current}
        max={m.progress.target}
        height={14}
        label={`${m.name} wins`}
        className="w-[90px] shrink-0"
      />
      <span className="sv-caption font-medium leading-[1.35] text-fg-muted tabular-nums">
        {m.progress.current} of {m.progress.target} wins
      </span>
    </div>
  ) : !m.completed ? (
    <span className="sv-caption font-medium leading-[1.35] text-fg-muted">
      {m.description}
    </span>
  ) : null}
</div>
```

- The progress line replaces the description on the Weekly Strategist row, as
  the handoff draws it. Other open rows keep their description; other done rows
  keep title + muted XP.
- 15px title + 2px gap + 14px meter = about 36px of content; with `py-2` the
  row stays at its 58px minimum. No shared CSS change is needed.
- At 360 the 90px meter plus `N of 2 wins` fits the content column (about
  184px). `flex-wrap` lets the caption drop below the meter rather than
  overflow if copy ever grows; the row then grows like a two-line description
  row.
- The 14px height and 90px width are the handoff proportions. The primitive
  already supplies the trough, mint fill and reduced-motion-safe transition.
- Completed at 2 wins: title and label muted, `2 of 2 wins`, full mint meter,
  muted `+40 XP`. The visually hidden `(completed)` stays.

### 5.2 Accessibility

- `Meter` gets a `label`, so it is a `progressbar` with `aria-valuemin`,
  `aria-valuemax` and `aria-valuenow`; the adjacent text repeats the value.
- The meter is not interactive, so it adds no focus stop and no 44px target.
- The row still announces completion through `(completed)`.
- Type stays at or above the 12px floor; the caption is `.sv-caption` (12px).
- Existing tabs, nav, error retry and focus outline are unchanged.

---

## 6. Tests

| Area | Cases |
|---|---|
| `sumWeeklyMissionXp` | Exact 25 + 35 + 40 = 100; duplicate key counts once; daily/one-time keys ignored; a credit before Monday 00:00 UTC ignored; unknown key ignored; a sum above the cap clamps to 100; empty input is 0. |
| `weeklyMissionXp` / `weeklyHumanWins` queries | Week boundary is sent as `completed_at >= weekStart`; battles exclude `ai`; winner and mode filters are present; the `completed_at < now` bound is present. |
| `GET /api/missions` | 401 with no queries; exact `weeklyXpEarned` rather than a row count; existing counter names and mission fields pinned; `progress` present only on `weekly_strategist`; current 0, 1, 2 and a clamped 3; AI mode is not in the battles filter. |
| `GET /api/players/me` | `weeklyXpEarnedThisWeek` is the exact reward sum, not a check-in count; week window excludes stale credits; existing fields and status codes pinned; `check_ins` is no longer queried for it. |
| `evaluateForBattle` | A human win with one prior human win credits Weekly Strategist; zero prior wins does not; an AI win with many prior wins never credits it. |
| Source contracts | The four call sites call `weeklyMissionXp`; no `* 33` remains in check-in or settle; `battleServer` calls `weeklyHumanWins` and has no local `'ai'` mode count. |
| Missions page | Uses `Meter`, 14px, 90px, `{current} of {target} wins`; progress replaces the description; no new panel/button/meter primitive. |

The full suite must stay green at every commit. Existing API fields and status
codes stay pinned by the current tests.

---

## 7. Renders and audit

Directory: `docs/superpowers/renders/missions-api/`.

| Folder | Contents |
|---|---|
| `before/` | The signed-off pre-batch Repeating screen at 360/390/430, copied from `missions/after/missions-repeating@*.png`. |
| `after/` | `missions-strategist-{0,1,2}@{360,390,430}.png` — 9 PNGs. |
| `audit/` | `final-audit.jsonl` — 9 rows (3 states x 3 widths). |
| `review/` | `index.html` and `NOTES.md`, following the Battle/Missions review shell. |

Every audit row must show:

- `overflowX: 0` and no element wider than the viewport.
- No interactive target below 44×44.
- Minimum rendered font 12px outside `.sv-state`.
- Every focus stop in view, uncovered, with the 2px mint outline.
- The meter is a `progressbar`, not a focus stop.

States: 0 wins (open, empty meter), 1 win (half meter), 2 wins (complete, full
meter, muted label). The other Missions states are not re-captured unless the
renders show the row change affecting them; the 2-win row is the completed
appearance that the all-done state would show.

---

## 8. Risks

1. **Extra reads.** The endpoints now read `player_missions`, `missions` and
   `battles` instead of a check-in count. The weekly row counts are small and
   the reads are indexed by player. No cache or ledger is added.
2. **Read failure.** A failed credit/definition read degrades to a lower weekly
   figure, as the old count-based read did. The award cap still applies.
3. **Completed-row height.** The meter line is designed to fit the 58px row.
   The audit verifies the real rendered height at 360/390/430; if it grows it
   grows like a description row and never truncates.
4. **Settlement behaviour.** Removing the `- 1` makes Weekly Strategist credit
   on the second human win, matching the mission text and the meter. Tests pin
   the evaluator at one prior win and the AI exclusion.
5. **No live check.** The sandbox has no `.env.local`; the real Supabase and
   Nimiq pass remains the user's sign-off step.

---

## 9. Approval needed

1. The helper and its four call sites (decision 1).
2. The additive `progress` shape and target `2` (decisions 4-6).
3. The AI exclusion and the settlement off-by-one fix (decisions 7-8).
4. The meter row replacing the description, staying in the 58px rhythm
   (decisions 9-11).
5. The three-state render scope (decision 12).

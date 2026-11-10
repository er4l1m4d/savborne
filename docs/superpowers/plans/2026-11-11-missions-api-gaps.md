# Missions API gaps - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans.
> Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make weekly mission XP exact in all four server call sites, add the
Weekly Strategist `progress` payload, exclude AI wins from human mission
progress, and render the handoff's `1 of 2 wins` meter.

**Architecture:** One new server module holds a pure weekly-XP sum and two reads:
exact weekly mission XP and this week's human battle wins. `/api/missions`,
`/api/players/me`, `settleMissions` and the check-in route call the XP helper;
`/api/missions` and `battleServer` call the human-win helper. The Missions page
renders the existing `Meter` from the additive `progress` object.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind plus
`.sv-*` / `.pxw` / `.px`, node:test, the existing CDP render harness in
`/data/tmp/opencode/`.

**Spec:** `docs/superpowers/specs/2026-11-11-missions-api-gaps-design.md`.

## Global Constraints

- Branch `missions-api-gaps` from `main` at `2e67f75`.
- No SQL, schema, migration, RLS or `FINAL-SCHEMA.sql` changes.
- No API field renames or response-shape breaks. Additive only.
- Weekly XP is the exact sum of the week's weekly mission rewards, never a
  count or an average.
- AI wins never count toward a human mission or its meter.
- Foundation 2 primitives only; no ad-hoc meter, panel or button.
- 12px type floor, 44px targets, 360px no truncation.
- One commit per task; `npm test`, `npx tsc --noEmit`, `npm run lint` and
  `npm run build` green before each commit.
- Never stage `.env.local`, `AGENTS.md` or InstaBox tooling.
- Do not merge or push before sign-off.
- The capture harness lives in `/data/tmp/opencode/` and is not committed.

## Baseline

`main` at `2e67f75`: 411 tests pass, tsc clean, lint 49 warnings / 0 errors,
build exit 0.

---

### Task 0: Spec, plan and branch

**Files:**
- Create: `docs/superpowers/specs/2026-11-11-missions-api-gaps-design.md`
- Create: `docs/superpowers/plans/2026-11-11-missions-api-gaps.md`

- [ ] **Step 1: Confirm the branch**

```bash
git branch --show-current          # missions-api-gaps
git log --oneline -1               # 2e67f75
```

- [ ] **Step 2: Commit after approval**

```bash
git add docs/superpowers/specs/2026-11-11-missions-api-gaps-design.md \
        docs/superpowers/plans/2026-11-11-missions-api-gaps.md
git commit -m "docs: missions API gaps spec and plan"
```

---

### Task A: Exact weekly mission XP helper

**Files:**
- Create: `src/lib/game/weekly-missions.ts`
- Modify: `src/app/api/missions/route.ts`
- Modify: `src/app/api/players/me/route.ts`
- Modify: `src/app/api/check-ins/route.ts`
- Modify: `src/lib/game/settle.ts`
- Modify: `src/app/api/players/me/route.test.ts` (fixture only, so the suite
  stays green)

**Interfaces:**

```ts
export type WeeklyCredit = { mission_key: string; completed_at: string }
export type MissionXpDef = { key: string; type: string; xp_reward: number }

export function sumWeeklyMissionXp(
  credits: WeeklyCredit[],
  defs: MissionXpDef[],
  now: Date,
): number

export async function weeklyMissionXp(
  db: SupabaseClient,
  address: string,
  now: Date,
): Promise<number>

export async function weeklyHumanWins(
  db: SupabaseClient,
  address: string,
  now: Date,
): Promise<number>
```

- [ ] **Step 1: Create the helper**

`sumWeeklyMissionXp`:

1. `const weekStart = utcWeekStart(now).getTime()`.
2. Keep credits with `new Date(completed_at).getTime() >= weekStart`.
3. `new Set` their `mission_key` for dedupe.
4. Build `Map(defs.filter(type === 'weekly').map(d => [d.key, d.xp_reward]))`.
5. Sum the deduped keys that have a weekly definition.
6. Return `Math.min(WEEKLY_MISSION_XP_CAP, Math.max(0, total))`.

`weeklyMissionXp`:

1. Query `player_missions` with
   `.select('mission_key, completed_at')`, `.eq('player_address', address)`,
   `.gte('completed_at', weekStart.toISOString())`.
2. Return 0 when there are no rows.
3. Query `missions` with `.select('key, type, xp_reward')`,
   `.in('key', dedupedKeys)`.
4. Return `sumWeeklyMissionXp(credits, defs ?? [], now)`.

`weeklyHumanWins`:

1. Query `battles` with `.select('id')`, `.eq('winner', address)`,
   `.in('mode', ['ranked', 'unranked'])`,
   `.gte('completed_at', weekStart.toISOString())`,
   `.lt('completed_at', now.toISOString())`.
2. Return `(data ?? []).length`.

- [ ] **Step 2: Wire `/api/missions`**

- Move `const now = new Date()` and `weekStart` above the `Promise.all`.
- Drop the `check_ins` query.
- Add `weeklyMissionXp(db, address, now)` and
  `weeklyHumanWins(db, address, now)` to the `Promise.all`.
- Set `counters.weeklyXpEarned` to the helper value. Do not add `progress`
  yet; that is Task B.
- Keep every field name, the 401 and the mission mapping unchanged.

- [ ] **Step 3: Wire `/api/players/me`**

- Remove the `check_ins` weekly query and the `weeklyRows` destructure.
- Add `weeklyMissionXp(db, address, now)` to the `Promise.all`; define `now`
  first.
- Set `weeklyXpEarnedThisWeek` to that value.
- Remove the now-unused `utcWeekStart` import. Keep all other fields.

- [ ] **Step 4: Wire the check-in route**

- Import `weeklyMissionXp`.
- Replace `weeklyXpEarnedThisWeek: await weeklyXpThisWeek()` with
  `weeklyXpEarnedThisWeek: await weeklyMissionXp(db, address, now)`.
- Delete the local `weeklyXpThisWeek()` function and its `* 33` comment.
- Keep `WEEKLY_KEYS` for `computeResetAt` and source classification.

- [ ] **Step 5: Wire `settleMissions`**

- Import `weeklyMissionXp`.
- Delete the `player_missions` weekly count query.
- Set `weeklyXpEarnedThisWeek: await weeklyMissionXp(db, address, now)`.
- Keep `creditedThisWeek`, `toCredit`, the award loop and writes unchanged.

- [ ] **Step 6: Keep the existing players/me tests green**

Add `player_missions` and `missions` to `emptyQueries()` in
`src/app/api/players/me/route.test.ts` so the existing GET tests answer the
helper reads with empty rows. No new assertions in this task.

- [ ] **Step 7: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/lib/game/weekly-missions.ts src/app/api/missions/route.ts \
        src/app/api/players/me/route.ts src/app/api/check-ins/route.ts \
        src/lib/game/settle.ts src/app/api/players/me/route.test.ts
git commit -m "feat: compute exact weekly mission XP"
```

---

### Task B: Weekly Strategist progress and human-win count

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/game/missions.ts`
- Modify: `src/lib/game/battleServer.ts`
- Modify: `src/app/api/missions/route.ts`

- [ ] **Step 1: Add the shared target**

In `src/lib/constants.ts`, beside the mission XP values:

```ts
/** Weekly Strategist: human battle wins required in one UTC week. */
export const WEEKLY_STRATEGIST_WINS = 2
```

- [ ] **Step 2: Use it in the evaluator**

In `src/lib/game/missions.ts`:

- Import `WEEKLY_STRATEGIST_WINS`.
- Replace the literal `2` in the Weekly Strategist condition with it.
- Update the `weeklyWinsBefore` comment to "Human wins in this UTC week before
  this battle."

- [ ] **Step 3: Add `progress` to `/api/missions`**

For each mission item, keep the existing object and append:

```ts
...(m.key === 'weekly_strategist'
  ? {
      progress: {
        current: Math.min(weeklyWins, WEEKLY_STRATEGIST_WINS),
        target: WEEKLY_STRATEGIST_WINS,
      },
    }
  : {}),
```

Import `WEEKLY_STRATEGIST_WINS` and use the `weeklyHumanWins` result already
loaded in Task A. Update the route header comment with the `progress` field.
No other mission gets `progress`.

- [ ] **Step 4: Use the shared human-win count in settlement**

In `src/lib/game/battleServer.ts`:

- Import `weeklyHumanWins`.
- Replace the local `battles` count query with
  `const weeklyWinsBefore = await weeklyHumanWins(db, address, now)`.
- Pass `weeklyWinsBefore` directly; remove `Math.max(0, (weeklyWinsBefore ?? 1) - 1)`.
- Remove the now-unused `utcWeekStart` import.

- [ ] **Step 5: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/lib/constants.ts src/lib/game/missions.ts \
        src/lib/game/battleServer.ts src/app/api/missions/route.ts
git commit -m "feat: add weekly strategist progress"
```

---

### Task C: Weekly Strategist meter row

**Files:**
- Modify: `src/app/(tabs)/missions/page.tsx`
- Modify: `src/lib/missions-ui.test.ts`

- [ ] **Step 1: Extend the mission type**

Add `progress?: { current: number; target: number }` to the local `Mission`
type. Import `Meter`.

- [ ] **Step 2: Render the progress line**

In `MissionRow`, replace the single conditional description with:

```tsx
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
```

- [ ] **Step 3: Adjust the page source contract**

The current test asserts `{!m.completed &&`; the description branch is now a
ternary. Update `src/lib/missions-ui.test.ts` to assert:

- `<Meter` is imported and used.
- `height={14}` and `w-[90px]` are present.
- `{m.progress.current} of {m.progress.target} wins` is present.
- The description fallback is `) : !m.completed ? (`.
- No new panel, button or meter component is introduced.

- [ ] **Step 4: Spot-check the render**

Start the dev server on 3001 and capture the Repeating state at 390 after the
fixture gains a `progress` object. Confirm the row stays at 58px, the meter is
14px, and `1 of 2 wins` is not truncated. Use the Task E harness; no image is
committed in this task.

- [ ] **Step 5: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add "src/app/(tabs)/missions/page.tsx" src/lib/missions-ui.test.ts
git commit -m "feat: render the weekly strategist meter"
```

---

### Task D: Tests

**Files:**
- Create: `src/lib/game/weekly-missions.test.ts`
- Create: `src/app/api/missions/route.test.ts`
- Modify: `src/app/api/players/me/route.test.ts`
- Create: `src/lib/game/missions.test.ts`

- [ ] **Step 1: Helper unit tests**

In `src/lib/game/weekly-missions.test.ts`, use a fixed `now` of
`2026-11-11T12:00:00.000Z` (Wednesday; the week starts
`2026-11-09T00:00:00.000Z`). Cover:

- Exact rewards: 25 + 35 + 40 = 100.
- Dedupe: two `weekly_check_in` credits count once.
- Non-weekly keys: `daily_check_in`, `first_steps` and `first_deposit` ignored.
- Week window: a credit one minute before the week start ignored; one at the
  week start counted.
- Unknown key ignored.
- Cap clamp: two 60 XP weekly definitions sum to 100.
- Empty input is 0.

Then with `installFakeNet` and `supabaseAdmin()`:

- `weeklyMissionXp` sends `completed_at >= weekStart` and queries only the
  deduped keys.
- `weeklyHumanWins` returns the row count and sends
  `mode=in.(ranked,unranked)` (no `ai`), `winner=eq.<address>`,
  `completed_at >= weekStart` and `completed_at < now`.

- [ ] **Step 2: `/api/missions` route tests**

Create `src/app/api/missions/route.test.ts` using `installFakeNet`, `rows` and
`GET` from `@/app/api/missions/route`.

Fixtures:

- 11 mission definitions with the real keys, types and rewards.
- This week's credits: `weekly_check_in`, `steady_saver`, a duplicate
  `weekly_check_in`, `daily_check_in` and `first_steps`.
- `daily_xp` row `{ xp_earned: 10 }`.
- Battle rows supplied per test.

Tests:

1. No header is 401 and makes no query.
2. `counters` keep exactly `dailyXpEarned`, `dailyXpCap`, `weeklyXpEarned`,
   `weeklyXpCap`; `weeklyXpEarned` is 60, not the credit-row count.
3. The 11 mission items keep every existing field; `progress` is present only
   on `weekly_strategist` and is absent from every other item.
4. Progress is `{ current: 0, target: 2 }` with no wins, `{ current: 1,
   target: 2 }` with one, `{ current: 2, target: 2 }` with two, and `{ current:
   2, target: 2 }` with three (clamped).
5. The battles query uses `mode=in.(ranked,unranked)` and never mentions `ai`.
6. A weekly credit before the week start does not add XP.

- [ ] **Step 3: Extend `/api/players/me` GET tests**

Add to `src/app/api/players/me/route.test.ts`:

- `weeklyXpEarnedThisWeek` is 60 for `weekly_check_in` + `steady_saver`, with a
  duplicate and non-weekly credits present.
- A credit before the week start is ignored.
- `net.to('check_ins').length === 0` for the GET, pinning that weekly XP no
  longer reads check-ins.
- Existing status codes and fields stay asserted by the current tests.

Use `utcWeekStart(new Date())` and offsets from it in the fixture so the test
does not depend on the calendar day it runs.

- [ ] **Step 4: Evaluator and source-contract tests**

Create `src/lib/game/missions.test.ts`:

- Human win with `weeklyWinsBefore: 1` includes `weekly_strategist`.
- Human win with `weeklyWinsBefore: 0` does not.
- `isHumanOpponent: false` with `outcome: 'win'` and a large
  `weeklyWinsBefore` never includes `weekly_strategist`.

Add to `weekly-missions.test.ts` source contracts:

- `src/app/api/missions/route.ts`, `src/app/api/players/me/route.ts`,
  `src/app/api/check-ins/route.ts` and `src/lib/game/settle.ts` all call
  `weeklyMissionXp(`.
- Neither the check-in route nor `settle.ts` contains `* 33`.
- `src/lib/game/battleServer.ts` calls `weeklyHumanWins(` and has no local
  `['ranked', 'unranked', 'ai']` count query.

- [ ] **Step 5: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/lib/game/weekly-missions.test.ts \
        src/app/api/missions/route.test.ts \
        src/app/api/players/me/route.test.ts \
        src/lib/game/missions.test.ts
git commit -m "test: cover weekly XP and strategist progress"
```

Record the exact test count for the audit.

---

### Task E: Renders, audit and review

**Files:**
- Create: `docs/superpowers/renders/missions-api/before/missions-repeating@{360,390,430}.png`
- Create: `docs/superpowers/renders/missions-api/after/missions-strategist-{0,1,2}@{360,390,430}.png`
- Create: `docs/superpowers/renders/missions-api/audit/final-audit.jsonl`
- Create: `docs/superpowers/renders/missions-api/review/index.html`
- Create: `docs/superpowers/renders/missions-api/review/NOTES.md`

- [ ] **Step 1: Before images**

Copy the signed-off pre-batch Repeating renders:

```bash
mkdir -p docs/superpowers/renders/missions-api/before
cp docs/superpowers/renders/missions/after/missions-repeating@{360,390,430}.png \
   docs/superpowers/renders/missions-api/before/
```

- [ ] **Step 2: Extend the harness**

Copy `/data/tmp/opencode/capture-missions.mjs` to
`/data/tmp/opencode/capture-missions-api.mjs` (not committed). Add a `WINS`
env var (0, 1, 2):

- The `weekly_strategist` item gets
  `progress: { current: WINS, target: 2 }` and `completed: WINS >= 2`.
- The other items keep their current fixture states.
- `counters.weeklyXpEarned` becomes 25 + 35 + (WINS >= 2 ? 40 : 0).
- Slugs: `missions-strategist-${WINS}`.
- Add `OUT_DIR` and `AUDIT` support as the existing harness has.

- [ ] **Step 3: Capture 9 after PNGs**

```bash
npm run dev -- -p 3001 -H 0.0.0.0
for wins in 0 1 2; do
  WINS=$wins OUT_DIR=docs/superpowers/renders/missions-api/after \
    node /data/tmp/opencode/capture-missions-api.mjs
done
```

Confirm 9 PNGs. Open each: 0 wins shows an empty trough with `0 of 2 wins`,
1 win half fill with `1 of 2 wins`, 2 wins full mint with `2 of 2 wins` and a
muted label/XP. The row must stay 58px and the text must not truncate.

- [ ] **Step 4: Audit**

```bash
for wins in 0 1 2; do
  WINS=$wins AUDIT=1 node /data/tmp/opencode/capture-missions-api.mjs
done > docs/superpowers/renders/missions-api/audit/final-audit.jsonl
```

Expected 9 rows: `overflowX: 0`, empty `wide`, empty `small`, `minFont: 12`,
every focus stop `inView` and not `covered` with the mint outline, and the
meter present as `role="progressbar"` but not in the tab order.

- [ ] **Step 5: Build the review page**

Copy the Battle/Missions review shell and CSS. Sections:

1. Weekly Strategist - 0 wins (before/after)
2. Weekly Strategist - 1 win
3. Weekly Strategist - 2 wins
4. Deliberate choices

Each section has a 360/390/430 strip and a one-line note. The `before` pair is
in a `<details>` so the history stays clear.

`NOTES.md`:

- Sign-off checkboxes for the three states.
- A corrections block per state.
- Deliberate choices: progress replaces the description; the meter is the
  existing primitive at 14px; completed rows keep the meter; AI wins never
  count; the weekly XP counter is now exact; the all-done state's strategist
  row is the 2-win render.

- [ ] **Step 6: Stop the server and commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add docs/superpowers/renders/missions-api
git commit -m "chore: missions API gap renders, audit and review"
```

---

### Task F: Docs and status

**Files:**
- Modify: `docs/superpowers/audits/2026-11-05-ui-gap-audit.md`
- Modify the spec or plan only if implementation differs.

- [ ] **Step 1: Append the audit section**

Add `## 23. Missions API gaps - 2026-11-11` with:

- Branch and base commit.
- What landed: helper, four call sites, `progress`, AI exclusion, the
  off-by-one fix, the meter row.
- Verification table with the exact `npm test` count, tsc, lint warnings and
  build result.
- 360 behaviour: the meter and caption fit; row height; no truncation.
- Audit numbers: 9 rows, `overflowX`, wide elements, small targets, min font,
  focus.
- Rulings: progress replaces the description; all four call sites share the
  helper; AI wins excluded; settlement uses the count as-is.
- Renders paths.
- Remaining: real-device pass, no live Supabase checks, no merge before
  sign-off.

- [ ] **Step 2: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add docs/superpowers/audits/2026-11-05-ui-gap-audit.md
git commit -m "docs: record the missions API gap batch"
```

- [ ] **Step 3: Report, do not merge**

Summarise the diff, the exact test/lint/render numbers and the audit result.
Wait for sign-off; do not merge or push.

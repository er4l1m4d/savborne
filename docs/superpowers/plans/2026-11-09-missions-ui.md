# Missions UI redesign - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans.
> Steps use checkbox (`- [ ]`) syntax.

**Goal:** Port `/missions` to the handoff's Progress screen: Repeating /
One-time tabs, Daily and Weekly groups with reset + XP counters, and one
grouped panel of 58px rows per group.

**Architecture:** The page keeps its single `GET /api/missions` fetch and 401
redirect. A small pure module derives group XP from the returned rows and the
API caps. `Tabs` switches two group lists. Every group is one `PixelPanel` of
`Row`s; `LoadingState`, `Banner` and `Button` cover the states.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind plus
`.sv-*` / `.pxw` / `.px`, node:test, the existing CDP render harness.

**Spec:** `docs/superpowers/specs/2026-11-09-missions-ui-design.md`.

## Global Constraints

- Branch `missions-ui-redesign` from current `main`; no stacking.
- Foundation 2 primitives only. No `vpx`, no ad-hoc buttons or panels.
- 12px type floor; 44px targets; 360px no truncation.
- Mint for XP/progress/completed; muted for done; group titles in default text.
- No API, SQL, mission-rule or XP-value changes.
- One commit per task; full suite green before each commit.
- Never stage `.env.local`, `AGENTS.md` or InstaBox tooling.
- The capture harness lives in `/data/tmp/opencode/` and is not committed.

---

### Task 0: Baseline and before renders

**Files:**
- Create: `docs/superpowers/renders/missions/before/missions@{360,390,430}.png`
- Create (not committed): `/data/tmp/opencode/capture-missions.mjs`

- [ ] **Step 1: Confirm the branch and baseline**

```bash
git switch main
git pull --ff-only
git switch -c missions-ui-redesign   # already created
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: 370 pass, tsc clean, lint 50 warnings / 0 errors, build exit 0.
Record the exact numbers in the audit section.

- [ ] **Step 2: Create the capture harness**

Copy `/data/tmp/opencode/capture-home.mjs` to
`/data/tmp/opencode/capture-missions.mjs`. Keep the CDP connection, the
readiness loop and the audit block. Replace the fixture with:

```js
const MISSIONS = [
  ['daily_check_in', 'Daily Check-in', 'Check in today', 'daily', 10, true],
  ['quick_duel', 'Quick Duel', 'Start one battle today', 'daily', 15, false],
  ['weekly_check_in', 'Weekly Check-in', 'Record a check-in this week', 'weekly', 25, true],
  ['steady_saver', 'Steady Saver', 'Balance held or grew at every check-in this week', 'weekly', 35, false],
  ['weekly_strategist', 'Weekly Strategist', 'Win two battles this week', 'weekly', 40, false],
  ['first_steps', 'First Steps', 'Connect your savings account and record your first check-in', 'onetime', 20, true],
  ['rising_tide', 'Rising Tide', 'Balance increases between two check-ins (any amount)', 'onetime', 30, false],
  ['first_blood', 'First Blood', 'Win one battle against another player', 'onetime', 30, false],
  ['tactician', 'Tactician', 'Use both Defend and a Special Move in a single battle', 'onetime', 25, true],
  ['bracket_climb', 'Bracket Climb', 'Reach the Bronze bracket (3 NIM)', 'onetime', 50, false],
  ['first_deposit', 'Vault Opened', 'Make your first deposit into your vault.', 'onetime', 20, false],
]
```

Map to the real payload shape (`key`, `name`, `description`, `type`,
`xpReward`, `bracketRequired`, `completed`, `completedAt`, `nextResetAt`) and
`counters: { dailyXpEarned: 10, dailyXpCap: 25, weeklyXpEarned: 25,
weeklyXpCap: 100 }`.

States, driven by `process.env.STATE`:

| STATE | Fixture |
|---|---|
| `repeating` | the slate above; tab left on Repeating |
| `one-time` | same slate; click the One-time tab after ready |
| `done` | every mission `completed: true`; counters `25/25`, `100/100` |
| `empty` | `missions: []`; counters `0/25`, `0/100` |
| `error` | `/api/missions` returns `500` |
| `loading` | the `/api/missions` response is delayed 2500ms |

Slugs: `missions-repeating`, `missions-one-time`, `missions-done`,
`missions-empty`, `missions-error`, `missions-loading`. Intercept
`/api/missions`, `/api/players/me`, `/api/profile`; do not start Supabase.

Tab click helper:

```js
await evaluate(`(() => {
  const tab = [...document.querySelectorAll('[role="tab"]')]
    .find((el) => el.textContent.trim() === 'One-time')
  tab?.click()
  return Boolean(tab)
})()`)
```

- [ ] **Step 3: Capture the before state**

Start `npm run dev -- -p 3001 -H 0.0.0.0`, then run the harness with
`STATE=repeating OUT_DIR=docs/superpowers/renders/missions/before` (adapt the
slug to `missions`). Capture 360/390/430. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/renders/missions/before
git commit -m "chore: missions before renders"
```

---

### Task 1: Home `xpReward` fix (separate, from decision 9)

**Files:**
- Modify: `src/app/(tabs)/page.tsx`
- Modify: `src/lib/home.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/home.test.ts`:

```ts
test('Home reads the mission payload field the API returns', () => {
  assert.match(HOME, /xpReward: m\.xpReward \?\? m\.xp_reward/)
  assert.doesNotMatch(HOME, /xpReward: m\.xp_reward\b/)
})
```

- [ ] **Step 2: Run to verify failure**

```bash
node --import tsx --test src/lib/home.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Fix the read and the local type**

In `fetchDailyMissions`, type the response row as
`{ key: string; name: string; completed: boolean; xpReward: number; xp_reward?: number }`
and map `xpReward: m.xpReward ?? m.xp_reward`. Fall back to `0` if both are
missing so the row never prints `undefined`.

- [ ] **Step 4: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add "src/app/(tabs)/page.tsx" src/lib/home.test.ts
git commit -m "fix: read xpReward from the missions payload on Home"
```

---

### Task 2: The 12px caption role

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/lib/panels.test.ts`

- [ ] **Step 1: Write the failing assertion**

In `panels.test.ts`, add `.sv-caption: 12` to the `sizes` map and assert:

```ts
assert.match(block('.sv-caption'), /text-transform:\s*none/)
```

- [ ] **Step 2: Run to verify failure**

```bash
node --import tsx --test src/lib/panels.test.ts
```

Expected: `.sv-caption is missing`.

- [ ] **Step 3: Add the rule**

Inside the type-scale `@layer components` block in `globals.css`, beside
`.sv-label`:

```css
.sv-caption { font-family: var(--font-jakarta); font-weight: 600; font-size: 12px; line-height: 1.4; text-transform: none; }
```

No existing rule changes. This is the only shared CSS addition in the batch.

- [ ] **Step 4: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/app/globals.css src/lib/panels.test.ts
git commit -m "feat: add the 12px caption type role"
```

---

### Task 3: Mission XP helpers

**Files:**
- Create: `src/lib/missions-ui.ts`
- Create: `src/lib/missions-ui.test.ts`

**Interfaces:**

```ts
export function earnedXp(
  missions: { completed: boolean; xpReward: number }[],
  cap: number,
): number

export function xpCounter(earned: number, cap: number): string
```

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { earnedXp, xpCounter } from './missions-ui'

const row = (xpReward: number, completed: boolean) => ({ xpReward, completed })

test('earned XP sums only completed rows', () => {
  assert.equal(earnedXp([row(10, true), row(15, false)], 25), 10)
})

test('earned XP reaches the cap when everything is done', () => {
  assert.equal(earnedXp([row(10, true), row(15, true)], 25), 25)
})

test('earned XP clamps to a smaller cap', () => {
  assert.equal(earnedXp([row(30, true)], 25), 25)
})

test('an empty slate earns nothing and a zero cap does not clamp', () => {
  assert.equal(earnedXp([], 25), 0)
  assert.equal(earnedXp([row(10, true)], 0), 10)
})

test('the counter copy matches the handoff', () => {
  assert.equal(xpCounter(10, 25), '10 of 25 XP')
  assert.equal(xpCounter(0, 100), '0 of 100 XP')
})
```

- [ ] **Step 2: Run to verify failure**

```bash
node --import tsx --test src/lib/missions-ui.test.ts
```

- [ ] **Step 3: Implement**

```ts
export function earnedXp(
  missions: { completed: boolean; xpReward: number }[],
  cap: number,
): number {
  const sum = missions.reduce((total, m) => total + (m.completed ? m.xpReward : 0), 0)
  return cap > 0 ? Math.min(cap, sum) : sum
}

export function xpCounter(earned: number, cap: number): string {
  return `${earned} of ${cap} XP`
}
```

- [ ] **Step 4: Verify and commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/lib/missions-ui.ts src/lib/missions-ui.test.ts
git commit -m "feat: derive mission group XP"
```

---

### Task 4: Missions page port

**Files:**
- Rewrite: `src/app/(tabs)/missions/page.tsx`
- Modify: `src/lib/missions-ui.test.ts` (page source contract)

- [ ] **Step 1: Write the failing page contract tests**

Append to `src/lib/missions-ui.test.ts`:

```ts
import { readFileSync } from 'node:fs'
const PAGE = readFileSync(new URL('../app/(tabs)/missions/page.tsx', import.meta.url), 'utf8')
const HOME = readFileSync(new URL('../app/(tabs)/page.tsx', import.meta.url), 'utf8')

test('the page uses tabs and the shared primitives only', () => {
  for (const part of ['<Tabs', '<PixelPanel', '<Row', '<Banner', '<Button', '<LoadingState />']) {
    assert.match(PAGE, new RegExp(part.replace(/[<>/]/g, '\\$&')), part)
  }
  assert.doesNotMatch(PAGE, /vpx|CapMeters|function Cap\(/)
})

test('the page ports the handoff groups and copy', () => {
  assert.match(PAGE, /Repeating/)
  assert.match(PAGE, /One-time/)
  assert.match(PAGE, /Never expires/)
  assert.match(PAGE, /Resets 00:00 UTC/)
  assert.match(PAGE, /Resets Monday 00:00 UTC/)
  assert.match(PAGE, /xpCounter\(/)
  assert.match(PAGE, /earnedXp\(/)
})

test('the row shows a 24px status box, mint XP and open-row descriptions', () => {
  assert.match(PAGE, /w-6 h-6/)
  assert.match(PAGE, /<Glyph name="check"/)
  assert.match(PAGE, /sv-figure/)
  assert.match(PAGE, /m\.completed \? 'text-fg-muted' : 'text-mint'/)
  assert.match(PAGE, /\{!m\.completed &&/)
  assert.match(PAGE, /\(completed\)/)
})

test('the page keeps the states and drops the cap cards', () => {
  assert.match(PAGE, /Couldn&apos;t load missions\.|Couldn't load missions\./)
  assert.match(PAGE, /Try again/)
  assert.match(PAGE, /No missions right now\./)
  assert.match(PAGE, /Check back after the next reset\./)
  assert.match(PAGE, /One-time missions appear as you play\./)
  assert.doesNotMatch(PAGE, /<Chip/)
})
```

- [ ] **Step 2: Run to verify failure**

```bash
node --import tsx --test src/lib/missions-ui.test.ts
```

- [ ] **Step 3: Rewrite the page**

Header comment: one paragraph, noting the tabs, the group headers own the
counters, and the API is unchanged.

State:

```tsx
const [tab, setTab] = useState<'repeating' | 'onetime'>('repeating')
const [reload, setReload] = useState(0)
```

Fetch effect depends on `[router, reload]`; on start set `loading` true and
`error` null. Non-OK throws a typed `MissionsError` or sets the copy directly:

```tsx
if (!res.ok) throw new Error('Couldn’t load missions.')
```

Use the ASCII form `Couldn't load missions.` (straight apostrophe) in code.
Catch sets the same copy for network errors; never print a raw JS message.

Retry:

```tsx
<Button variant="secondary" fullWidth={false} onClick={() => setReload((n) => n + 1)}>
  Try again
</Button>
```

Body:

```tsx
<ScreenShell variant="tab" title="Missions" bodyClassName="gap-3.5">
  <Tabs
    ariaLabel="Mission type"
    value={tab}
    onChange={(v) => setTab(v as 'repeating' | 'onetime')}
    items={[
      { value: 'repeating', label: 'Repeating' },
      { value: 'onetime', label: 'One-time' },
    ]}
  />
  {loading && <LoadingState />}
  {error && !loading && (
    <>
      <Banner tone="error">{error}</Banner>
      <Button variant="secondary" fullWidth={false} onClick={retry}>Try again</Button>
    </>
  )}
  {!loading && !error && missions && counters && (
    tab === 'repeating' ? (
      <>
        {daily.length > 0 && <Group title="Daily" caption={`Resets 00:00 UTC · ${xpCounter(earnedXp(daily, counters.dailyXpCap), counters.dailyXpCap)}`} missions={daily} />}
        {weekly.length > 0 && <Group title="Weekly" caption={`Resets Monday 00:00 UTC · ${xpCounter(...)}`} missions={weekly} />}
        {daily.length === 0 && weekly.length === 0 && <EmptyPanel tone="repeating" />}
      </>
    ) : (
      oneTime.length > 0
        ? <Group title="One-time" caption="Never expires" missions={oneTime} />
        : <EmptyPanel tone="onetime" />
    )
  )}
</ScreenShell>
```

`Group` and `MissionRow` follow spec 4.1 and 4.2. Details:

- Group header caption uses `sv-caption font-bold text-fg-muted`; the counter
  numbers get `tabular-nums` (Tailwind utility) or `.sv-figure` is not used for
  the caption.
- `Row` gets `divider={i < missions.length - 1}`.
- Leading box: `aria-hidden`, `w-6 h-6 shrink-0 flex items-center justify-center border-2`,
  done `bg-mint border-mint text-background`, open `border-mint`.
- Label: `sv-body font-semibold sv-break`, done adds `text-fg-muted` and
  `<span className="sr-only"> (completed)</span>`.
- Description: only when `!m.completed`,
  `<span className="sv-caption text-fg-muted">{m.description}</span>`.
- Trailing: `<span className={`sv-figure ${m.completed ? 'text-fg-muted' : 'text-mint'}`}>+{m.xpReward} XP</span>`.
- Delete `CapMeters`, `Cap`, `formatTime`, the `Chip` import and the
  `ReactNode` import if unused.

- [ ] **Step 4: Run the full suite and spot-check**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Capture `missions-repeating@390.png` and `missions-one-time@390.png` into
`docs/superpowers/renders/missions/after/`; inspect tabs, headers, row heights,
mint checks and XP.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(tabs)/missions/page.tsx" src/lib/missions-ui.test.ts docs/superpowers/renders/missions/after/missions-repeating@390.png docs/superpowers/renders/missions/after/missions-one-time@390.png
git commit -m "feat: port the missions screen to the handoff"
```

---

### Task 5: Renders, audit, review and status

**Files:**
- Create: `docs/superpowers/renders/missions/after/missions-{repeating,one-time,done,empty,error,loading}@{360,390,430}.png`
- Create: `docs/superpowers/renders/missions/audit/final-audit.jsonl`
- Create: `docs/superpowers/renders/missions/review/index.html`
- Create: `docs/superpowers/renders/missions/review/NOTES.md`
- Modify: `docs/superpowers/audits/2026-11-05-ui-gap-audit.md`

- [ ] **Step 1: Capture the six states**

With the dev server on 3001, for each `STATE` run the harness with
`OUT_DIR=docs/superpowers/renders/missions/after`; 360/390/430 each. Confirm
18 PNGs exist and open the one-time, error and loading shots to check the tab,
banner + retry and three dots.

- [ ] **Step 2: Run the audit**

`AUDIT=1` for the six states, appending each JSON line to
`docs/superpowers/renders/missions/audit/final-audit.jsonl` with `state` and
`width` fields. Expected per row: `overflowX: 0`, empty `wide`, empty `small`,
`minFont: 12`, and every `order` entry `inView` and not `covered` with the mint
outline.

- [ ] **Step 3: Build the review page**

Copy the Battle review page's shell and CSS. Sections in this order:
Repeating, One-time, All done, Empty, Error, Loading. Each has a 360/390/430
strip, a one-line route/state note, and a `<details>` with the before renders
on the Repeating section. Finish with a "Deliberate choices" note block.

`NOTES.md`: sign-off checkboxes for the six states, a corrections block per
state, and deliberate choices:

- Tabs match the handoff; the Weekly caption may wrap at 360.
- Rows are status only; there is no client mission write.
- Open rows only carry descriptions; done rows are 58px.
- One-time shows six missions with `Never expires` and no counter.
- Counters are derived from completed rows; the Weekly API counter is a known
  check-in-count approximation and is not consumed.
- Weekly Strategist has no progress meter because the API has no win count.
- The Home `xpReward` fix is its own commit.

- [ ] **Step 4: Append the audit status**

`## 19. Missions UI status — 2026-11-09` with: what landed, verification table
(tests, tsc, lint, build), 360 behaviour, rulings, renders paths, and remaining
(API weekly counter follow-up, real-device pass, no merge before sign-off).

- [ ] **Step 5: Final verification and commit**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
git add docs/superpowers/renders/missions docs/superpowers/audits/2026-11-05-ui-gap-audit.md
git commit -m "chore: missions UI renders, audit and review"
```

- [ ] **Step 6: Report, do not merge**

Summarise the diff, test counts, lint warnings and render paths. Wait for
sign-off; do not merge or push.

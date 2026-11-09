# Missions UI redesign - design

**Date:** 2026-11-09
**Status:** awaiting approval
**Branch:** `missions-ui-redesign` (from `main` at `bbdc7f7`)
**Depends on:** Foundation 2 primitives, the brand `LoadingState`, the paired-card
height fix and the panel side-outline fix.
**Reference:** `Savborne-handoff.html` figure `A_Missions`, and
`docs/superpowers/audits/2026-11-05-ui-gap-audit.md` sections 3.4, 6, 7, 15
and 18.

---

## 1. Goal

Port `/missions` to the handoff's Progress screen:

- A `Repeating` / `One-time` tab pair.
- Repeating holds a Daily group and a Weekly group; One-time holds the six
  one-time missions.
- Each group is one grouped `PixelPanel` with 58px `Row`s: 24px checkbox,
  label, an optional 12px description, and the XP reward.
- Each group header carries the reset line and the period XP counter, e.g.
  `Resets 00:00 UTC · 10 of 25 XP`.
- The two ad-hoc cap cards disappear; the counters in the headers replace them.
- Loading, error, empty and all-done states are designed, not accidental.

This is a UI port. The API contract, the mission definitions, the XP values and
the award rules do not change.

---

## 2. Scope

### In

- `/missions` page structure, tabs, group headers, rows, states and copy.
- A small derived-XP helper with unit tests.
- One additive Foundation 2 type role, `.sv-caption` (12px), for the
  description and the group counter.
- A separate one-line Home fix for the `xpReward` field name (see 6.2).
- Unit/source-contract tests, before/after renders at 360/390/430, audit and
  review page.

### Out

- Mission rules, XP values, caps, reset arithmetic, award timing or SQL.
- `GET /api/missions` response shape or field names.
- The Weekly counter defect in the API (logged, not fixed here; see 6.3).
- Home, Profile, Items, Ranks, Battle, Economy, Onboarding layouts.
- A new mission-progress endpoint or a progress meter for Weekly Strategist.
- URL-persisted tab state, new motion vocabulary, sound or haptics.

---

## 3. Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Structure | `Tabs` (Repeating / One-time), handoff style. Repeating is selected on mount. |
| 2 | Row checkbox | Read-only status. Missions are credited server-side; there is nothing to toggle. The box is `aria-hidden`; completion is announced by a visually hidden `(completed)` in the row label. |
| 3 | Descriptions | Open rows only. Done rows are label + muted XP at exactly 58px, as the handoff draws them. |
| 4 | Reset time | Group caption only. The per-row reset lines are removed. |
| 5 | One-time tab | One grouped `PixelPanel` with the six one-time missions, header `One-time` and caption `Never expires`. No XP counter, because the API has no one-time counter. |
| 6 | Cap cards | Removed. `CapMeters` and `Cap` are deleted; the group headers own the numbers. |
| 7 | Earned XP | Sum of `xpReward` for completed missions in the group, clamped to the API cap. Caps come from `counters.dailyXpCap` / `weeklyXpCap`. |
| 8 | Error state | `Banner` plus a secondary `Try again` button that re-runs the fetch. Error copy is `Couldn't load missions.` |
| 9 | Home field bug | Fixed in this branch as its own commit: read `xpReward` (with `xp_reward` fallback) so Home stops rendering `+undefined XP`. |
| 10 | Group title colour | Default text, as the handoff draws `Daily`/`Weekly`; mint stays reserved for success/progress/you. |
| 11 | Description/counter type | `.sv-caption`: 12px / 600 / 1.4, not uppercase. This is the single shared CSS addition. |
| 12 | Weekly Strategist | The API has no win count, so the row shows the description only; no `1 of 2 wins` meter. |
| 13 | Tab state | React state only; no query parameter. Renders capture the One-time tab by clicking it. |
| 14 | Empty state | Per tab. Repeating: `No missions right now.` / `Check back after the next reset.`; One-time: `No missions right now.` / `One-time missions appear as you play.` |

---

## 4. Screen anatomy

`ScreenShell variant="tab" title="Missions"`, body gap 14px (existing
`bodyClassName="gap-3.5"`).

```
Missions                       (36px shell header, unchanged)

[ Repeating ][ One-time ]      (Tabs, 44px)
Daily                 Resets 00:00 UTC · 10 of 25 XP
┌ PixelPanel ─────────────────────────────────────────┐
│ [x] Daily Check-in                      +10 XP      │  58px, done
│ [ ] Quick Duel                            +15 XP    │  ~60px, open
│     Start one battle today                          │
└─────────────────────────────────────────────────────┘
Weekly        Resets Monday 00:00 UTC · 25 of 100 XP
┌ PixelPanel ─────────────────────────────────────────┐
│ [x] Weekly Check-in                     +25 XP      │
│ [ ] Steady Saver                         +35 XP     │
│     Balance held or grew at every check-in this week│
│ [ ] Weekly Strategist                    +40 XP     │
│     Win two battles this week                       │
└─────────────────────────────────────────────────────┘
```

One-time tab:

```
[ Repeating ][ One-time ]

One-time                              Never expires
┌ PixelPanel ─────────────────────────────────────────┐
│ [ ] First Steps        Connect your savings… +20 XP │
│ [ ] Rising Tide        Balance increases…    +30 XP │
│ [ ] First Blood        Win one battle…       +30 XP │
│ [ ] Tactician          Use both Defend…      +25 XP │
│ [ ] Bracket Climb      Reach the Bronze…     +50 XP │
│ [ ] Vault Opened       Make your first…      +20 XP │
└─────────────────────────────────────────────────────┘
```

### 4.1 Group header

- `<section aria-label={title}>`, `flex flex-col gap-2`.
- Groups sit in a `GroupList` (`flex flex-col gap-9`): 36px between groups.
  The shell body keeps 14px from the tabs to the first group, and the group
  itself keeps 8px from its header to its panel.
- Header row: `flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1`.
- Title: `<h2 className="sv-subheading">` (20px, default text colour).
- Caption: `.sv-caption font-bold text-fg-muted` with tabular numerals where a
  counter is present.
- Copy:
  - Daily: `Resets 00:00 UTC · {earned} of {cap} XP`
  - Weekly: `Resets Monday 00:00 UTC · {earned} of {cap} XP`
  - One-time: `Never expires`

At 360 the Weekly caption may take its own line inside the header; nothing is
truncated or shrunk.

### 4.2 Row

`Row` with the default 58px minimum and `divider={i < last}`:

- Leading: 24x24 box, `border-2`. Done: mint fill, mint border, ground check
  glyph (16px). Open: mint border, transparent fill. `aria-hidden`.
- Body: label 15px (`text-[15px] leading-[1.35] font-semibold`) with `sv-break`.
  Done label `text-fg-muted` plus `<span className="sr-only"> (completed)</span>`.
  Open label default text.
- Optional body line: only when open, 12px/500/1.35 (`sv-caption font-medium
  leading-[1.35] text-fg-muted`).
- The body column carries `py-2` (8px top and bottom), so the last line never
  sits on the divider.
- Trailing: `.sv-figure` `+{xpReward} XP`; open `text-mint`, done
  `text-fg-muted`.
- Done and one-line rows measure 58px. A two-line description row grows to
  about 71px with 8px of clearance under the text. Rows never clip or truncate.

### 4.3 Panel

One `PixelPanel className="px-4 py-0"` per group, rows only. No media, no
second panel per mission, no `vpx`.

### 4.4 States

| State | Content |
|---|---|
| Loading | `Tabs` remain visible; `<LoadingState />` below them. |
| Error | `Banner tone="error"` with `Couldn't load missions.` and a secondary `Try again` button (`fullWidth={false}`) that resets error/loading and refetches. Tabs remain. |
| Empty per tab | A `PixelPanel className="p-6 text-center flex flex-col gap-2"` with `sv-body text-fg-muted` and `sv-label text-fg-faint` copy from decision 14. |
| Empty group | A group with no missions is not rendered; if all groups in the tab are empty, the tab-empty panel shows. |
| All done | Rows render muted with mint checks; counters show the cap, e.g. `25 of 25 XP`. The group header and panel stay. |
| 401 | Unchanged: `router.replace('/setup')`. |

---

## 5. Data flow

Unchanged fetch: `GET /api/missions` with `authHeaders()`.

```
Mission[]        -> filter by type: daily | weekly | onetime
counters.daily   -> cap for the Daily counter
counters.weekly  -> cap for the Weekly counter
earned(group)    -> clamp(sum(xpReward where completed), cap)
```

`src/lib/missions-ui.ts`:

```ts
export function earnedXp(
  missions: { completed: boolean; xpReward: number }[],
  cap: number,
): number

export function xpCounter(earned: number, cap: number): string // "10 of 25 XP"
```

`earnedXp` returns the sum when `cap <= 0`, otherwise `min(cap, sum)`.
`nextResetAt` and `completedAt` stay in the payload but are not rendered; the
handoff's reset line is fixed text.

### 5.1 Why earned is derived, not read

`/api/missions` computes `weeklyXpEarned` as `check_ins.length` this week and
`/api/players/me` returns the same approximation; the route labels it a
count-based approximation. Displayed verbatim, one weekly check-in would read
`1 of 100 XP` while the Weekly Check-in row (25 XP) is ticked. The mission caps
are exactly the sum of the period's rewards (Daily 25 = 10 + 15, Weekly
100 = 25 + 35 + 40), so the sum of completed rewards is the honest figure and
always agrees with the checkboxes. Caps still come from the API. The API defect
is recorded in section 6.3 rather than fixed in a UI batch.

---

## 6. Shared changes and follow-ups

### 6.1 `.sv-caption` (proposed, needs approval)

`src/app/globals.css`, inside the type-scale `@layer components` block:

```css
.sv-caption { font-family: var(--font-jakarta); font-weight: 600; font-size: 12px; line-height: 1.4; }
```

Reasons: the handoff uses 12px for both the mission description and the group
counter, and Foundation 2 has no 12px sentence-case role (`.sv-section-label`
is uppercase; `.sv-label` is 13px). This is additive; no existing rule changes.
If you would rather not touch shared CSS, the fallback is `.sv-label` (13px)
for both, with a 1px fidelity loss.

### 6.2 Home `xpReward` fix

`src/app/(tabs)/page.tsx` reads `xp_reward` and maps it to `xpReward`, but the
API returns `xpReward`. Home's two daily rows therefore render `+undefined XP`.
Fix: read `m.xpReward ?? m.xp_reward`; update the Home fixture and the test.
Separate commit, no layout change.

### 6.3 Weekly counter defect (not fixed here)

`/api/missions` `weeklyXpEarned` and `/api/players/me`
`weeklyXpEarnedThisWeek` are check-in counts (the latter multiplied by 33). The
Missions header does not consume either. A later API batch should sum the
week's weekly-mission rewards from `player_missions` and keep the field names.

---

## 7. Accessibility

- Tabs: existing primitive (`role=tablist`, `role=tab`, `aria-selected`,
  `aria-label="Mission type"`), 44px each. No primitive change; the same
  limitation as Ranks (no `aria-controls`) is accepted for this batch.
- Rows are not interactive: no focus stop, no 44px target requirement, no
  pressed state. Completion is text: a visually hidden `(completed)`.
- The checkbox is decorative (`aria-hidden`); colour is never the only signal.
- Error is an alert (`Banner`); the retry button is a real 56px `Button` with
  the global 2px mint focus ring.
- Type floor: minimum rendered 12px outside `.sv-state`.

---

## 8. Verification

| Check | Target |
|---|---|
| `npm test` | 370 existing + ~10 new pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 errors; warnings at or below the current 50 |
| `npm run build` | exit 0; `/missions` compiles |
| Renders | 18 PNGs (6 states x 360/390/430) in `docs/superpowers/renders/missions/after/` |
| Before renders | 3 PNGs (current Missions x 360/390/430) in `.../missions/before/` |
| Audit | 18 JSONL rows in `.../missions/audit/final-audit.jsonl`: `overflowX: 0`, no element wider than the viewport, no interactive target below 44px, min font 12, every tab stop in view and uncovered |
| Review | `.../missions/review/index.html` + `NOTES.md` with sign-off boxes |
| Audit doc | new `## 19. Missions UI status — 2026-11-09` section |

States captured: Repeating mixed, One-time, Repeating all done, Empty,
Error, Loading.

Live Supabase checks stay blocked (`.env.local` absent); tests, build and
fixture renders do not depend on it.

---

## 9. Risks

1. **360 header wrap.** The Weekly caption may wrap under `Weekly`; accepted
   and captured rather than shrinking type or truncating copy.
2. **Description height.** Rows with a two-line description exceed 58px; the
   task's 58px is a minimum (`Row`), and clipping would break the no-truncation
   rule.
3. **Derived counter vs API value.** Earned is derived from the rows; if mission
   rewards are ever changed so a group's sum exceeds its cap, the clamp keeps
   the figure at the cap.
4. **One-time XP total.** Deliberately not shown; it is not in the API and
   would invite cap confusion.
5. **Weekly counter defect** remains in the API for other consumers until the
   follow-up batch.

---

## 10. Approval needed

- The structure, row and state decisions in section 3.
- The one additive shared rule `.sv-caption` (section 6.1), or the 13px
  fallback.
- The separate Home `xpReward` commit (section 6.2).

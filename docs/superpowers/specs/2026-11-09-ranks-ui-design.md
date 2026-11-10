# Ranks UI redesign - design

**Date:** 2026-11-09
**Status:** awaiting approval
**Branch:** `ranks-ui-redesign` (from `main` at `646e85f`)
**Depends on:** Foundation 2 primitives, the brand `LoadingState`, the paired-card
height fix, the panel side-outline fix and the Missions port.
**Reference:** `Savborne-handoff.html` figures `A_RanksRanked` and
`A_RanksUnranked`, and `docs/superpowers/audits/2026-11-05-ui-gap-audit.md`
sections 3.6, 6, 7, 15, 18 and 19.

---

## 1. Goal

Port `/leaderboard` ("Ranks") to the handoff:

- Keep the `Ranked` / `Unranked` tabs.
- Replace the header "Friends on/off" button with `Everyone` / `Friends` 44px
  filter chips (`aria-pressed`, cream selected fill with ground text).
- One grouped `PixelPanel` of 56px rows: rank in a 26px column, name at 15px,
  bracket at 12px in a 52px column, and a right-aligned 14px tabular figure in
  a 48px (ranked) or 56px (unranked) column.
- The caller's row is 60px, mint top and bottom borders, a mint rank and a
  mint `You` tag, bleeding through the panel's 14px inline padding.
- The caller's rank is pinned below the list when it falls outside the top 50.
- The handoff's board-specific footer line at 12px, with the count and the
  verified-saver legend as a second 12px line.
- Designed loading, error, empty, friends-empty and 401 states.

The ranking rules, the friends definition and the score definitions do not
change. The only API change is an additive `you` field for the pinned row.

---

## 2. Scope

### In

- `/leaderboard` page structure, tabs, filter chips, rows, your row, pinned row,
  footer and copy.
- A new `FilterChip` primitive (44px button, cream pressed fill).
- A `Row` variant `you` (60px, mint borders, 14px bleed) and one new surface
  token for the tinted row.
- A `RankCrown` art component for rank 1, extracted from the handoff figure.
- A pure `src/lib/ranks-ui.ts` module for rank tone, footer copy, friends-empty
  detection and the pin decision, with unit tests.
- An additive `you` field on `GET /api/leaderboards` so the caller's rank can
  be pinned outside the top 50. `rows`, `total`, the sorts and the friends
  filter are unchanged.
- Unit/source-contract tests, before/after renders at 360/390/430, an audit,
  a review page and an audit-doc section.

### Out

- Ranking logic, Elo, the unranked combined-score formula, the friends
  definition ("players you have fought in human battles").
- Renaming API fields. The unranked score still reuses `rating`, and its
  sub-scores still reuse `losses` and `ties`; display mapping stays in the UI.
- Home, Economy, Battle, Onboarding, Missions, Profile and Items layouts.
- Making the board rows themselves interactive.
- URL-persisted tab/filter state, new motion vocabulary, sound or haptics.
- Showing level, wins or streak on the Ranks rows (decision 3).
- Changing the handoff's 20px/11px You tag to a new one-off 20px rule
  (decision 6 uses the existing 24px Chip).

---

## 3. Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Everyone/Friends control | New `FilterChip` primitive: a 44px button, 2px bevel, 18px inline padding, cream fill and ground text when pressed, mint focus ring. `Chip` stays a non-interactive 24px status span; `Tabs` stays a `role="tablist"`. |
| 2 | Unranked board | Keep the app's combined savings score for ordering and for the right column. The handoff's level ordering is recorded as a divergence. |
| 3 | Row anatomy | Strict handoff single line: rank, name, bracket, figure. Level, wins and streak are not shown on Ranks. |
| 4 | Rank-1 badge | Show both: the handoff crown for rank 1 **and** the verified-saver marker. The crown is positional and decorative (the rank cell already says 1); the crown art is the handoff's 24px drawing, not the 16px Golden Crown item. |
| 5 | Your row | Handoff bleed: 60px, mint top and bottom borders, 4px block margin, 14px inline bleed, tinted surface. The row above keeps its track divider; the mint borders are the You row's own. |
| 6 | You tag | Existing `Chip variant="fill"` at 24px and 12px text (4px taller than the handoff; above the type floor). |
| 7 | Footer | Board-specific handoff line at 12px, then a second 12px line with the player count and the verified-saver legend. |
| 8 | Friends empty | A distinct friends-empty panel when the Friends list contains no one but the caller. The Everyone tab still shows the caller's row. |
| 9 | Your rank outside top 50 | Add an additive `you` row to the API response and pin it in its own panel below the list, under a `Your rank` caption. |
| 10 | Tab and filter state | Local React state only; no query parameter. |
| 11 | Rank colour | Default text for ranks 1-3 and muted for 4+, as the handoff draws them. The app's gold/silver/bronze rank numbers are dropped from this screen. |
| 12 | You row colour | New `--you-surface: #1B2E29` token (the handoff's row fill), not `--surface-hi`. |
| 13 | Zero bracket | An em dash in the 52px bracket column, with a visually hidden `No bracket yet`. The column never collapses, so the figure stays aligned. |
| 14 | Empty board | Everyone-empty is `Nobody on this board yet.` plus a board-specific hint; Friends-empty is its own copy. The footer is hidden in both. |
| 15 | Crown on both boards | The crown is applied to rank 1 on Ranked and Unranked, because both handoff figures draw it. |
| 16 | `you` shape | The pinned row is the same shape as a `rows` entry, so the UI renders one `RankRow` component in both places. |

### 3.1 Crown naming note

`golden_crown` is also the Gold-bracket badge in `src/lib/game/badges.ts` and
the 16px item in `assets/items.json`. The crown on rank 1 is **not** that badge
or item: it is the handoff's 24x24 rank flourish, drawn from the handoff figure
by `RankCrown`, and it means "rank 1" only. The Gold-bracket Golden Crown
continues to live on Profile. This is recorded as a ruling in the audit section
so the two cannot be confused later.

---

## 4. Screen anatomy

`ScreenShell variant="tab" title="Ranks" bodyClassName="gap-3.5"`. No header
actions.

```
Ranks                          (36px shell header, unchanged)

[ Ranked ][ Unranked ]         (Tabs, 44px, mint selected)

[ Everyone ][ Friends ]        (FilterChip, 44px, cream selected)

┌ PixelPanel px-3.5, py-0.5 ─────────────────────────────┐
│ 1    Adaeze ♛ ⟡                    Gold        1284   │  56px
│ 2    Chinedu                       Silver      1231   │  56px
│ 3    Zainab                        Gold        1197   │  56px
│ 4    Ife                           Bronze      1143   │  56px
│ 5    Tobi                          Bronze      1090   │  56px
│ ┌──────────────────────────────────────────────────┐  │
│ │ 6  Kemi  You                 Silver        1042 │  │  60px, mint borders
│ └──────────────────────────────────────────────────┘  │  bleeds 14px each side
│ 7    Femi the Fearless Saver       Entry       1021   │  56px
│ 8    Bola ⟡                        Bronze      1008   │  56px
└────────────────────────────────────────────────────────┘

Your rank                      (only when outside the top 50)
┌ PixelPanel ────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────┐  │
│ │ 57  Kemi  You                Silver         812 │  │
│ └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘

Ranked points from human ranked battles. Only display names are
shown, never addresses or balances.                        12px
57 players · ⟡ verified saver                              12px
```

Unranked replaces the figure column width (48 → 56px), the score values and the
footer line.

### 4.1 Column geometry

Per row: 12px gaps (`gap-3` overrides `.sv-row`'s 14px), border-box heights.

| Column | Width | Type | Colour |
|---|---|---|---|
| Rank | 26px, centred, `shrink-0` | Jakarta 700, 14px, tabular (`.num`) | fg for 1-3, muted for 4+; mint on your row |
| Name | `flex-1`, `min-w-0` | Jakarta 700, 15px, `leading-[1.2]`, `sv-break` | fg |
| Bracket | 52px, `shrink-0`, nowrap | Jakarta 700, 12px (`.sv-caption font-bold`) | muted |
| Figure | 48px ranked / 56px unranked, right, `shrink-0` | Jakarta 700, 14px, tabular (`.num`) | fg |

- Badges sit after the name: the crown for rank 1, then the verified marker,
  then the `You` chip; 8px gaps; all `shrink-0`.
- A name longer than the column wraps inside the 56px row. Three 18px lines fit;
  above that the row grows (min-height, never a truncation).
- The rank cell and the figure carry visually hidden `Rank` / `Score` labels for
  screen readers; the visible text is unchanged.

### 4.2 Your row

`Row variant="you"`:

- `.sv-row--you` sets `min-height: 60px`, `margin-block: 4px`,
  `margin-inline: -14px`, `padding-inline: 14px`, `background:
  var(--you-surface)`, and 2px mint top and bottom borders.
- The Row does **not** add `sv-row--56` or `sv-row--divider` for this variant;
  the mint borders own both edges.
- The row above keeps its 2px track divider, so the handoff's 4px gap sits
  between the track divider and the mint top border. The row below starts after
  the You row's 4px bottom margin.
- The panel uses `px-3.5` (14px) so the bleed is exact. The bleed lands on the
  panel's inner edge and stays inside the stepped `clip-path`.
- The You tag is `Chip variant="fill"` after the name. Rank and tag are mint;
  name, bracket and figure keep their normal colours, as the handoff draws them.

### 4.3 Pinned your-rank row

Only when `you` exists and no `rows` entry is `isMe`:

```
<section aria-label="Your rank" class="flex flex-col gap-2">
  <h2 class="sv-caption font-bold text-fg-muted">Your rank</h2>
  <PixelPanel class="px-3.5 py-0.5">
    <Row variant="you" ... />
  </PixelPanel>
</section>
```

The separate panel and caption avoid implying rank 51, 58 or a contiguous list.
The row reuses the exact You row component, including the bleed, crown and
verified marker.

### 4.4 Footer

Rendered only when the board has listable rows (not empty, not friends-empty):

- Ranked: `Ranked points from human ranked battles. Only display names are
  shown, never addresses or balances.`
- Unranked: `Savings score from check-in growth and consistency. Only display
  names are shown, never addresses or balances.`
- Second line: `{n} player{s}`, plus ` · ⟡ verified saver` only when at least
  one rendered row (list or pinned) has `verifiedSaver`.
- Both lines are `.sv-caption text-fg-muted`, left aligned, no truncation.

### 4.5 Filter chips

`FilterChip` renders a native `button` with `type="button"`, `aria-pressed`,
and `.sv-filter`:

```css
.sv-filter {
  height: 44px;
  padding: 0 18px;
  border: 2px solid var(--bevel);
  background: var(--surface);
  color: var(--fg);
  font-family: var(--font-jakarta), system-ui, sans-serif;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
.sv-filter[aria-pressed='true'] {
  background: var(--fg);
  border-color: var(--fg);
  color: var(--shell);
}
```

The pair sits in `<div class="flex gap-2" role="group" aria-label="Board filter">`.
Selected is cream (`--fg`) with ground (`--shell`) text, never mint. Mint stays
for the tabs, progress, success and the You row. The global mint focus ring
applies unchanged.

---

## 5. Data flow

`GET /api/leaderboards?board=ranked|unranked&friends=0|1` with `authHeaders()`,
unchanged request.

```
rows   -> the top 50, already ranked by the API
total  -> the cohort size before the top-50 slice
you    -> the caller's full row at its real rank, or null
```

### 5.1 Additive API field (decision 9)

`src/app/api/leaderboards/route.ts` maps every sorted row through one `toRow`
function, slices the top 50 for `rows`, and returns the caller's mapped row as
`you`:

```ts
const all = rows.map(toRow)
const top = all.slice(0, 50)
const you = all.find((r) => r.isMe) ?? null
return NextResponse.json({ board, friendsOnly, rows: top, total: all.length, you })
```

- `toRow` moves the existing map body unchanged, so `rank`, `score`,
  `amountScore`, `consistencyScore` and `verifiedSaver` keep their meanings.
- The sorts and the unranked score mutation stay exactly where they are.
- `rows` and `total` are byte-for-byte the same for existing consumers.
- `you` is computed after the friends filter, so the pinned rank is the rank on
  the board being displayed.
- `you` is `null` only when the caller has no stats row.

### 5.2 UI helpers

`src/lib/ranks-ui.ts`:

```ts
export type Board = 'ranked' | 'unranked'

export function rankTone(rank: number): 'strong' | 'muted' // 1-3 strong
export function boardFooter(board: Board): string
export function isFriendsEmpty(rows: { isMe: boolean }[]): boolean
export function shouldPinYou(
  rows: { isMe: boolean }[],
  you: { rank: number } | null,
): boolean
export function footerLegend(total: number, anyVerified: boolean): string
```

`isFriendsEmpty` is true when no row belongs to anyone but the caller (which
also covers an empty array); the caller is always included by the API when a
stats row exists. `shouldPinYou` is true only when `you` exists and no list row
is `isMe`. `footerLegend` yields `1 player` / `3 players`, with
` · ⟡ verified saver` appended when asked.

---

## 6. Shared changes (proposed, need approval)

1. **`--you-surface: #1B2E29`** in the `:root` SURFACE group. One token, no
   Tailwind mapping (no class needs it).
2. **`.sv-filter` + `.sv-filter[aria-pressed='true']`** beside `.sv-tabs` in
   `globals.css`, plus `src/components/ui/FilterChip.tsx`.
3. **`.sv-row--you`** beside `.sv-row--56` in `globals.css`, plus
   `Row variant?: 'default' | 'you'`. The variant suppresses `sv-row--56` and
   `sv-row--divider`.
4. **`src/components/RankCrown.tsx`**: the handoff's 24x24 crown paths as a
   decorative, `aria-hidden` art component. A source test reads
   `Savborne-handoff.html`, extracts both crown `d` values and asserts they
   appear verbatim in the component, so the art cannot drift.
5. No change to `Chip`, `Tabs`, `Button`, `Banner`, `PixelPanel`,
   `ScreenShell`, `LoadingState` or the type scale.

The shared CSS additions are additive; no existing selector changes. If you
would rather not add `.sv-row--you`, the fallback is an inset surface highlight
(decision 5 alternative), at a fidelity cost.

---

## 7. States

| State | Content |
|---|---|
| Loading | Tabs and filter chips stay visible; `<LoadingState />` below them. |
| Error | `Banner tone="error"` with `Couldn't load ranks.` and a secondary `Try again` (`fullWidth={false}`, `self-start`) that refetches. Tabs and chips stay. Raw status/JS messages are never printed. |
| Empty (Everyone) | `Nobody on this board yet.` plus the ranked or unranked hint, in a `PixelPanel` like Missions. Footer hidden. |
| Empty (Friends) | `No friends on this board yet.` / `Friends are players you've fought in a human battle.` Footer hidden. The Everyone chip remains one tap away. |
| Pinned | When `you` is outside the top 50, the list plus the `Your rank` panel. Footer still shows. |
| Your row in list | Mint-bordered 60px row in place, as the handoff draws it. |
| 401 | `router.replace('/setup')`, matching Missions. Covered by a source-contract test; not a render state. |
| Tab/filter change | Refetch with the new query; loading state covers the swap. |

---

## 8. Accessibility

- `FilterChip` is a native button with `aria-pressed`; 44x44 minimum; cream
  selected state is also carried by `aria-pressed`, not colour alone.
- `Tabs` remains `role="tablist"` / `role="tab"` with `aria-selected` and
  `aria-label="Leaderboard"`.
- The list is not interactive: no row focus stops, no 44px target requirement.
- The crown is decorative (`aria-hidden`); the rank number and its visually
  hidden `Rank` label carry the meaning.
- The verified marker is a labelled `role="img"`; the footer legend repeats
  the meaning in text.
- The You row is identified by the visible `You` chip and the `Your rank`
  caption on the pinned panel, not by colour alone.
- Type floor: no text below 12px. Bracket and footer use the 12px `.sv-caption`;
  the You tag uses the 24px Chip at 12px.
- Focus: global 2px mint ring, 2px offset, on tabs, chips and Try again.
- Heading order: the pinned panel uses an `<h2>` under the shell `<h1>Ranks`.

---

## 9. Verification

| Check | Target |
|---|---|
| `npm test` | 382 existing + ~20 new pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 errors; warnings at or below 50 |
| `npm run build` | exit 0; `/leaderboard` compiles |
| Renders | 24 PNGs (8 states x 360/390/430) in `docs/superpowers/renders/ranks/after/` |
| Before renders | 3 PNGs (current `/leaderboard` at 360/390/430) in `.../ranks/before/` |
| Audit | 24 JSONL rows in `.../ranks/audit/final-audit.jsonl`: `overflowX: 0`, no wide element, no interactive target below 44px, min font 12, every tab stop in view and uncovered |
| Review | `.../ranks/review/index.html` + `NOTES.md` with sign-off boxes |
| Audit doc | new `## 20. Ranks UI status - 2026-11-09` section |

States captured: ranked with the caller at rank 6, ranked with the caller pinned
at rank 57, unranked, friends (three rows), friends-empty, empty, error and
loading.

---

## 10. Risks

1. **Name wrap at 360.** The name column is about 126px once the 26/52/48px
   columns and 12px gaps are taken. A long name wraps to two or three lines
   inside 56px; beyond three lines the row grows. Nothing truncates.
2. **Crown semantics.** The handoff crown shares a name with the Gold-bracket
   badge. It is positional here, decorative to AT and pinned by a provenance
   test; the audit records the distinction.
3. **Bleed and clip-path.** The You row's 14px negative margin must stay
   inside the panel's clip-path. It does, because it stops at the panel's
   padding edge; a future padding change must update both the panel class and
   `.sv-row--you`.
4. **Additive API field.** `you` is new payload; older clients ignore it, but a
   strict schema test would need updating. No existing field changes.
5. **Pinned rank on Friends.** `you` is computed after the friends filter, so
   the pinned rank is the friends-board rank, which is the honest number for
   that view.
6. **Filter chip vs tab semantics.** The chips are buttons with `aria-pressed`,
   not a second tablist; the two controls are labelled (`Leaderboard`,
   `Board filter`) so they do not read as one eight-item tab group.

---

## 11. Approval needed

- Decisions 1-16, especially the two that go beyond a pure port: the crown
  (4, 15 and 3.1) and the additive `you` field (9 and 5.1).
- The shared CSS additions and the new `FilterChip` / `RankCrown` components
  (section 6).
- The render/audit/review scope and the audit-doc section (section 9).

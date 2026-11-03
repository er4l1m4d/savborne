# Savborne — UI port to the handoff, foundation batch

**Date:** 2026-11-03
**Status:** design for review
**Artefact of record:** `Savborne-handoff.html` (423 KB, 32 screens)

---

## 1. Intent

The phone is confirmed on the current build. The gap is not deployment: it is that
`Savborne-handoff.html` specifies 32 screens and the app implements 11 routes, with
different colour values, a different nav, and none of the shared UI the artefact's
screens are built from.

The goal is to make the running app in Nimiq Pay *look and flow like the artefact*.

**Success:** opening Savborne in Nimiq Pay shows the screens as designed — real data,
real flows — not a gallery. The phone is the measure, not a desktop preview.

**This batch is the foundation only.** Its visible output is the new palette and the new
nav. It exists so the later screen batches are layout work rather than architecture.

### Non-goals

- No screen from the artefact is built here.
- No changes to battle logic, vault behaviour, API routes, or database.
- Not a pixel-diff port. The artefact's gallery uses fixed 390×844 frames and inline
  styles; the app is responsive React. "Matches" means the same token values, spacing
  scale, and visual hierarchy — not identical bytes.

---

## 2. Decisions already taken

| Decision | Choice |
|---|---|
| Colour source of truth | Adopt the handoff palette (`--sv-*` values) |
| Sequencing | Foundation first, then screen batches |
| Porting approach | Keep Tailwind + `.vpx`/`.num`; port values and extract primitives |
| Nav | 5 tabs (Home, Battle, Missions, Ranks, Profile) |
| Tab order | The artefact's order (Home, Battle, Missions, Ranks, Profile) |
| Routes | Unchanged (`/`, `/leaderboard`); only labels and icons are ported |
| Vault access | Home savings card links to `/vault` in this batch; Settings row in the Economy batch |
| Corners | Controls (chips, buttons) 6px; `.vpx`/`.vpx-soft` panels stay square |
| Nav labels | 12px Jakarta, 700 active / 600 inactive, Title Case |

---

## 3. Token migration

`src/app/globals.css` keeps **every class name and CSS variable name**. Only values
change, so no component markup is touched for colour.

| Variable | Current | New | Source in artefact |
|---|---|---|---|
| `--shell` | `#152420` | `#0C1211` | `--sv-ground` |
| `--surface` | `#1C2E29` | `#151F1D` | `--sv-surface` |
| `--surface-low` | `#101C1A` | `#101A18` | `--sv-inset` |
| `--sprite-well` | `#0E1D19` | `#101A18` | `--sv-inset` (same value; wells sit on inset) |
| `--line` | `#2C463E` | `#2E4642` | `--sv-edge` |
| `--bevel` | `#CFC49B` | `#C9C1A8` | `--sv-line` |
| `--fg` | `#F5F0DF` | `#F3EEDD` | `--sv-text` |
| `--fg-soft` | `#D9DFC6` | `#C9C1A8` | `--sv-line` (closest light text; see D-2) |
| `--fg-muted` | `#A6C0B2` | `#A9B8B2` | `--sv-muted` |
| `--fg-faint` | `#7A9187` | `#7A9187` | keep — see D-2; `#4B5A56` is **not** text |
| `--mint` | `#5FD3AC` | `#6FD0AE` | `--sv-mint` |
| `--mint-tint` | `#14302A` | `#0C3B35` | `--sv-forest` |
| `--coral` | `#F2735A` | `#F2735A` | `--sv-coral` (unchanged) |
| `--coral-text` | `#FF9E86` | `#FF9C86` | `--sv-coral-text` |
| `--coral-tint` | `#2A1B18` | `#2A1B18` | `--sv-warn-fill` (unchanged) |
| `--bevel-shadow` | `#35544A` | `#2E4642` | `--sv-edge` |
| `--bevel-soft` | `#4B5A56` | `#4B5A56` | `--sv-off` (unchanged) |
| `--gold` (glow) | `#E8C14A` | `#E8C14A` | keep; the gilt map is `#FEE761` (art bible), a glow colour, not a border |
| `--nav-h` | `84px` | `84px` | `--sv-nav-h` (unchanged) |
| `--gut` | `22px` | `22px` | `--sv-gutter` (unchanged) |
| `--surface-hi` | `#274438` | keep | no counterpart; see D-1 |
| `--butter`, `--butter-text`, `--butter-tint` | — | keep | no yellow in the handoff; see D-1 |
| `--entry`, `--bronze`, `--silver`, `--gold` (brackets) | — | keep | see D-3 |

New tokens the artefact has and the app lacks, added additively:

| New variable | Value | Use |
|---|---|---|
| `--track` | `#243532` | progress-bar trough (`--sv-track`) |
| `--cream` | `#F6EFD9` | lightest surface text (`--sv-cream`) |
| `--ember` | `#FF6A4D` | warmest accent (`--sv-ember`) |
| `--coral-edge` | `#A8452F` | coral button bevel (`--sv-coral-edge`) |
| `--off` | `#4B5A56` | disabled outlines and locked-item silhouettes only (`--sv-off`; same value as the existing `--bevel-soft`, kept as the artefact's own name) |

**Motion tokens.** The app currently defines none of these names, so adding them is purely
additive — verified, not assumed. They are the art bible's values, restated as CSS
variables so screens reference them rather than re-typing curves:

`--ease: cubic-bezier(0.2,0.8,0.2,1)`, `--t-press: 80ms`, `--t-enter: 180ms`,
`--t-fill: 700ms`, `--t-pop: 900ms`.

**One new utility: `.chip`.** The artefact draws a line the app does not: 88 bordered
elements are square and carry `box-shadow: 0 3px 0 #2E4642` (panels, i.e. `.vpx`), while 11
carry `border-radius: 6px` and are 44px icon buttons or 24px chips (controls). So corner
radius is **not** added to `.vpx` — `.vpx` is shared by panels and buttons, and rounding it
would drag Home's mission panels with it. A small `.chip` utility (2px border, 6px radius)
carries the rounded controls, and `.vpx`/`.vpx-soft` keep square corners.

**Contrast, measured across the whole swap.** Every text token passes WCAG AA (≥4.5:1) on
all three surfaces under the new values — worst case `--fg-faint` at 5.00:1 on `--surface`:

| token | on ground | on surface | on inset |
|---|---|---|---|
| `--fg` `#F3EEDD` | 16.29:1 | 14.52:1 | 15.29:1 |
| `--fg-soft` `#C9C1A8` | 10.52:1 | 9.37:1 | 9.87:1 |
| `--fg-muted` `#A9B8B2` | 9.17:1 | 8.18:1 | 8.61:1 |
| `--fg-faint` `#7A9187` | 5.61:1 | 5.00:1 | 5.26:1 |
| `--cream` `#F6EFD9` | 16.45:1 | 14.67:1 | 15.44:1 |
| `--mint` `#6FD0AE` | 10.19:1 | 9.08:1 | 9.56:1 |
| `--coral-text` `#FF9C86` | 9.32:1 | 8.31:1 | 8.75:1 |

### Deliberate deviations

- **D-1 — no yellow, no `surface-hi`.** The handoff has no yellow and no hi-surface
  token. `--butter*` and `--surface-hi` keep their current values. Inventing a value
  would misrepresent the artefact.
- **D-2 — `--fg-soft` / `--fg-faint`.** The artefact defines only three text steps
  (`--sv-text`, `--sv-muted`, `--sv-off`); the app has five. `--fg-soft` maps to `--sv-line`
  `#C9C1A8`. `--fg-faint` **keeps its current `#7A9187`**, because the artefact's own
  `#4B5A56` is labelled in its legend as *"Disabled outline"* and measures 2.32:1 on
  `--surface` — a WCAG failure for caption text. `#4B5A56` is added as its own `--off`
  token for disabled outlines instead. Measured, not assumed: `#7A9187` = 5.00:1 on
  `--surface`, handoff `--sv-muted` = 8.18:1.
- **D-3 — bracket accent colours.** The artefact does not define Entry/Bronze/Silver/Gold
  accents consistently (only Bronze `#D9A066` appears). The app's four bracket colours
  stay. Revisit only if the artefact is found to carry a bracket legend.
- **D-4 — no corner radius on panels.** The artefact rounds only its controls (6px, 11
  uses) and draws all 88 bordered panels square with a 3px bevel shadow. `.vpx`/`.vpx-soft`
  therefore stay square and a new `.chip` carries the rounded controls, rather than
  diverging on panels or rounding everything.
- **D-5 — nav labels are Title Case.** The artefact's nav labels are 12px Title Case at
  700/600 weight, and its Home figcaption records that "10px was below the product
  minimum" — so the app's current `text-[9px] uppercase` sits below the artefact's own
  stated floor. Labels adopt the artefact's treatment. This is a nav label, not a header,
  so the art bible's uppercase-headers rule is not in conflict.

---

## 4. Nav

Five tabs, in the artefact's order and with its labels: **Home, Battle, Missions, Ranks,
Profile**. Routes are **not** renamed: Home stays `/`, Ranks stays `/leaderboard` (the
artefact's `/home` and `/ranks` are hrefs inside a static document; renaming would touch the
live deployment, card links and OG images for no user-visible gain).

`BottomTabBar` is replaced by `PixelNav`. Its icons are **not** UI glyphs and must not be
added to `assets/glyphs.json`:

- `assets/manifest.json` records `nav.*` as **16×16 Tiny Dungeon tiles** (Kenney, CC0),
  wall-chroma-keyed, content-centred, snapped to product hues by a declared map, with the
  active tab tinting warm reds → `#6FD0AE`. Built by `scripts/nav-swap.mjs`.
- The artefact renders them `width=24 height=24 viewBox="0 0 16 16"` with
  `image-rendering: pixelated`; the shipped comment says the 16→24 render lands on exact
  device pixels at DPR 2/3, which is the phone target.
- `Glyphs.tsx`'s "chrome glyphs are 24×24" rule governs **action glyphs**, not nav icons.
  This was misread during brainstorming and is corrected here.

Measured from the in-screen tab bar (the styles are inline on each anchor, which is why an
earlier extraction missed them):

| Property | Artefact (all 10 nav bars) | App today |
|---|---|---|
| Container | `height: 84px; padding: 8px 12px 20px; border-top: 2px solid #C9C1A8; background: #0C1211` | same height, but `bg-surface` + `border-line` (dark) and no top/bottom padding split |
| Label | 12px, 700 active / 600 inactive, Title Case | `text-[9px] uppercase` |
| Active colour | `#6FD0AE` (mint) | `text-mint` (already matches) |
| Inactive colour | `#A9B8B2` | `text-fg-muted` (already matches) |

Two chrome corrections follow from that table. `PixelNav` takes the container's
`background: #0C1211` (ground, not surface) and its `padding: 8px 12px 20px` (the bottom
pad sits above the safe-area inset). And the top border becomes `border-bevel`
(`#C9C1A8`, light) — the app currently uses `border-line` (dark), so the artefact draws a
bright rule between content and nav where the app draws a faint one. Verified on all ten
nav bars in the artefact, not one.

The tile pack lives in `assets-raw/`, which is **gitignored**, so today the only copy of
the five nav icons is inside the artefact. The foundation therefore **extracts the five
SVGs verbatim from `Savborne-handoff.html` into a tracked `assets/nav-icons.json`** (same
pattern as `pixelarticons-vendor.mjs`), with a small verifier that re-extracts and fails
on drift, so path data is never hand-transcribed.

**Vault access** (the artefact predates the vault): the `/vault` route stays. Removing the
tab does **not** orphan it, which was checked rather than assumed — `VaultGuard` already
routes any player with no vault to `/vault`, and Profile's "Show tour again" already pushes
`/vault`. This batch adds the one missing entry point: **the Home savings card becomes a
link to `/vault`**. A Settings row follows in the Economy batch.

**`data-tour` anchors** must survive the swap. `PixelNav`'s Home item keeps
`data-tour="home"`; the `vault`/`shields`/`deposit` anchors live on the vault screen and are
untouched.

---

## 5. Shared primitives

Four components are the vocabulary every later screen needs. **Only `PixelNav` ships in
this batch**, because it has a consumer here (the nav). The other three are specified here
so the later batches agree on them, but each is extracted in the batch that first renders
it — building a `ResultPanel` with no screen to show would be speculative.

| Component | Purpose | Ships |
|---|---|---|
| `PixelNav` | Five-tab nav: 16×16 tile icons at 24px, active = mint, `aria-current="page"`, `data-tour` anchors preserved | **This batch** |
| `ScreenShell` | The artefact's standard frame: header row (36px), body padding `20px 22px 0`, `gap:16px`, scroll region, bottom nav space reserved | Onboarding batch |
| `SectionCard` | A hard-framed panel: `.vpx`, optional heading (Silkscreen or Jakarta 700 per the type rule), optional caption | Onboarding batch |
| `ResultPanel` | End-of-flow summary: large headline, XP/rating tiles, item unlock list, two actions | Onboarding batch (First Check-in) |

Existing `.vpx`, `.vpx-soft` and `.num` are kept as-is; `SectionCard` composes them.

---

## 6. Screen batches (roadmap, not this batch)

Each batch is its own spec → plan → implementation, and each ships independently.

| Batch | Screens |
|---|---|
| **Foundation (this)** | tokens, motion tokens, `.chip`, nav (5 tabs), `PixelNav`, tracked nav icons, Home savings card → `/vault` |
| Onboarding | Welcome, Connect, Privacy, Name, First Check-in, Gate, Preparing, Update Pay |
| Economy | Profile, Items, Item Sheet, Missions, Bracket Climb, Withdrawal, Settings |
| Battle | Battle Menu, Ranked-Locked, Daily Limit, Queue, Queue Timeout, Friend Wait, Battle, In-Battle Wait, Win/Loss/Tie, Conn Lost |
| Home | Home, HomeDone |

---

## 7. Verification

For the foundation batch:

1. `npx tsc --noEmit`, `npm run lint`, `npx next build`, `npm test` — all green.
2. Art gates that actually cover this change: `structure-check.mjs` (tag balance after
   the nav markup change), `type-audit.mjs` (the type rule still holds), and the new
   nav-icon drift verifier. `art-gates.mjs` audits the artefact's own pixels and does not
   cover `src/`, so it is **not** a gate here — that assumption was corrected during
   self-review.
3. **Render and show before/after.** Foundation: a 390×844 screenshot of Home with the new
   palette and nav, shown for sign-off before the batch is called done. Also render at
   360px width to confirm the 12px Title Case labels do not wrap.
4. The phone remains the final measure.

Per screen (each later batch): the same gates, plus a before/after render of that screen.

---

## 8. Risks

- **`--fg-soft` and `--bevel` share a value** (`#C9C1A8`): a frame and a text run render the
  same colour. `--fg-soft` is live text in five places (`text-fg-soft`), so this is a real
  pairing on real screens, not a hypothetical. It is what the artefact does and the contrast
  is fine (light on dark) — the risk is purely that the frame and the text lose their
  distinction. Change `--fg-soft` alone if it reads badly; no markup depends on the value.
- **Nav labels change size and case** (9px uppercase → 12px Title Case). Labels are wider
  in Title Case, so the 5-tab strip must be checked for wrapping at 360px width — the
  narrowest phone target — before the batch is called done.
- **Nav icons are the only art in the port that depends on a gitignored source**, which is
  why extraction to a tracked asset is in scope rather than deferred.
- **The `data-tour` contract is stringly-typed.** `VaultTour` anchors are selectors like
  `[data-tour="home"]`; if `PixelNav` drops the attribute the tour silently centres its card
  instead of spotlighting. Covered by keeping the attribute and by the render check.
- Everything else is a value change with the class vocabulary unchanged, which is why the
  blast radius is small.

**Resolved during spec review (no longer open):** `--fg-faint` does *not* take `#4B5A56`
(that value is a disabled outline at 2.32:1, not a text colour); the Vault tab's removal
does not orphan the vault (`VaultGuard` and Profile still route to it); and the app has no
motion-token names to collide with.

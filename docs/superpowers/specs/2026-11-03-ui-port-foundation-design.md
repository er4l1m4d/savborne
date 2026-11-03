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
| Nav | 5 tabs (Home, Battle, Missions, Ranks, Profile); Vault reached from Home and Settings |

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
| `--fg-faint` | `#7A9187` | `#4B5A56` | `--sv-off` (see D-2) |
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

**Motion tokens** (already in the art bible, restated as CSS variables so screens can
reference them rather than re-typing curves):

```
--ease: cubic-bezier(0.2,0.8,0.2,1)
--t-press: 80ms   --t-enter: 180ms   --t-fill: 700ms   --t-pop: 900ms
```

### Deliberate deviations

- **D-1 — no yellow, no `surface-hi`.** The handoff has no yellow and no hi-surface
  token. `--butter*` and `--surface-hi` keep their current values. Inventing a value
  would misrepresent the artefact.
- **D-2 — `--fg-soft` / `--fg-faint`.** The artefact defines only `--sv-text`,
  `--sv-muted` and `--sv-off`; the app has five text steps. Mapped to the nearest
  artefact token rather than interpolated.
- **D-3 — bracket accent colours.** The artefact does not define Entry/Bronze/Silver/Gold
  accents consistently (only Bronze `#D9A066` appears). The app's four bracket colours
  stay. Revisit only if the artefact is found to carry a bracket legend.

---

## 4. Nav

Five tabs, in artefact order and with artefact labels: **Home, Battle, Missions, Ranks,
Profile**.

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

The tile pack lives in `assets-raw/`, which is **gitignored**, so today the only copy of
the five nav icons is inside the artefact. The foundation therefore **extracts the five
SVGs verbatim from `Savborne-handoff.html` into a tracked `assets/nav-icons.json`** (same
pattern as `pixelarticons-vendor.mjs`), with a small verifier that re-extracts and fails
on drift, so path data is never hand-transcribed.

**Vault access** (the artefact predates the vault): the `/vault` route stays. It is
reached from the Home savings card and from a Settings row. Tab order and labels otherwise
match the artefact exactly.

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
| **Foundation (this)** | tokens, nav (5 tabs), `PixelNav`, tracked nav icons |
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
   palette and nav, shown for sign-off before the batch is called done.
4. The phone remains the final measure.

Per screen (each later batch): the same gates, plus a before/after render of that screen.

---

## 8. Risks

- **`--fg-faint` becomes much darker** (`#7A9187` → `#4B5A56`). It is used for captions on
  `--surface`; contrast must be re-checked before shipping, not assumed. If it fails the
  app's own contrast bar, it keeps a lighter value and the deviation is recorded.
- **Two hexes are near-identical** (`--bevel` `#C9C1A8` vs `--fg-soft` mapped to the same
  value); a frame and a text run will share a colour. This is what the artefact does, but
  it is worth watching on the first screen that shows both.
- **Nav icons are the only art in the port that depends on a gitignored source**, which is
  why extraction to a tracked asset is in scope rather than deferred.
- Everything else is a value change with the class vocabulary unchanged, which is why the
  blast radius is small.

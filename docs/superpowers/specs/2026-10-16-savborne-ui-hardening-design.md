# Savborne UI Hardening — Design Spec

**Status:** Draft for user review
**Date:** 2026-10-16
**Scope:** Accessibility & compliance hardening of `Savborne-handoff.html`, then migration of the Next.js app to the fortified design, then construction of all 30 handoff screens in phases. Precedes Phase 4 (battle engine).

---

## 1. Decision record (agreed in brainstorming)

| # | Question | Decision |
|---|----------|----------|
| D1 | Target | Both: fix the handoff in place first, then use it as the spec to restyle `src/` |
| D2 | Review lens | Accessibility + compliance only. Not a taste/style redo; not a motion redo |
| D3 | App vs handoff | Diverged — restyle the app to the handoff |
| D4 | Direction | "Direction A · Forest Night" locked in spirit; spacing/type/motion details open to challenge where an a11y/compliance finding justifies it |
| D5 | Styling stack | Keep Tailwind v4. The handoff's `--sv-*` tokens become the single source of truth, mapped through `@theme`. Pixel primitives (`.px`/`.pxw`) stay plain CSS. Handoff's "no UI library" rule is amended to this |
| D6 | Behavior | Wiring frozen. Any route/flow change requires per-item sign-off before code |
| D7 | Missing screens | Build all 30, phased, core loop first |
| D8 | Verification | Programmatic checks + live browser inspection at 390px |
| D9 | Token truth | Handoff palette (`--sv-*`) is the base; app-only colors (bracket metals, butter) are merged into the handoff only where a screen demonstrably needs them, documented as new tokens |
| D10 | A11y bar | WCAG 2.2 AA, plus the handoff's own stricter house rules (44px targets, mint focus ring) |
| D11 | Sequencing | This program completes before Phase 4 battle-engine work starts |
| D12 | Icons | A free CC0 pixel-art icon set (Kenney — e.g. *16×16 Game Assets* / *RPG Icons*), duotoned onto `--sv-*` tokens so it reads as one family. Replaces both the app's emoji and the handoff's line-icon nav SVGs |

Standing workflow also applies: phase-by-phase execution, each phase ends with an Added/Changed/Removed/Improved report and waits for explicit "go ahead".

## 2. Source-of-truth hierarchy

1. `Savborne-handoff.html` (after Stage 1 fortification) — design truth
2. Code in `src/` — implementation truth for behavior/data (frozen per D6)
3. `docs/Savborne Type & Colour Specimen.html`, `docs/Savborne UI Direction.html`, `docs/Savborne-spec.md` — historical inputs; where they conflict with the fortified handoff, the handoff wins. They are NOT edited in this program.

Game rules (XP, brackets, Elo, battle mechanics) come from the handoff's Data & rules section and are unchanged.

## 3. WCAG 2.2 AA criteria in force

1.1.1, 1.3.1, 1.4.1 (Use of Color), 1.4.3 (AA contrast), 1.4.4 (resize 200%), 1.4.10 (reflow at 320px), 1.4.11 (non-text contrast 3:1), 2.1.1, 2.1.2, 2.2.1, 2.2.2, **2.2.7 Focus Not Observed (min)**, **2.2.8 Target Size (Min) 24px**, 2.4.1, 2.4.2, 2.4.3, 2.4.6, 2.4.7, 2.5.3, 3.1.1, 3.1.2, 3.2.2, 3.3.1, 3.3.2, 3.3.3, 4.1.2.
House rules on top: tap targets ≥ 44px, focus ring mint 2px/offset 2px never removed, body text never below 12px (10px allowed only for streak chip + cooldown note), every icon-only control has `aria-label`, win/loss carries text + icon not just color.

## 4. Stage 1 — Audit and fortify `Savborne-handoff.html`

Method: five sequential passes over the document. Every finding is recorded in `docs/UI-AUDIT.md` (new file; table per finding: ID, location/line, criterion, severity Blocker/Major/Minor, fix, status). Fixes are applied **directly in the HTML** (both the demo markup and the copyable spec blocks — code blocks are what builders will paste, so they must be correct too).

### Pass A — Token & contrast math
Recompute all contrast pairs the doc claims (text/ground, muted/surface, mint/surface, ground/coral, ground/mint, coral-text/warn-fill) plus pairs it does not claim: `muted` on `ground` (nav labels, figcaption body), `mint` on `ground` (links, active nav), `coral-text` on `surface`, `off` outline on `inset` (3:1 UI minimum), `line` outline on `surface`, bar fills vs their tracks, chip fill text. Any AA miss → adjust the token value in the palette section AND in every screen recreation that hardcodes the hex. Bracket-metal colors merged from the app (`--sv-entry/bronze/silver/gold`, D9) must pass 3:1 as badge outlines or carry a text label.

### Pass B — Components vs states
Verify each component CSS actually implements what the prose promises:
- Focus styles are **specified in prose but absent from the Component CSS block** — add `.sv-btn__face:focus-visible`, nav, chips, switch, icon-btn focus rules (mint 2px, offset 2px, `outline`, never `outline:none` without replacement).
- Pressed state uses `:has(:disabled)` — verify disabled buttons still show correct off-tone rendering; document behavior on touch devices where `:active` sticks.
- `.sv-check` is 24px — legal only if the whole 58px row is the tap target; make that explicit in the spec text.
- `.sv-switch` lacks `role="switch"` guidance; add.
- Disabled "Checked in today" button: state is conveyed by color + label; confirm the label alone is sufficient (it is — keep, note it).

### Pass C — Semantics & structure (all 30 screens)
- Bottom nav items are rendered as `<button aria-current="page">` in every screen — must be `<a href>` with `aria-current`; fix in screens and in the `.sv-nav a` CSS/demo.
- Icon-only buttons (back, leave) — verify `aria-label` presence in each screen.
- Sprites/badges are decorative or `role="img"` — audit each; fix mislabeled ones. **Found: both sprites use the same mint shirt (`#6FD0AE`); you-vs-opponent is not encoded on the sprites at all on Win/Loss/Tie screens** — give the opponent a coral-accent sprite or add "YOU"/"FOE" pixel nameplates, and update aria-labels accordingly.
- Landmarks: every screen needs `header`/`main`/`nav` structure guidance; the AppShell CSS should show it, not just `.app` divs.
- Form fields (`/name` input): label association, `error` announcement (`aria-describedby`, `aria-invalid`), autocomplete off; error banner gets `role="status"`/`aria-live` guidance.
- Live regions: balance updates, XP gains, battle turn results, queue timer — spec where `aria-live="polite"` belongs. The doc currently says nothing; add a short "Announcements" subsection under Accessibility.
- Heading order per screen: each screen recreation should use one `<h1>`; several screens currently render headings as styled `<span>`/`<div>` — fix at least the canonical examples (Welcome, Home, Results).

### Pass D — Color-alone & non-text contrast
- HP bars mint-vs-coral at 10px with `border:0` — fails 1.4.11 as the only "you/foe" signal and is invisible against dark track at some distances; fix: 2px `line` border or texture steps + text HP numbers (screens already show numbers — verify on all battle screens).
- "3 step bars (mint = done)" on `/connect` — add current-step semantics (`aria-current="step"`, text "Step 2 of 3" — verify present).
- Ranked-locked requirement bars, XP bars, delta chip `+0.15` (green=up?) — every semantic color pair needs text/shape redundancy; audit each screen and fix markup or add notes.
- Win/Loss/Tie: banners carry text (good); verify the coral/mint tiles ("Battle win"/"loss") always pair color with the word, not icon-only.

### Pass E — Motion, platform, and self-consistency
- `@keyframes sv-dots` animates `content` — works only in Chromium; **silently dead in Safari/Firefox** (Nimiq Pay webviews are iOS/Android browsers). Replace with a 3-frame width/overflow or JS-free background-position technique; keep steps() feel.
- Reduced-motion block: `.sv-pop{animation:none;opacity:1}` leaves the reward text frozen mid-screen (it never fades) — acceptable; but the global `animation-duration:1ms!important` rule also kills the *demo* `sv-dots` content swap; verify each of the 13 animations has a coherent static end state. `damage`'s brightness flash and `level-up` confetti must confirm genuinely skipped, not 1ms-blazing.
- Doc's own `<meta viewport>` lacks `viewport-fit=cover` while its Layout section mandates it — fix the head (demo credibility).
- Font loading guidance: add "use `next/font` (self-hosted woff2, fallback metrics config)" to the Tokens section since the app is Next.js — prevents the layout-shift/FOIT class of compliance issues.
- 10px exceptions and `Silkscreen` legibility: keep, but require `letter-spacing` tuning check.
- Confirm 1.4.10 reflow: handoff says fluid 360–430 and "centered 430px column on desktop"; WCAG requires no horizontal scroll at 320px CSS px — add 320px as the tested floor in the Layout table.

**Iconography amendment (D12):** add an "Iconography" subsection to the handoff: source = Kenney CC0 pack (attribution not required under CC0; still record pack + URL + license in `README` credits), pixel grid 12×12 displayed at 24×24 (`image-rendering: pixelated`), duotone mapped to `--sv-muted` (off) / `--sv-mint` (active) / `--sv-text`; tab set: Home, Missions, Battle, Ranks, Profile. Replace the five line-icon SVGs in the screen recreations and in `.sv-nav` examples.

**Deliverables of Stage 1:** fortified `Savborne-handoff.html`, `docs/UI-AUDIT.md` with all findings closed or explicitly waived (waives need a reason), updated token code blocks (incl. merged bracket metals if needed).

## 5. Stage 2 — App foundation (`src/`)

- `src/app/globals.css`: replace current token block with `--sv-*` set (post-audit values). Keep Tailwind `@theme inline` mapping — every token gets a `--color-sv-*` entry; old app-only tokens removed or merged per D9. `.vpx`/`.vpx-soft` replaced by the handoff primitives: `.pxw`/`.px` + the audited component CSS classes (`.sv-btn*`, `.sv-chip*`, `.sv-bar*`, `.sv-row`, `.sv-tile`, `.sv-icon-btn`, `.sv-nav`, `.sv-banner`, `.sv-switch`) imported from a new `src/styles/pixel-ui.css` (or kept in globals.css — decide at execution; default: `src/app/pixel-ui.css` imported by layout).
- Fonts: `next/font/google` for Plus Jakarta Sans (500/600/700/800) + Silkscreen (400/700) with `adjustFontFallback`, CSS vars `--font-jakarta`, `--font-silkscreen` wired into `--sv-font-ui/--sv-font-pixel`.
- New primitives in `src/components/ui/`: `PixelPanel.tsx`, `Button.tsx`, `Chip.tsx`, `Bar.tsx` (XP/HP variants), `Row.tsx`, `StatTile.tsx`, `Banner.tsx`, `Switch.tsx`, `BottomNav.tsx` — direct ports of the (fixed) handoff React code, one component per file, props matching the handoff's state matrix exactly.
- Icon component `src/components/ui/Icon.tsx` + `src/app/pixel-icons/` static SVGs extracted from the chosen CC0 pack, recolored to tokens.
- Focus-visible global rule; `prefers-reduced-motion` media block ported verbatim from the fortified handoff.
- AppShell: `max-width:430px` centered column, `100dvh`, safe-area padding per Layout section; header/nav fixed, content scroll only.
- Verification: contrast script `node scripts/a11y-contrast.mjs` (new, dependency-free) checks the rendered token table; must exit 0.

No page-level behavior changes in this stage; the app must still run and pass existing API flows.

## 6. Stage 3 — Shell + existing screens restyle

Order (each = one reportable sub-phase): `BottomTabBar` → `(tabs)/layout` → Home (`(tabs)/page.tsx`) → Missions → Battle menu → Profile → Leaderboard→Ranks styling → Setup page decomposition start (see Stage 4). Emoji icons replaced by Icon component. Existing Tailwind color classes swapped to `sv-*` theme colors. Screens must visually match handoff recreations; verified in browser at 390×844 via Browser agent screenshots after each sub-phase.

## 7. Stage 4 — Missing screens, phased build

Route map (handoff → app). Routes marked ⚑ are *new* routes; the Leaderboard vs `/ranks` naming mismatch is a flow change → **needs sign-off item #1 before code** (proposal: keep `/leaderboard` URL, style as Ranks; nav label "Ranks").

- Wave 1 (core loop states): Home checked-in state, Balance dropped `/withdrawal` ⚑, Couldn't read balance `/balance-error` ⚑, Connection lost overlay ⚑, Settings `/settings` ⚑
- Wave 2 (onboarding sequence): `/welcome` ⚑, `/connect` ⚑, `/privacy` ⚑, `/name` ⚑, `/first-checkin` ⚑ — replaces today's single `/setup` page (kept redirecting to `/welcome`; sign-off item #2)
- Wave 3 (progress): `/items` ⚑, `/bracket-climb` ⚑
- Wave 4 (battle UI, still Phase-3-safe: UI shells calling only existing APIs): ranked locked, queue + timeout, friend challenge, battle arena `/battle/:id` restyle, waiting state, item sheet ⚑, results win/loss/tie ⚑. Daily limit state.

Data needs discovered while building (e.g. consent timestamp storage, withdrawal detection) are logged as sign-off items, not implemented silently.

## 8. Stage 5 — Verification gate

1. `scripts/a11y-contrast.mjs` green on final tokens.
2. Keyboard-only pass through every screen in a live dev server (tab order, visible focus, no traps, nav reachable).
3. Browser-agent screenshot comparison vs handoff recreations on these 12 screens at 390px: Welcome, Connect, Privacy, Name, Home, Home · checked in, Missions, Battle menu, Battle arena, Result · win, Result · loss, Ranks.
4. axe DevTools (free browser extension run by user, or axe-core via a one-off injected script) on the same 12 screens — 0 critical/serious.
5. Reduced-motion OS-level toggle check of all animation states.
6. 200% zoom + 320px width reflow check.
7. Color-blind simulation check (browser DevTools emulators) on battle screens — mint/coral pairs must remain distinguishable via redundancy added in Stage 1.
8. Findings → logged to `docs/UI-AUDIT.md` / `ERRORS.md` per the standing workflow.

## 9. Out of scope

- Final item art and character sprite (placeholders stay; placeholders themselves are made compliant)
- Taste/motion redesign beyond what AA + self-consistency requires
- Phase 4 battle engine logic, matchmaking backend, Nimiq Pay SDK integration changes
- Editing the historical docs (specimen/UI direction/spec md)
- Tablet/landscape layouts (handoff says portrait-only — honored)

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Stage 1 changes hex values → visual drift mid-program | All token edits happen once, in Stage 1, before any app restyle |
| Kenney packs are broad; a perfect 12×12 dark-fantasy set may not exist | Pick at Stage 2 start from CC0 candidates; fallback is hand-drawn pixel SVGs in-house (still free) |
| Handoff recreations are static HTML; "match in browser" can diverge | Screenshot diff loop per sub-phase, not one big-bang at the end |
| New routes (⚑) touch the frozen-behavior rule | They are additive pages; the only existing-behavior touchpoints (setup redirect, leaderboard rename) are pre-declared sign-off items |

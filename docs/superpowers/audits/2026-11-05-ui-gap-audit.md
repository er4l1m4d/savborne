# Savborne — UI gap audit: current app vs `Savborne-handoff.html`

**Date:** 2026-11-05
**Status:** audit for review — no code changed
**Artefact of record:** `Savborne-handoff.html` (32 screens)
**Scope:** every current route and shared component, plus the delete-account flow
**Method:** read the handoff's screen notes, tokens, component CSS and inline markup; read every current page/component; compare structure, type, colour, spacing, states and copy. No pixel-diff tool was run.

---

## 0. Verdict

The app has the handoff's **palette and bottom nav**, but it does not have the handoff's **screens**.

- **Foundation is real.** `src/app/globals.css` carries the handoff's exact `--sv-*` values under the app's token names, and `PixelNav` matches the handoff's five tabs, labels, active colours, 84px height, 8/12/20 padding, light top border and multi-colour icons.
- **The screens are not ported.** Every page hand-rolls its own `<main>`, header, panels and buttons. There is no `ScreenShell`, `PixelPanel`, `Button`, `Chip`, `Row`, `Tabs`, `BottomSheet`, `Banner` or `ResultPanel`.
- **The primary CTA colour is inverted.** The handoff's primary button is coral `#F2735A` with ground text; the app's primary actions are mint `#6FD0AE` (Home check-in, setup, vault deposit, battle AI).
- **Type is below the handoff's own floor.** The handoff says 12px minimum (10px only for battle state labels). The app has **57 uses of 10px/11px text**.
- **Most of the handoff's screens do not exist as routes.** Items, Bracket Climb, Withdrawal, Settings, First Check-in, Home checked-in, Ranked Locked, Queue Timeout, Connection Lost and the Result screens are missing or inlined into another page.
- **The delete-account flow is inline at the bottom of Profile.** The handoff has no delete-account screen; the closest pattern is Settings' destructive row. The current flow does not use the handoff's screen structure, grouped rows, header, step bars or sheet pattern.

**Summary:** this is a functionally complete app wearing the handoff's palette. Closing the gap is a screen-port programme, not a restyle of one component.

---

## 1. What already matches

| Area | Status | Evidence |
|---|---|---|
| Colour tokens | **Matches** | `globals.css` uses the handoff values: ground `#0C1211`, surface `#151F1D`, inset `#101A18`, line `#C9C1A8`, edge `#2E4642`, text `#F3EEDD`, muted `#A9B8B2`, mint `#6FD0AE`, coral `#F2735A`, coral-text `#FF9C86`, warn-fill `#2A1B18`, track `#243532` |
| Bottom nav | **Matches** | `PixelNav`: five tabs, Title Case 12px, 700 active / 600 inactive, mint active, 84px height, `8px 12px 20px`, light top border, safe-area inset, `aria-current` |
| Nav icons | **Matches** | Extracted verbatim from the handoff, both states, multi-colour; only Home changes on active |
| Gutter | **Matches** | 22px |
| Badge art | **Present** | `BadgeArt` renders earned/locked states |
| Action glyphs | **Present** | `Glyphs.tsx` supplies attack/defend/special/use-item |
| Some copy intent | **Good** | Vault security copy is careful and specific; do not discard it wholesale |

---

## 2. Cross-cutting gaps (these affect every screen)

### 2.1 Shared primitives are missing — P0

The handoff's screens are built from a small vocabulary. The app has none of it as components.

| Handoff primitive | App today | Consequence |
|---|---|---|
| `ScreenShell` — 36px header row (tab screens) or 44px back + title (pushed screens), body `20px 22px 0`, gap 14–16px | Each page writes its own `<main className="p-(--gut) ...">` | Headers, back buttons, spacing and scroll regions drift per screen |
| `PixelPanel` — `.pxw` + `.px`, outline + hard shadow + stepped corners | `.vpx` / `.vpx-soft` on ad-hoc divs | Panels look similar but not the same; no tone system |
| `Button` — primary 64px coral, secondary 56px surface, disabled off | Ad-hoc `<button>` with `py-3`/`py-4`, mint or coral | No consistent height, colour, pressed or disabled behaviour |
| `Chip` — 24px, 6px radius, 2px border | `vpx-soft` spans at 32px | Chips read as small panels, not chips |
| `Tabs` — two 44px buttons, selected mint fill + ground text | Card-like `BoardTab` / no tabs on Missions | Tabs do not read as tabs |
| `Row` — 58px (rank 56px), 2px `#243532` divider | Separate panels with gaps | Grouped settings/mission/rank rows are impossible |
| `BottomSheet` — surface, top outline, 22px gutter, scrim, 180ms | Inline expanding boxes | Item picker and confirmations cannot match |
| `Banner` — warn-fill + coral outline + coral-text | Ad-hoc `vpx bg-coral-tint` | Error/info states differ per page |
| `ResultPanel` — headline, XP/rating tiles, unlocks, actions | Simple completed panel | Battle results are not the designed screen |

**This is the root cause of most screen-level gaps.** Building screens before these primitives will repeat the drift.

### 2.2 Panel geometry — P0 if "closely" means visually faithful

- Handoff: `.pxw` = four stacked `drop-shadow` outlines + `0 4px 0` hard shadow; `.px` = `clip-path` with 3px stepped corners.
- App: `.vpx` = `border: 2px solid` + `box-shadow: 0 3px 0`, square corners.
- The foundation spec deliberately chose square panels (D-4). That was a defensible simplification, but it is visible on every card. If the target is close visual fidelity, this must be revisited.

### 2.3 Primary CTA colour — P0

| Element | Handoff | App |
|---|---|---|
| Welcome "Get started" | coral `#F2735A`, ground text, 64px | mint, `py-3`, ~48px |
| Home "Check in now" | coral, 64px | mint, `py-4`, ~56px |
| Battle menu Ranked card | coral fill | mint AI card / butter friend card / coral ranked button |
| Vault deposit | no handoff screen | mint |
| Destructive Settings row | warn-fill `#2A1B18`, coral-text, 56px | delete confirm is solid coral |

**Mint is the handoff's success/progress/you colour, not its primary CTA colour.** This single inversion changes the feel of every screen.

### 2.4 Type scale — P0

Handoff rules:

- Display: Silkscreen 400, 44 / normal (`You win!`)
- Heading: Silkscreen 400, 28–36
- Sub-heading: Jakarta 800, 20–32
- Body: Jakarta 500, 16 / 1.5
- Label: Jakarta 700, 13–15
- Number XL: Silkscreen 400, 36
- Number M: Silkscreen 400, 24
- Figure/chip: Jakarta 700, 12–14, tabular
- **Minimum 12px**, except 10px battle state labels

App today:

- Body is 15px, not 16/1.5.
- Section labels are frequently 10–11px uppercase tracked (`text-[10px] uppercase tracking-widest`).
- 57 uses of 10px/11px across pages and components.
- Home balance is Jakarta `text-3xl font-bold`, not Silkscreen 36.
- Headings are `text-3xl` (30px) on most pages, not the handoff's 28px header row.
- Many labels use uppercase tracking where the handoff uses sentence-case 13–15px labels.

### 2.5 Screen shell — P0

Handoff tab screens (Home, Profile, Missions, Battle, Ranks):

```
padding: 20px 22px 0
gap: 16px (14px on Missions)
header row: 36px
```

Handoff pushed screens (Settings, Items, Bracket Climb):

```
header row: 44px, back button 44×44 + Silkscreen 28px title
same 20px 22px 0 body
```

App today:

- No standard header row; each page has `mt-4` and its own title size.
- No back button on pushed routes (`/vault`, `/receipts`, `/battle/[id]`, `/setup/vault`).
- Gaps are `gap-4`/`gap-5` inconsistently.
- No `ScreenShell` means the top padding and header height differ per screen.

### 2.6 Focus and touch targets — P0 accessibility

- Handoff: focus-visible = 2px mint outline, 2px offset, never removed.
- App: no global focus-visible rule; inputs use `outline-none focus:border-butter`, which removes the outline and substitutes a border. Buttons rely on browser defaults.
- Handoff minimum touch target 44px. The app has many text links and small buttons below that, plus 10px labels.

### 2.7 Art and iconography — P1

- Handoff: pixel sprites for characters, items, arena, badges; pixel action icons.
- App: `Glyphs` and `BadgeArt` exist, but Home/Profile have no character sprite, Battle has no arena sprites, and several places use emoji/text symbols (`🔥`, `◈`, `⟡`, `✓`, `·`, `>`).
- The handoff's Home header is icon + pixel wordmark; the app uses the player's display name as the h1.

### 2.8 Motion — P1

Tokens exist (`--ease`, `--t-press`, `--t-enter`, `--t-fill`, `--t-pop`) with a reduced-motion guard, but almost nothing uses them.

Handoff specifies: balance-read count-up, streak-tick, xp-pop, bracket-unlock, level-up, turn-reveal, damage, error-shake, result, searching dots, sheet slide. The app has a few `transition-[width]` bars and `active:translate-y-0.5`.

### 2.9 State coverage — P1

The handoff designs default, pressed, disabled, loading, error, empty, locked, done, checked-in, waiting and result states. The app often has the happy path plus one inline error.

Concrete examples:

- Home's check-in button is only disabled while `checking`; there is no "Checked in today" disabled state.
- Missions has no Repeating/One-time tabs, no done-row muting, no 24px checkbox.
- Battle menu has no dedicated daily-limit state, no ranked-locked screen, no queue screen.
- Battle has no arena, no YOUR MOVE label, no turn-reveal/damage animation, no item sheet, no result screen.
- Ranks has no Everyone/Friends chips and no "You" tag treatment.

### 2.10 Copy — P2

The handoff's copy is shorter and more product-like ("Save for real. Level up for fun."). The app's copy is longer and spec-driven. Some of it is intentionally careful (vault, deletion). The gap is not "wrong", but it is not the handoff's voice.

---

## 3. Screen-by-screen

Status key: **Missing** = no route/screen; **Inline** = behaviour exists but not as the designed screen; **Divergent** = route exists but structure/visuals differ; **Partial** = some of the design is present; **Matches** = faithful.

| # | Handoff screen | Current route | Status | Main gaps |
|---|---|---|---|---|
| 1 | Welcome | `/setup` step 1 | Divergent | No logo/wordmark, no "Save for real. Level up for fun.", no "Built for Nimiq Pay", mint CTA not coral, no 64px CTA |
| 2 | Connect savings account | `/setup` step 2 | Divergent | App has a vault-account picker, not the 3-step explainer + can/cannot cards; no step bars 1 of 3 |
| 3 | Privacy notice | `/setup` step 4 | Partial | Copy differs; no "short version" card; no consent line directly above CTA; no notice version; no step 2 of 3 |
| 4 | Choose display name | `/setup` step 5 | Partial | 32 chars vs 16; no character preview; copy differs; no step 3 of 3 |
| 5 | First check-in | none | Missing | Celebration screen absent; awards render inline on Home |
| 6 | Home | `/` | Divergent | Header is name + "Level N", not icon/wordmark + bracket/level chips; no character card; no battle card; balance Jakarta not Silkscreen; check-in mint not coral; no checked-in state; no delta chip; no streak tick |
| 7 | Home · checked in | `/` | Missing | No disabled "Checked in today", no "Checked in just now", no delta chip, no ticked Daily Check-in row |
| 8 | Profile | `/profile` | Divergent | No character sprite, no XP bar, no settings entry, no items shortcut; inventory is an inline 8-item list instead of the Items screen; stats layout differs; delete/backup/share/help are stacked here |
| 9 | Missions | `/missions` | Divergent | No Repeating/One-time tabs; no grouped 58px rows with 24px checkbox; cap meters are separate cards; descriptions make rows taller than designed |
| 10 | Items | none | Missing | Inventory is inline in Profile |
| 11 | Bracket Climb | none | Missing | No celebration screen |
| 12 | Use item (battle sheet) | `/battle/[id]` inline | Missing | Item picker is an inline box, not a bottom sheet |
| 13 | Battle menu | `/battle` | Divergent | Order is AI/Friend/Ranked vs Ranked/Friend/AI; ranked is a small panel not a full card; no mode icons; header copy differs |
| 14 | Ranked locked | `/battle` inline | Missing | No requirement bars (Level 1 of 3, check-ins 2 of 5), no dedicated screen |
| 15 | Ranked queue | `/battle` inline | Divergent | No VS cards, no searching dots, no designed timer/range layout |
| 16 | Queue timeout | `/battle` inline | Missing | No dedicated 3-choice state |
| 17 | Friend challenge sent | `/battle` inline | Partial | Code panel only; no countdown, share action or designed screen |
| 18 | Battle | `/battle/[id]` | Divergent | No arena panel or sprites; HP bars stacked; no YOUR MOVE label; move order differs; item picker inline; no turn-reveal/damage animation |
| 19 | Waiting for opponent | `/battle/[id]` inline | Partial | Text + seconds only; no designed waiting panel/timer |
| 20 | Result · win | `/battle/[id]` inline | Partial | Simple completed panel; no arena, XP/rating tiles, unlock list, Battle again/Home CTAs |
| 21 | Result · loss | `/battle/[id]` inline | Partial | Same; no coral accent treatment |
| 22 | Result · tie | `/battle/[id]` inline | Partial | Same; no neutral cream accent treatment |
| 23 | Balance dropped | `/` inline note | Missing | No `/withdrawal` screen; no "Still yours / Removed" cards |
| 24 | Open inside Nimiq Pay gate | `VersionGate` | Partial | Generic card; no large icon panel/designed gate |
| 25 | Preparing Savborne | `VersionGate` | Partial | Plain "Preparing Savborne…" text, no designed state |
| 26 | Update Nimiq Pay | `VersionGate` | Partial | Generic card; no large icon panel, deep link, retry |
| 27 | Couldn't read balance | inline errors | Partial | No dedicated screen; no error-shake; copy differs |
| 28 | Connection lost overlay | none | Missing | No overlay; battle errors render inline |
| 29 | Daily limit reached | `/battle` footnote | Partial | No designed 0-battles state with reset countdown + Missions |
| 30 | Ranks · ranked | `/leaderboard` | Divergent | Tabs are large cards; Friends is a toggle, not an Everyone/Friends chip pair; rows are panels, not 56px grouped rows; no "You" tag |
| 31 | Ranks · unranked | `/leaderboard` | Partial | Same list, but not the handoff's right-column level treatment |
| 32 | Settings | none | Missing | No `/settings`; delete is inline in Profile |

**Delete account** is not one of the 32 handoff screens. It is an app-specific flow that needs a designed extension (see §6).

### 3.1 Setup / onboarding

Current `/setup` is a five-step wizard: Welcome → Create vault (account picker) → Backup (show/quiz/passphrase) → Privacy → Name. The handoff is Welcome → Connect → Privacy → Name → First check-in.

The vault ceremony is an intentional divergence and should stay: the app's core promise is a non-custodial vault, and the handoff predates it. The gap is that the surrounding screens do not use the handoff's shell, type, step bars, cards or CTA colour.

Specific gaps:

- No logo + wordmark on Welcome.
- No "Save for real. Level up for fun." headline.
- No "Built for Nimiq Pay" footer.
- No 3-step explainer with "Savborne can / cannot" cards (the app's vault step is an address picker).
- No 3-bar step indicator; the app uses five labelled dots at 10px.
- Name input allows 32 chars and has no character preview.
- No First Check-in celebration screen.

### 3.2 Home

The handoff Home is a **character-first** screen:

1. Header: icon + wordmark left; bracket chip + level chip right.
2. Character card: sprite well + name + "Level 7 · Silver" + XP bar + "62 XP to Level 8".
3. Savings card: "Savings account", "Last check-in yesterday", Silkscreen 36 balance, "1-week streak", coral "Check in now" 64px.
4. Daily missions list: rows with +XP.
5. Battle card: "3 battles left today" + "Choose opponent".

Current Home is a **state-first** screen:

1. Name + "Level N".
2. Chips: bracket, streak, shields, check-ins.
3. XP bar.
4. Savings balance card (Jakarta 30px).
5. Daily missions card.
6. Awards panel / error.
7. Mint "Check In" button.
8. Disclaimer.

Gaps: structure, character art, header, CTA colour, number typography, checked-in state, delta chip, streak tick, battle card, mission row treatment.

### 3.3 Profile

Handoff Profile: title + settings icon button; character card; badges grid; items shortcut; stats tiles; settings entry.

Current Profile: identity strip; stat grid; badges grid; full inventory list; share card; backup settings; help; delete account; footer.

Gaps:

- No character sprite or XP.
- No settings icon/entry.
- No items shortcut; inventory is an inline list that should be the Items screen.
- Stats tiles use `vpx` with Silkscreen 20; the handoff uses flat tiles.
- Delete account is inline here and should move to Settings.

### 3.4 Missions

Handoff: Repeating/One-time tabs; Daily and Weekly groups with header "Resets 00:00 UTC · 10 of 25 XP"; grouped rows in one panel, 58px, 24px checkbox, label, mint XP; done rows muted.

Current: no tabs; cap meters as two cards; three sections with separate panels per mission; descriptions and reset lines make rows tall; done state is a mint "✓ Done" label.

### 3.5 Battle

Handoff: menu (Ranked/Friend/AI), ranked locked, queue, timeout, friend wait, battle arena, in-battle wait, results, connection lost, daily limit.

Current: one battle menu page with inline queue, challenge code and ranked note; one battle detail page with inline item picker, waiting text and simple completed panel.

Gaps: no arena/sprites, no result screen, no item sheet, no ranked-locked screen, no queue timeout screen, no connection-lost overlay, no daily-limit state.

### 3.6 Ranks

Handoff: title; Ranked/Unranked 44px tabs; Everyone/Friends 44px chips; 56px rows with rank + rating in Jakarta 700 tabular, name + bracket; your row mint-bordered with "You" tag; footer "Only display names are shown, never addresses or balances."

Current: title + Friends toggle; two large board cards; panel rows with rank, name, bracket, metadata line, score; footer includes addresses/balances note and a verified-saver note.

### 3.7 Settings

Missing entirely. The handoff's Settings is the natural home for:

- ACCOUNT: display name, savings account (read-only)
- PREFERENCES: sound effects, reduce motion
- ABOUT: privacy notice, version
- Destructive: "Disconnect savings account" in coral/warn-fill

For this app, the destructive action should be **Delete account** (and optionally a separate Disconnect). The delete flow should open as its own screen, not an inline panel.

### 3.8 App-specific routes (not in the handoff)

- `/vault`
- `/receipts`
- `/card/[token]`
- `/setup/vault`

These have no handoff screen to copy. They should adopt the same shell, panels, buttons, type, focus and state rules, but they do not need to become handoff screens. The card page is public and should stay outside the wallet gate.

### 3.9 Delete-account flow (the original trigger)

Current: `src/components/DeleteAccount.tsx` renders an "Account" section at the bottom of `/profile`; each phase is an inline `vpx` box. It works and the security logic is good.

Gaps vs the handoff's design language:

- No dedicated screen, header or back button.
- No step indicator for unlock → reveal → quiz → confirm.
- No grouped rows or 44px icon buttons.
- Panels are square `.vpx`, not the handoff's stepped pixel panels.
- Primary actions are mint; the final destructive action is a solid coral button, while the handoff's destructive pattern is a warn-fill row.
- No bottom sheet for the final confirmation.
- Type uses 11px captions.
- The entry point is buried below share/backup/help.

**Recommended extension:** a `/settings` screen with a destructive "Delete account" row; tapping it opens `/settings/delete`, a single-route, step-state flow with:

1. Vault proof: unlock (local vault) or type 24 words (server-only vault), or skip if no vault.
2. Reveal + acknowledge (local vault) or verify (typed words).
3. Quiz (local vault).
4. Confirm: coral primary "Delete everything", cancel/back, error banner.

Reuse the existing logic and API calls unchanged; this is a UI port, not a behaviour change.

---

## 4. Missing screens and flows

These have no route at all:

- First check-in celebration
- Home checked-in state
- Items
- Bracket Climb
- Ranked Locked
- Queue Timeout
- Withdrawal / Balance dropped
- Connection Lost
- Result (win/loss/tie) as screens
- Settings
- Delete-account flow as a screen

Plus these states that exist only inline:

- Item sheet
- Queue
- Friend challenge sent
- In-battle wait
- Daily limit
- Gate / Preparing / Update Pay / Balance Error as designed screens

---

## 5. Intentional divergences — decide, don't accidentally "fix"

These are real product differences, not bugs:

1. **Vault replaces Connect.** The handoff's Connect step reads a savings account; the app creates a non-custodial vault. Keep the vault ceremony, but style it as the handoff's Connect/Privacy/Name steps.
2. **Vault, Receipts, Card are app-specific.** No handoff screen exists. Align to the design system; do not invent handoff screens for them.
3. **Delete account is not in the handoff.** It needs a designed extension in Settings.
4. **Shields, streaks, receipts, verified-saver** are app features not in the handoff. Keep them, but express them with the handoff's type/chips/rows.
5. **Name limit 32 vs 16.** The app allows 32; the handoff says 16. Decide whether to change the limit (may affect existing names) or keep 32 and only change the UI.
6. **Settings "Disconnect savings account" vs "Delete account".** The handoff shows Disconnect; the app has Delete. Decide whether both appear.
7. **Copy.** The app's security copy is more detailed than the handoff's. Keep the meaning, tighten the length and voice.

---

## 6. Recommended batch order

The existing foundation spec's roadmap is Onboarding → Economy → Battle → Home. Given this audit, I recommend a **foundation-2 batch first**, then the user-facing core loop, then the one-time onboarding flow:

| Batch | Contents | Why this order |
|---|---|---|
| **0. Foundation 2** | `ScreenShell`, `PixelPanel`, `Button`, `Chip`, `Row`, `Tabs`, `Banner`, `BottomSheet`, `ResultPanel`; type scale (12px floor); focus-visible; CTA colour decision; panel geometry decision | Every later screen depends on these; without them each batch re-invents the same pieces |
| **1. Economy** | Profile, Items, Missions, Bracket Climb, Withdrawal, Settings + delete flow | Contains the reported delete-account pain; most-used non-battle screens; first consumers for rows/tabs/chips/banner |
| **2. Home** | Home, Home checked-in | Highest-visibility screen; depends on character card, chips, coral CTA, checked-in state |
| **3. Battle** | Menu, Ranked Locked, Daily Limit, Queue, Timeout, Friend Wait, Battle, Wait, Results, Connection Lost | Largest batch; needs arena art, sheet, result panel, motion |
| **4. Onboarding** | Welcome, Connect/vault, Privacy, Name, First Check-in, Gate, Preparing, Update Pay, Balance Error | One-time flow; benefits from the primitives and CTA/type decisions |
| **5. App-specific polish** | Vault, Receipts, Card | No handoff screen; apply the system after the reference screens are right |

If you want the delete flow fixed immediately, Economy can start before Home.

---

## 7. Definition of done (per batch)

1. Every screen uses `ScreenShell` and the shared primitives; no ad-hoc button/panel/row classes.
2. Type: 12px floor, handoff sizes for display/heading/sub-heading/body/label/number.
3. Primary CTA coral; mint reserved for success/progress/you; destructive uses warn-fill row or coral primary as appropriate.
4. Focus-visible: 2px mint outline, 2px offset, everywhere.
5. Touch targets: 44px minimum.
6. States: default, pressed, disabled, loading, error, empty, locked/done where relevant.
7. Motion: handoff animations, with reduced-motion collapse.
8. Real data and flows, not a static gallery.
9. Rendered at 360 / 390 / 430 and on the phone; before/after screenshots shown for sign-off.
10. `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` green.

---

## 8. Decisions needed before the next spec

1. **Panel geometry:** adopt the handoff's `.pxw`/`.px` stepped corners + 4px hard shadow, or keep square `.vpx`? (Recommend adopt for fidelity.)
2. **Primary CTA colour:** switch primary actions to coral, keeping mint for success/progress? (Recommend yes.)
3. **Type floor:** enforce 12px minimum and accept the layout changes it causes? (Recommend yes.)
4. **Settings destructive action:** Delete account only, or Disconnect + Delete? (Recommend Delete only, since Disconnect is not implemented.)
5. **Name limit:** 16 (handoff) or 32 (current)? (Recommend keep 32 for existing players; show 16 for new ones only if you want the handoff exactly.)
6. **App-specific routes:** restyle only, or redesign? (Recommend restyle only.)
7. **Batch order:** Foundation 2 → Economy → Home → Battle → Onboarding, or the original roadmap order?

Once these are answered, the next step is a written spec for the chosen batch, then a plan, then implementation.

---

## 9. Foundation 2 status — 2026-11-06

**Branch:** `feat/foundation-2-primitives` (from `main` at `bf171b5`)
**Verdict:** the Foundation 2 batch is implemented and verified against this audit. Every route now uses the handoff's shell, type scale, panel geometry and button treatments. Economy is the next batch.

### What landed

- **CSS foundation** (`src/app/globals.css`): handoff type scale with a 12px floor (`.sv-display`, `.sv-heading`, `.sv-subheading`, `.sv-body`, `.sv-label`, `.sv-section-label`, `.sv-figure`, `.sv-number-*`), stepped `.pxw`/`.px` panels (3px stepped corners, 4px hard shadow), the five button treatments, chip/row/tabs/banner/sheet classes, 2px mint focus-visible, handoff motion with a reduced-motion collapse, and `.sv-break` for hashes and addresses.
- **Nine primitives** (`src/components/ui/`): `ScreenShell`, `PixelPanel`, `Button`/`ButtonLink`, `Chip`, `Row`, `Tabs`, `Banner`, `BottomSheet`, `ResultPanel`.
- **Twelve routes migrated**: Home, Missions, Battle menu, Ranks, Profile (+ `DeleteAccount`, `BackupSettings`, `BackupQuiz`, `CopyButton`), Vault (+ `VaultTour`), Receipts, Battle detail, Setup (+ `PhraseCeremony`, `PassphraseField`), Setup vault, Card (+ `VersionGate`).
- **Decisions applied:** stepped panels; coral primary CTAs with mint reserved for success/progress/you; 12px type floor; 16-character limit for new display names (existing longer names still render); app-specific routes redesigned to the handoff system rather than only restyled; Settings keeps both Disconnect and Delete, with Delete moving to `/settings/delete` in the Economy batch.
- **`PENDING` in `src/lib/type-floor.test.ts` is now an empty set**, so any new sub-12px type fails the suite.

### Verification evidence

| Check | Result |
|---|---|
| `npm test` | 198 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0 (41 pre-existing warnings, no errors) |
| `npm run build` | exit 0, all routes compiled |
| `text-[10px]` / `text-[11px]` in `src/**/*.tsx` | none; 10px exists only in `.sv-state` (battle state labels) |
| Renders | 33 PNGs at 360/390/430 in `docs/superpowers/renders/foundation-2/after/`, paired with the committed before sweep |

### Keyboard and touch audit

Run over every route at 360/390/430 with the CDP harness (`--audit`):

- `overflowX` is 0 everywhere; no element is wider than the viewport.
- No interactive target is below 44×44.
- Minimum rendered font is 12px; 10px appears only inside `.sv-state`.
- Tab order follows reading order, every stop is fully in view and uncovered by the fixed nav/header, and every stop shows the 2px mint outline.
- `BottomSheet` and `ResultPanel` have no consumer yet; their Escape/focus-trap behaviour is covered by the `ui-primitives.test.ts` source contract and the CSS assertions, per the spec's no-scratch-routes rule.

### 360px behaviour

No action label, balance, XP value or row title is truncated at 360px. Content scrolls taller where it must. Two deliberate adaptations:

- **Receipts:** the snapshot metadata row wraps instead of truncating.
- **Setup:** five 12px step labels cannot coexist at 360px, so the progress bar is five 8px dots plus one active label.

### Performance note

Measured with Chrome at 390×600, 4× CPU throttle, continuous scroll of a `.pxw` list at 60Hz:

| Screen | Frames / 3s | Mean | p50 | p95 | Max | Frames >33ms |
|---|---|---|---|---|---|---|
| Missions | 170 | 17.7ms | 16.7ms | 16.8ms | 83.4ms | 6 (3.5%) |
| Ranks | 157 | 19.2ms | 16.7ms | 16.8ms | 133.4ms | 7 (4.5%) |

Sustained scrolling holds the 16.7ms frame budget at p95. The occasional spike is first-paint of filtered panels entering the viewport. This is accepted for fidelity; the filters stay, per the approved spec.

### Remaining step

The emulated sweep is the agent's evidence. The real-device pass in Nimiq Pay at 360–430px is the user's final sign-off step.

**Sign-off:** batch signed off on 2026-11-06. A review copy of the current renders, with before/after pairs, is at `docs/superpowers/renders/foundation-2/review/` for the user's corrections.

---

## 10. Economy — Settings slice status — 2026-11-09

**Branch:** `feat/economy-settings`, stacked on the signed-off Foundation 2 head.
**Verdict:** the Settings + delete slice is implemented and verified. Items, Bracket Climb, Withdrawal and the rest of the Profile restructure remain in the Economy batch.

### What landed

- **`/settings`** (`src/app/settings/page.tsx`): a pushed screen reached from the 44×44 settings icon on Profile. Account rows (display name, vault address, backup status), the existing `BackupSettings`, Help (show tour, contact), About (version from `package.json`, address, privacy sheet, custody line), and a Danger zone with **Disconnect savings account** and **Delete account**.
- **`/settings/delete`** (`src/app/settings/delete/page.tsx` + `src/components/settings/DeleteAccountFlow.tsx`): the existing proof gate, phrase matching, signed `DELETE /api/players/me` and error mapping moved unchanged out of Profile. The flow starts in `checking`, shows one square per step plus an active label, and the destructive call only runs from a `BottomSheet` (`Yes, delete everything`).
- **Disconnect** is local only: it clears the session and, when present, this device's vault key, then lands on `/setup`. The sheet says plainly that the profile, level, streak and vault stay on the server.
- **Setup reconnect** (`src/lib/reconnect.ts` + `src/app/setup/page.tsx`): the account picker probes `GET /api/players/me` with the picked address before creating anything. A 200 restores the session from the profile; a 404 continues onboarding; any other status shows an error and creates nothing. This removes the `vault_exists` dead end Disconnect would otherwise hit.
- **Reconnect validation:** the 200 body is validated and its address must match the picked wallet before a session is written. A malformed or mismatched body shows an error instead of a session Home immediately rejects.
- **Shared `PrivacyNotice`** (`src/components/PrivacyNotice.tsx`): one copy for Setup and the Settings sheet.
- **Profile**: header is `Profile` + the handoff's flag icon; the display name, level and bracket moved into the body identity strip. Delete, Backup, Help and the footer left Profile.
- **Primitive fix:** `ScreenShell`'s back link is now `shrink-0`. At 360px on `/settings/delete`, the wrapping title had squeezed it to 43×44; it is 44×44 again.
- **Delete cleanup:** once the server confirms deletion, clearing the vault key, session and tour flag is best-effort and the route always leaves for `/setup`. A blocked storage API cannot turn a successful delete into a retry loop. Disconnect's cleanup is guarded the same way.
- **Sheet focus:** `BottomSheet` keeps its close callback in a ref, so a `busy` re-render no longer tears down and re-runs the focus trap.

### Verification evidence

| Check | Result |
|---|---|
| `npm test` | 208 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 44 warnings, 0 errors (three new `set-state-in-effect` warnings follow the existing session-read pattern) |
| `npm run build` | exit 0, `/settings` and `/settings/delete` compiled |
| `text-[10px]` / `text-[11px]` in `src/**/*.tsx` | none |

### Keyboard and touch audit

Run with the CDP harness at 360/390/430 over `/profile`, `/settings` and `/settings/delete`:

- `overflowX` is 0 everywhere; no element is wider than the viewport.
- No interactive target is below 44×44. The `shrink-0` fix above came from this audit.
- Minimum rendered font is 12px (13px on `/settings/delete`).
- Focus runs in reading order, every stop is visible and uncovered, and every stop shows the 2px mint outline.

The sheets were opened with the harness (`--click`) and captured at 360 and 390. Escape and focus restore are inherited from the Foundation 2 `BottomSheet` and its source contract. The reveal and quiz states were not target-audited: the headless fixture cannot type the passphrase. Their controls are the existing `CopyButton`, checkbox, `BackupQuiz` and buttons, covered by the Foundation 2 audit and the source checks; the route, proof, review and sheet states were audited and rendered.

The reveal and quiz states were not target-audited: the headless fixture cannot type the passphrase. Their controls are the existing `CopyButton`, checkbox, `BackupQuiz` and buttons, covered by the Foundation 2 audit and their source contracts; the proof, review and sheet states were audited and rendered.

### 360px behaviour

- **`/settings/delete`:** the title wraps to two lines (`DELETE / ACCOUNT`); no label, hint or button is truncated.
- **`/settings`:** the full page scrolls taller than 844px; account values and the custody line wrap normally.
- **Sheets:** the privacy sheet fills most of a 360×844 viewport and scrolls inside `max-height: 80dvh`; the Close button stays reachable.
- **Profile:** the settings icon stays on-screen and the 16-character name limit wraps instead of colliding.

### Renders

21 PNGs in `docs/superpowers/renders/economy/after/`: Profile, Settings and Delete at 360/390/430, plus the Settings full-page shots and the Review, delete confirmation, Disconnect and Privacy sheet states. The review copy with before/after pairs is at `docs/superpowers/renders/economy/review/`. The Privacy sheet image predates the final copy correction from “app footer” to “Settings → Help”; the layout is unchanged. The Privacy sheet PNG predates the final “Settings → Help” copy correction; its layout is unchanged.

### Remaining step

The emulated sweep is the agent's evidence. The real-device pass in Nimiq Pay at 360–430px is the user's final sign-off step.

---

## 11. Economy remainder — 2026-11-09

**Branch:** `feat/economy-settings` (continued; stacked on the Settings slice).
**Verdict:** the Economy remainder is implemented. Items, Bracket Climb and Balance dropped now exist as screens, and Profile is rebuilt around the character card.

### What landed

- **`/items`**: a pushed screen with the handoff's 2-column grid of all eight items, a `6 of 8 unlocked` chip, 16×16 item art at 48px, per-item bracket and state line, and the "Still yours" footer. Item art comes from `assets/items.json` through `ItemArt`; `ledger_scroll` uses the `Ledger Tome` drawing because the app kept its original item name.
- **`/bracket-climb`**: a celebration screen with the bracket label, the threshold, `+50 XP` when the Bracket Climb mission actually awarded, the unlocked items, and `See my items`.
- **`/withdrawal`**: the neutral "Your balance went down" screen with last/now balances, a mint "Still yours" card and a coral "Removed" card listing the badges actually revoked.
- **Profile**: the identity strip is now a character card using the Hero sprite for the current bracket, the level/bracket line, a `Ranked unlocked` chip when eligible, and an XP bar. Stats and badges use stepped `PixelPanel`s, the full inventory list is gone, and an Items shortcut replaces it.
- **Trigger**: Home routes a check-in with `checkInDestination`. A withdrawal wins over a bracket change; a bracket change below the entry floor goes Home. The result crosses the navigation in a one-shot `sessionStorage` handoff (`checkin-handoff.ts`) with a module cache so React StrictMode's double mount cannot lose it.
- **Art components**: `CharacterArt` (Hero · Entry/Bronze/Silver/Gold) and `ItemArt` (eight items) render the shipped 16×16 paths at whole multiples.
- **Focus fix**: a scrollable `.sv-shell__body` is focusable in Chrome; it now shows the 2px mint outline instead of the UA auto ring. This is why `/items` has a scroll-container focus stop at 360/390.

### Verification evidence

| Check | Result |
|---|---|
| `npm test` | 227 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 48 warnings, 0 errors (four new `set-state-in-effect` warnings follow the existing session-read pattern) |
| `npm run build` | exit 0 |
| `text-[10px]` / `text-[11px]` | none in `src/**/*.tsx` |
| Audit 360/390/430 | Profile, Items, Bracket Climb, Withdrawal: `overflowX: 0`, no wide elements, no target <44×44, min font 12px (13px on the celebration screens), reading-order focus, mint outline, no covered stops |

### 360px behaviour

- **Profile:** the 12-character fixture name wraps to two lines inside the character card; the card grows, nothing is truncated.
- **Items:** two columns hold all eight cards; the `6 of 8 unlocked` chip stays on the header line.
- **Bracket Climb:** "Bracket Climb" wraps to two lines and `3 NIM` stays on one line (non-breaking space).
- **Balance dropped:** the title wraps to two lines; the balance row keeps both values and the NIM labels.

### Renders

12 new PNGs in `docs/superpowers/renders/economy/after/` (Profile, Items, Bracket Climb, Withdrawal at 360/390/430), mirrored into `docs/superpowers/renders/economy/review/current/` with new sections in `index.html`. The review copy now covers the whole Economy batch.

### Final review fixes

A fresh-context review found one critical and five important issues; all were fixed with tests:

- **XP bar:** `players.xp` is cumulative, so Profile's `xp / xpToNextLevel(level)` pinned from level 3. `xpProgress(level, totalXp)` in `constants.ts` now splits cumulative XP for both Home and Profile; tests cover level 7 at 675 and 700.
- **Handoff one-shot:** the module cache replayed celebrations for the rest of the page session. It is gone; each screen consumes the record once behind a `useRef` guard, so StrictMode's second effect run is ignored but a later mount really finds nothing. Storage write failures return `false`; Home keeps the awards panel rather than routing to a screen that would immediately redirect.
- **Bracket direction:** `checkInDestination` now receives `previousBracket` and only celebrates a rank rise. A demotion cannot be framed as "You've reached".
- **Awards:** the full check-in summary is stored separately and consumed by Home on return, so a climb that also levels up or awards First Steps is not lost behind the celebration route.
- **Golden Crown:** the check-in now writes a `player_items` row when the crown badge is awarded; `/api/profile` backfills ownership from any crown badge row, including revoked ones, so a demotion cannot re-lock the item. `ownedItemKeys` is unit-tested.
- **Withdrawal copy:** the Steady Saver reset is stated on every withdrawal; the "streak badge is removed" sentence appears only when a streak badge was actually revoked.
- **Minor fixes:** 72px withdrawal glyph and 48px badge art (whole multiples), Items 401 redirect flash, Bracket Climb direct visits go Home, `text-fg`/`text-fg-soft` tokens added, `previousBalanceLuna` returned for the last-check-in figure, and badge descriptions are available to screen readers.

The full suite is now 227 tests.

### Rulings
- **Item state line:** Items shows the item's effect blurb rather than the handoff's generic "Active in battles"; the effect is more useful and the footer still carries the "items stay" rule.

- **Hero sprite:** the handoff's Profile uses `Hero · Silver`; the card uses the Hero sprite for the current bracket. No gender field exists in the app, so this is the only defensible choice.
- **Ledger name:** the app keeps `Ledger Scroll`; the handoff and `assets/items.json` call the drawing `Ledger Tome`. The art is mapped, the name is not renamed.
- **Withdrawal trigger:** the check-in API flags any lower reading, so the screen is shown for any drop; its Removed card lists only the badges actually revoked instead of promising one. The handoff's copy assumed a bracket/streak drop.
- **Scroll focus:** the pushed scroll body is keyboard focusable by the browser; the mint outline makes that stop consistent rather than removing a useful way to scroll a screen with no other controls.

### Remaining step

The real-device pass in Nimiq Pay at 360–430px is still the user's final sign-off step.

---

## 12. Home UI status — 2026-11-09

**Branch:** `home-ui-redesign` (from `main` at `24836e0`).
**Verdict:** Home and the First check-in screen match the handoff structure. The checked-in state and the first-check-in handoff are implemented.

### What landed

- **Header:** Silkscreen `Savborne` wordmark; bracket outline chip and mint `Lv N` chip. The display name moved into the character card.
- **Character card:** 132x176 sprite well, `CharacterArt` at 96px, name, level/bracket, bordered XP bar and "N XP to Level N+1". XP uses the shared `xpProgress` (cumulative split).
- **Savings card:** 2dp balance in Silkscreen, streak/delta chip, coral `Check in now` inside the card. After a check-in the button is disabled (`Checked in today` with a check glyph), the status is mint, and the delta appears for that session. `Open vault` remains a ghost link because Vault has no tab.
- **Missions:** two 58px rows (Daily Check-in, Quick Duel) with 24px mint checkboxes and trailing XP; done rows are muted and say `+XP earned`.
- **Battle card:** cream `PixelPanel`, `BATTLE.dailyLimit - battlesToday` battles left, coral `Choose opponent`.
- **First check-in (`/first-checkin`):** First Steps badge, +20 XP, recorded balance, bracket items through `ItemArt`, CTA Home. It wins over withdrawal and bracket climb; the rest of the award summary is read on Home.
- **Checked-in helper:** `checkedInToday(lastCheckInAt, now)` compares UTC dates and is unit-tested.

### Verification

| Check | Result |
|---|---|
| `npm test` | 236 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 49 warnings, 0 errors |
| `npm run build` | exit 0 |
| Type floor | no `text-[10px]`/`text-[11px]` |
| Audit | Home default/checked-in and First at 360/390/430: `overflowX: 0`, no wide elements, no target <44x44, min font 12 (13 on First), clean focus and mint outline |

### 360 behaviour

- Header wordmark and both chips fit.
- The 12-character fixture name wraps inside the character card.
- Balance and chip wrap rather than truncate.
- `Choose opponent` keeps its label; the Battle card stays on the handoff's one-screen height.
- First check-in tiles and item names fit in two columns.

### Rulings

- No new logo asset; the Silkscreen wordmark is the header.
- Home shows 2dp; Vault/receipts keep full precision.
- Shields/check-ins are not on Home, because the support line pushed the Battle card below the fold. Check-ins remain on Profile.
- The Battle CTA is coral, not the handoff's dark button.
- First check-in wins over Bracket Climb.
- The delta chip is a post-check-in transient and is not in the static checked-in render; a reload shows the streak chip.

### Renders

9 PNGs in `docs/superpowers/renders/home/after/` (Home, Home checked-in, First at 360/390/430), plus `docs/superpowers/renders/home/review/` with the Foundation 2 Home before pair and notes.

### Remaining

The real-device pass in Nimiq Pay needs `.env.local` in the sandbox; the UI code, tests, build and fixture renders do not.

---

## 13. Battle UI status — 2026-11-09

**Branch:** `battle-ui-redesign` (from `main` at `b9a8cbf`).
**Verdict:** the Battle batch matches the handoff's structure across the menu, queue, friend challenge, arena, item sheet, wait, connection-lost and result screens. The check-in integrity release gate is landed in code and blocked on the live migration.

### What landed

- **Battle menu (`/battle`):** Ranked, Friend and AI cards. Ranked is coral when eligible; when locked it is an off panel with Level and Check-in `Meter`s and a Missions link, and AI becomes the coral action. The Daily Limit state has three used pips, a UTC-midnight countdown, three off cards and a Missions link.
- **Ranked queue (`/battle/queue`):** joins on mount, polls every 10s, live timer and widening range, VS cards, Leave queue. At 3:05 it keeps searching and offers Battle the AI, Challenge a friend or Leave queue.
- **Friend challenge (`/battle/friend/[id]`):** challenge sent, 24-hour countdown, copy link, cancel confirmation sheet, expired state. Pending creators on `/battle/[id]` redirect here; the joiner keeps the accept state.
- **Arena (`/battle/[id]`):** Hero/Rival sprites, opponent coral and viewer mint HP, 2x2 move grid, compact turn result, Copper Compass line, item `BottomSheet`, in-battle wait with locked move and timer, and an in-page connection-lost state with the 60-second grace and Reconnect.
- **Results (`/battle/[id]/result`):** win/loss/tie via `ResultPanel`, 250px result arena, XP and rating/record tiles, First Blade and items used. `/battle/[id]` redirects completed battles here.
- **APIs:** additive battle GET fields (viewer/opponent level and bracket, owned items, current move) and `POST /api/battles/[id]/cancel`. Existing battle, queue, friend and AI contracts are unchanged.
- **Check-in release gate:** generated `check_ins.utc_date`, unique `(player_address, utc_date)`, distinct-day `check_in_count`, one-transaction `commit_check_in`, and a DB fixed-window `consume_rate_limit`. The route is idempotent on a same-day POST and does not read the chain.

### Verification

| Check | Result |
|---|---|
| `npm test` | 296 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 50 warnings, 0 errors |
| `npm run build` | exit 0 |
| Type floor | no `text-[10px]`/`text-[11px]` in new code |
| Audit | 45 renders (15 states x 360/390/430): `overflowX: 0`, no wide elements, no target <44x44, min font 12, clean focus and mint outline |
| Item sheet | focus trapped, Escape closes, focus returns to the trigger |

### 360 behaviour

- The menu header and `{n} battles left today` chip fit; mode titles wrap.
- Queue VS cards keep the 80px sprite; the timer and range stay on one row.
- Friend cards and the three actions fit without truncation.
- Arena plates stay 46% wide; names truncate with a title, status tags wrap to their own line; Special Move wraps to two lines.
- The offline Reconnect button is in view at 360 after the turn log is hidden.
- Result tiles stay two columns; both actions are visible at 360.

### Rulings

- Mode titles are 20px `.sv-subheading`; Foundation 2 has no 24px Jakarta role.
- Ranked Locked is inline on the menu, matching the handoff figure.
- Friend wait is `/battle/friend/[id]`, not `/battle/friend`.
- Result shows the current rating, not a delta; unranked/AI show the record.
- Daily Limit has a Missions link even though the figure does not draw one.
- AI uses the existing rival art; the handoff's robot glyph is not in `assets/glyphs.json`.
- Result sprites now follow the winner: 112px winner, 80px loser, 96px each on a tie. The pair is centred with a fixed 16px gap and a shared bottom edge, so it cannot touch at 360. The handoff drew them near-equal; this is a deliberate readability change, result screen only.
- The result title is centred, balanced and 36px Silkscreen. `ResultPanel` defaults to left/44px; only the Battle result opts in, so future result screens are unaffected.
- Connection lost is an in-page state; polling continues.
- The check-in gate migration is manual and still needs the live acceptance run.

### Renders

45 PNGs in `docs/superpowers/renders/battle/after/` plus the Foundation 2 before pair in `docs/superpowers/renders/battle/before/`. The review page is `docs/superpowers/renders/battle/review/index.html`; raw audit is `docs/superpowers/renders/battle/audit/final-audit.jsonl`.

### Remaining

1. Apply `supabase/FINAL-SCHEMA.sql` to the live project and run the five-POST, concurrency and rate-limit acceptance checks.
2. The real-device Nimiq Pay pass at 360-430 is the user's final sign-off step.
3. Do not merge until the user signs off.

---

## 14. Onboarding UI status - 2026-11-09

**Branch:** `onboarding-ui-redesign` (from `main` at `f055a35`).
**Verdict:** onboarding now matches the handoff's Welcome, Create your vault,
Privacy and Name structure, keeps the non-custodial 24-word ceremony, stores
privacy consent, and adds the Nimiq Pay gate screens and `/balance-error`.

### What landed

- **Routes and draft:** `/welcome`, `/connect`, `/privacy` and `/name` behind
  one `(onboarding)` layout; `/setup` server-redirects to `/welcome`. The draft
  lives in React context. The phrase never enters localStorage, sessionStorage,
  a URL or a cookie. A stored session is probed first: 200 goes Home, 404 clears
  the stale session, other failures leave onboarding alone.
- **Welcome:** the handoff logo mark and pixel wordmark, 144px `CharacterArt` in
  the 220x260 well, the 36px Silkscreen headline, coral `Get started`, and the
  "Built for Nimiq Pay" footer.
- **Create your vault (step 1 of 3):** the handoff Connect shell, three 8px
  step bars, numbered explainer, can/cannot cards and coral CTA. The existing
  phrase grid, four-word quiz and passphrase ceremony run inside the step; the
  quiz owns an h1 in onboarding and stays h2 in Settings. A ready state covers
  returning from Privacy.
- **Privacy (step 2 of 3):** short-version mint panel, four cards
  (collect / don't / public / stored), consent line and coral Continue. One
  copy source feeds the Settings compact variant and the stored notice version
  (`2026-11-09`). The previous mojibake arrow is gone.
- **Name (step 3 of 3):** 128px character preview, 56px field, 16-character
  limit, live counter, label and hint, `aria-describedby`, `aria-invalid`, error
  banner and coral "Start playing".
- **Consent:** `players.privacy_consent_at` and `privacy_notice_version` added
  inline and by ALTER; `create_player_with_vault` gained
  `p_privacy_notice_version` and drops the old six-argument signature first;
  `POST /api/players` accepts the optional version and stores the timestamp in
  the same transaction.
- **Name limit:** 16 for new names on the client and in the API. The database
  check stays 1-32 so legacy names remain valid.
- **Balance error:** `/balance-error` for `503 rpc_unreachable` only, with the
  coral warning panel, the handoff copy, error shake, Try again and Go back to
  Home. Try again leaves a one-shot flag; Home consumes it and starts one
  check-in. Every other failure keeps the inline banner.
- **Gate:** Preparing is the brand mark and one line with no spinner; Open
  inside Nimiq Pay is the phone panel with no CTA; Update Nimiq Pay has the
  update arrow, the Nimiq site link and a retry that re-runs the check. The
  Open and Update screens have no top Silkscreen header: the centred headline
  is the screen heading. `/card/*` stays public.
- **Foundation additions:** `.sv-display-sm` (36), `.sv-heading-lg` (32),
  `.sv-subheading-lg` (32 Jakarta), `.sv-input`, `.sv-steps`, `BrandMark`,
  `StepBars` and the hand-drawn `phone` glyph from the handoff.

### Verification

| Check | Result |
|---|---|
| `npm test` | 345 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 50 warnings, 0 errors |
| `npm run build` | exit 0, `/welcome`, `/connect`, `/privacy`, `/name`, `/balance-error` compiled |
| Type floor | no `text-[10px]`/`text-[11px]` in new code; the privacy consent line is 12px |
| Audit | 45 rows (15 states x 360/390/430): `overflowX: 0`, no wide elements, no target <44x44, min font 12, every tab stop in view/uncovered with the 2px mint outline |

### 360 behaviour

- Welcome: the brand row fits; the headline takes four lines; the character well
  and CTA fit with no horizontal overflow.
- Create your vault: the title takes two lines; the explainer wraps to four
  lines for step 3; the can/cannot cards stay two columns and wrap their text.
  The account address wraps inside its button. The 24-word grid stays two columns
  and the page scrolls; the quiz and passphrase fields fit.
- Privacy: the short panel and four cards scroll; the consent line and CTA are
  at the end and are reachable by scrolling. The 2-column pair keeps both cards
  and wraps.
- Name: the title takes two lines; the 250px character panel, field, counter and
  error fit. The error state keeps the CTA on screen at 360.
- Balance error: the centred headline wraps to two lines; both actions fit.
- Gate: the outside and update screens centre the panel, headline, body and
  actions with no top header; both update actions fit at 360.

### Rulings

- **Split routes, memory draft.** The handoff URLs and browser back work; a
  reload restarts onboarding. The phrase is not stored, by design.
- **"Create your vault", not "Connect your savings account".** The app creates
  a vault; the handoff's Connect copy describes reading an existing account.
- **The ceremony is kept.** The word grid, quiz, passphrase rule and local
  encryption are unchanged; only the shell and the quiz heading level changed.
- **Consent time is server time at creation.** The accepted version travels
  with the request; the timestamp is a few seconds after the Continue tap.
- **16 for new names; DB stays 32.** No rename path exists, so legacy names are
  untouched. Display-name uniqueness is out of scope.
- **Balance Error only for `rpc_unreachable`.** Other check-in failures keep the
  inline banner, where the copy is accurate.
- **The gate stays one component with states.** A gate route would be gated
  itself or need an exemption. The Open, Update and Balance error screens have
  no top Silkscreen header; the centred headline is the only heading.
- **Update opens https://nimiq.com.** No app-store deep link exists in the repo.
- **The privacy page scrolls.** The handoff pins the consent footer; at 360 the
  cards and a pinned footer would obscure text, so the footer sits at the end.
- **The Settings compact notice changed.** It now shares the copy source and
  shows the notice version; its layout is otherwise the same list.

### Renders

45 PNGs in `docs/superpowers/renders/onboarding/after/` (15 states at
360/390/430) and the Foundation 2 `/setup` before pair in
`docs/superpowers/renders/onboarding/before/`. The review page is
`docs/superpowers/renders/onboarding/review/index.html`; raw audit is
`docs/superpowers/renders/onboarding/audit/final-audit.jsonl`.

### Remaining

1. Apply `supabase/FINAL-SCHEMA.sql` before deploying this build: the new API
   route calls the 8-argument `create_player_with_vault`.
2. Run the check-in acceptance checks and confirm onboarding stores
   `privacy_consent_at` and `privacy_notice_version`.
3. The real-device Nimiq Pay pass at 360-430 is the user's final sign-off step.
4. Do not merge until the user signs off.

---

## 15. Onboarding focus pass - 2026-11-09

**Branch:** `onboarding-ui-redesign` (continues the Onboarding batch).
**Verdict:** the visible copy is shorter, the progress indicator now matches the
five screens, and every trimmed explanation is reachable later in Settings.
Section 14's three-step model is superseded by this pass.

### What landed

- **Five steps:** Welcome 1/5, Vault 2/5 (intro + account picker), Backup 3/5
  (24 words, quiz, passphrase, ready), Privacy 4/5, Name 5/5. The label and the
  five 8px bars switch from 2 to 3 inside `/connect` when the phrase appears.
  Welcome shows the indicator in the brand row. `StepLabel` owns the
  `aria-current="step"` text; the bars are decorative.
- **Vault intro:** the three visible numbered steps are gone. The screen is a
  short paragraph, the can/cannot cards and a closed "How your vault works"
  disclosure. The same three steps are a section in Settings.
- **Backup:** the warning is two sentences and the passphrase note is two
  sentences, both from `src/lib/onboarding-copy.ts`. The quiz instruction is
  unchanged; its role is explained in Settings.
- **Privacy:** the short version is two sentences. Two cards stay visible
  (collect/don't); public and storage sit behind one closed "What's public and
  where it's stored" disclosure with the notice version. The full four-card
  notice is in Settings; the compact Settings sheet stays.
- **Settings > How Savborne works:** a pushed reference linked from Settings >
  Help. Sections: Your vault, Backup and recovery, Privacy and data, Nimiq Pay.
  It uses the same copy module as onboarding, so the long and short versions
  cannot drift.
- **Focus:** `summary` joins the global 2px mint focus ring; the disclosures are
  44px targets and were included in the audit.

### Verification

| Check | Result |
|---|---|
| `npm test` | 354 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 50 warnings, 0 errors |
| `npm run build` | exit 0; `/settings/how-it-works` added, all onboarding routes compiled |
| Type floor | no `text-[10px]`/`text-[11px]`; the privacy consent line is 12px |
| Audit | 54 rows (18 states x 360/390/430): `overflowX: 0`, no wide elements, no target below 44px, min font 12, every tab stop in view/uncovered with the mint outline; both disclosures audited closed and open |

### 360 behaviour

- Welcome: the brand row, "Step 1 of 5" and five bars fit on one line; the
  headline keeps its three-to-four-line wrap and the CTA sits at the bottom.
- Create your vault: the short intro and cards fit with the CTA; opening "How
  your vault works" adds the three steps and the page scrolls. The account
  picker and the step 2 label are unchanged.
- Backup: the two-sentence warning, the 24-word grid, quiz and passphrase fit
  without horizontal overflow; the step 3 label is consistent across all four
  phases.
- Privacy: with the disclosure closed, the consent line and Continue fit at
  360. Opening the disclosure shows public and storage and the page scrolls.
- Name: unchanged at step 5; the counter, error and CTA fit.
- How Savborne works: the title wraps at 360 and every section scrolls; no
  action is truncated.

### Rulings

- **Five steps, dynamic label in `/connect`.** No new route, so the phrase
  never crosses a route and the browser back stack stays simple. Welcome is
  counted because the count has to be honest from the first screen.
- **Details live in Settings.** The onboarding disclosures are for the moment of
  decision; the reference is for later. The compact privacy sheet remains the
  quick check.
- **The vault intro keeps the can/cannot cards.** The cards are the scannable
  promise; the three numbered steps are detail, so they are closed and
  repeated in Settings.
- **The 24-word risk stays visible on Backup.** It is the one irreversible
  fact, so it is two sentences on the screen and fully explained in Settings.
- **The privacy short version drops the 24-word risk.** That risk is on Backup
  and in Settings; the privacy screen keeps the no-custody promise and the
  collect/don't cards.
- **Native `<details>` for both disclosures.** No new primitive, no JS, keyboard
  operable, and it gets the same mint focus ring.
- **No API, SQL or gate changes.** The step and copy pass is UI-only.

### Renders

54 PNGs in `docs/superpowers/renders/onboarding/after/` (18 states at
360/390/430), including the open vault and privacy disclosures and How Savborne
works. The review page is
`docs/superpowers/renders/onboarding/review/index.html`; raw audit is
`docs/superpowers/renders/onboarding/audit/final-audit.jsonl`.

### Remaining

1. Apply `supabase/FINAL-SCHEMA.sql` before deploying: the API route calls the
   8-argument `create_player_with_vault`.
2. Real-device Nimiq Pay pass at 360-430 is the user's sign-off step.
3. Do not merge until the user signs off.


---

## 16. Onboarding character picker - 2026-11-09

**Branch:** `onboarding-ui-redesign` (continues the Onboarding batch).
**Verdict:** the Name step now chooses the Hero or Heroine drawing, the choice
persists on the player, and Settings can change it later. The five-step flow is
unchanged.

### What landed

- **Name step:** the 128px preview uses the chosen character. A "Character"
  fieldset holds two 56px picker buttons with 32px art, `aria-pressed`, a mint
  border and label on the selected option. Hero is the default; the preview
  updates immediately. The body is two lines and the panel is 230px so the CTA
  stays on screen at 360.
- **Data:** `players.avatar text not null default 'hero' check (avatar in
  ('hero','heroine'))`, inline and via ALTER with an idempotent check. The RPC
  is now 8 arguments with `p_avatar`; the 6- and 7-argument signatures are
  dropped first.
- **API:** `POST /api/players` validates and forwards the avatar; `GET
  /api/players/me` and `GET /api/profile` return it; `PATCH /api/players/me`
  changes it; `GET /api/battles/[id]` adds `viewer.avatar`.
- **Surfaces:** Home, Profile, Name, ranked queue me-card, friend challenge
  me-card, arena me sprite and result me sprite use the chosen avatar. Opponent
  sprites keep the default art in this pass.
- **Settings:** Account gains a Character row with the same picker. A change
  PATCHes `/api/players/me`, updates the local selection and shows a local error
  banner on failure.
- **Privacy:** the collect card now names the chosen character as game data.

### Verification

| Check | Result |
|---|---|
| `npm test` | 365 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 50 warnings, 0 errors |
| `npm run build` | exit 0 |
| Type floor | no `text-[10px]`/`text-[11px]`; min rendered font 12 |
| Audit | 60 rows (20 states x 360/390/430): `overflowX: 0`, no wide elements, no target below 44px, every tab stop in view/uncovered with the mint outline; the picker buttons, Settings picker and disclosure summaries included |

### 360 behaviour

- Name: the two picker buttons fit side by side, the Heroine preview updates,
  and the name field, counter and CTA stay on screen.
- Settings: the Character row expands the Account panel; the page scrolls, the
  two options fit side by side and the Help rows are unchanged.
- Privacy: the longer collect card still fits the consent line and Continue
  with the disclosure closed.
- All other onboarding states are unchanged.

### Rulings

- **"Character", not "Gender".** The profile stores an art choice (`avatar`),
  not an identity. The privacy notice names it as game data.
- **Inside Name, not a sixth step.** The preview was already there; the picker
  belongs beside it and the five-step count stays honest.
- **Default Hero.** The choice is visible and one tap away; no extra required
  field. The name remains the only required input.
- **Changeable in Settings.** Appearance is not identity; the name stays fixed,
  the avatar does not.
- **Player sprites only.** Opponent avatars need their row in the battle
  payload; that is deliberately out of this pass.
- **`avatar` as the field name.** `character` collides with the SQL type name;
  the UI still calls it Character.

### Renders

60 PNGs in `docs/superpowers/renders/onboarding/after/` (20 states at
360/390/430), including Name Hero, Name Heroine and Settings Character. The
review page is `docs/superpowers/renders/onboarding/review/index.html`; raw
audit is `docs/superpowers/renders/onboarding/audit/final-audit.jsonl`.

### Remaining

1. Apply `supabase/FINAL-SCHEMA.sql` before deploying: the API route calls the
   8-argument `create_player_with_vault` (privacy notice version and avatar).
2. Real-device Nimiq Pay pass at 360-430 is the user's sign-off step.
3. Do not merge until the user signs off.


---

## 17. Panel side-outline fix - 2026-11-09

**Verdict:** every `PixelPanel` now shows its full left and right outline. The
panel width, position, top and bottom edges are unchanged.

### Diagnosis

`.pxw` draws the handoff outline with a `drop-shadow` filter, which is ink
outside the panel's box. `.sv-shell__body` scrolls with `overflow-y: auto`, so
its horizontal axis is clipped at the scrollport edge. The body had vertical
padding but no inline padding, so the 2px left and right outline was cut off on
every screen whose panels reached the body's content edge. A cropped render
confirmed the top edge and stepped corners were present while the vertical
edges were missing.

### Fix

`src/app/globals.css`, `.sv-shell__body`:

```css
padding-inline: 4px;
margin-inline: -4px;
```

The 4px padding gives the scrollport room for the 2px outline; the negative
margin pulls the box back so the content keeps its 22px gutter and exact width.
This is a shell fix, not a per-page or per-panel change. Top and bottom padding
are untouched.

### Verification

| Check | Result |
|---|---|
| `npm test` | 366 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 50 warnings, 0 errors |
| `npm run build` | exit 0 |
| Audit | 60 rows (20 onboarding states x 360/390/430): 0 problems; `overflowX: 0`, no wide elements, targets >= 44px, min font 12 |
| Edge crops | Privacy, Home and Profile at 360 show the full left and right outlines and stepped corners |
| Home/Profile | Spot-checked at 360/390/430 with the existing page fixtures |

### Rulings

- **Global shell fix.** Every page uses `ScreenShell`, so one rule restores the
  edges everywhere without touching individual panels.
- **Content width preserved.** The negative margin is exactly the padding, so
  the panel does not move or narrow; only the clipping changes.
- **Panel geometry untouched.** The handoff outline, stepped corners and 4px
  hard shadow are unchanged.
- **Top and bottom unchanged.** They already had 16/32px of body padding.

### Renders

The 60 onboarding PNGs were re-captured at 360/390/430; the review page also
includes Home and Profile spot checks for the global fix. Raw audit is
`docs/superpowers/renders/onboarding/audit/final-audit.jsonl`.

### Remaining

1. Apply `supabase/FINAL-SCHEMA.sql` before deploying.
2. Real-device Nimiq Pay pass at 360-430 is the user's sign-off step.
3. Do not merge until the user signs off.


---

## 18. Loading state and paired-card heights - 2026-11-09

**Verdict:** every data load uses one branded Savborne loader, and paired cards
in a grid row now share the same height.

### What landed

- **Loading state:** `src/components/ui/LoadingState.tsx` renders three 8px
  mint dots and nothing else. The status region keeps a non-visible "Loading
  Savborne..." label for screen readers. It waits 150ms before appearing so a
  fast load does not flash it, and the dots stop under reduced motion. It
  replaces the plain loading text on
  Home, Profile, Missions, Ranks, Vault, Battle menu, Items, Receipts, ranked
  queue, arena, result, friend challenge, Bracket Climb, First check-in,
  Withdrawal, Settings and Delete account. The Nimiq Pay Preparing state keeps
  its own no-spinner treatment.
- **Paired cards:** `.grid > .pxw { height: 100% }` and
  `.grid > .pxw > .px { height: 100% }` make a shorter `PixelPanel` fill the
  row set by the taller one. Content stays top-aligned. This fixes the privacy
  collect/don't pair and applies to the vault can/cannot cards, item grid,
  first check-in tiles and any future pair. Single full-width panels are
  unchanged.

### Verification

| Check | Result |
|---|---|
| `npm test` | 370 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 50 warnings, 0 errors |
| `npm run build` | exit 0 |
| Audit | 63 rows (21 onboarding states x 360/390/430): 0 problems; min font 12, no target below 44px, clean focus |
| Spot checks | Home, Profile, Items and First check-in at 360/390/430; item rows and the XP/balance tiles share heights |

### 360 behaviour

- Loading: the three dots centre in the body under the existing header; no
  text is drawn.
- Privacy: the collect card and the don't card now end on the same line; the
  disclosure, consent line and Continue still fit with the disclosure closed.
- Items: each row's two cards share a bottom edge; the taller description sets
  the row.
- First check-in: the +20 XP and 2.00 NIM tiles share a height.

### Rulings

- **Dots only.** The wordmark and visible label were removed; the loader is
  three mint dots. The status region keeps a non-visible "Loading Savborne..."
  label for screen readers. No character art is used, so no wrong avatar can
  flash before the profile arrives.
- **150ms delay.** A fast page continues straight to content; the loader only
  appears when the wait is perceptible.
- **Gate Preparing stays separate.** It is the wallet check, not a page data
  load, and the handoff explicitly avoids a spinner there.
- **Every paired card row, not only privacy.** The rule is a grid-child rule,
  so it also covers items, first check-in, vault cards and future pairs without
  per-card props.
- **Top-aligned content.** The extra height is breathing room under the text,
  not vertically centred content.

### Renders

63 onboarding PNGs in `docs/superpowers/renders/onboarding/after/` (21 states at
360/390/430) plus Home, Profile, Items and First check-in spot checks. The
review page is `docs/superpowers/renders/onboarding/review/index.html`; raw
audit is `docs/superpowers/renders/onboarding/audit/final-audit.jsonl`.

### Remaining

1. Apply `supabase/FINAL-SCHEMA.sql` before deploying.
2. Real-device Nimiq Pay pass at 360-430 is the user's sign-off step.
3. Do not merge until the user signs off.


---

## 19. Missions UI status — 2026-11-09

**Branch:** `missions-ui-redesign` (from `main` at `bbdc7f7`).
**Verdict:** `/missions` is the handoff's Progress screen. Repeating holds Daily
and Weekly, One-time holds the six one-time missions, every group is one
grouped panel of 58px rows, and the group headers own the reset line and the
period XP counter. The cap cards are gone.

### What landed

- **Tabs:** `Repeating` / `One-time` (`Tabs`, 44px). Repeating is selected on
  mount; state is local, no query parameter.
- **Group headers:** `Daily` with `Resets 00:00 UTC · 10 of 25 XP`, `Weekly`
  with `Resets Monday 00:00 UTC · 25 of 100 XP`, `One-time` with
  `Never expires`. Titles are 20px default text; captions are the new 12px
  `.sv-caption` role.
- **Group rhythm:** the groups sit in a 36px-gap list, so the Daily panel and
  the Weekly header have 36px between them. The tabs keep 14px to the first
  group and a header keeps 8px to its own panel.
- **Rows:** one grouped `PixelPanel` per group; 24px box (mint fill + ground
  check when done, mint outline when open), a 15px/1.35 title, a 12px/500/1.35
  description on open rows only, and `+N XP` in mint on open rows or muted on
  done rows. The body column carries 8px vertical padding, so done and one-line
  rows stay 58px and a two-line description row grows to about 71px with 8px of
  clearance under the text. Rows are status only.
- **Counters:** earned = sum of completed `xpReward` in the group, clamped to
  `counters.dailyXpCap` / `weeklyXpCap`. `src/lib/missions-ui.ts` owns
  `earnedXp` and `xpCounter`.
- **States:** the branded `LoadingState` with the tabs still visible; error as
  `Couldn't load missions.` plus a secondary `Try again`; per-tab empty panels;
  an all-done slate with the counters at the caps; the 401 redirect unchanged.
- **Removed:** `CapMeters`, `Cap`, the per-row reset lines, the `Done` chip and
  the mint group titles.
- **Home fix (separate commit):** Home now reads `xpReward` (with an
  `xp_reward` fallback), so its two daily rows no longer print `+undefined XP`.
- **Shared change:** one additive rule, `.sv-caption` (12px/600/1.4,
  sentence case), pinned by `panels.test.ts`.

### Verification

| Check | Result |
|---|---|
| `npm test` | 382 pass, 0 fail (370 before the batch) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 50 warnings, 0 errors |
| `npm run build` | exit 0; `/missions` compiles |
| Type floor | no `text-[10px]`/`text-[11px]`; min rendered font 12 |
| Audit | 18 rows (6 states x 360/390/430): `overflowX: 0`, no wide elements, no interactive target below 44px, min font 12, every tab stop in view/uncovered with the mint outline |

### 360 behaviour

- Both tabs and both group captions fit on one line: the Weekly caption is
  231px inside a 324px body, so the handoff copy stays intact.
- The 36px group gap moves the Weekly header down 22px from the handoff
  rhythm; both groups still fit above the nav at 360.
- `Steady Saver`'s description wraps to two lines at 360 and 390; the row grows
  to about 71px with 8px of clearance under the last line. Nothing is clipped
  or truncated.
- Done rows stay at 58px; the one-time panel's six rows scroll with the body.
- Loading centres the three dots in the remaining body; error and empty fit
  without scrolling; the retry button is 56px and left-aligned.

### Rulings

- **Tabs, not stacked sections.** The handoff uses tabs, and splitting
  Repeating from One-time keeps the Daily and Weekly headers above the fold.
- **Read-only checkboxes.** Missions are credited by check-in and battle on the
  server; there is nothing to toggle. Completion is carried by the muted label
  and a visually hidden `(completed)`, not by colour alone.
- **Descriptions on open rows only.** Done rows are scannable at 58px, matching
  the handoff; the explanation is only needed before the mission is earned.
- **36px between groups.** The 14px shell gap and the panel's 4px hard shadow
  left about 10px of air, and a first pass at 24px still read as one block. The
  groups now sit in a 36px-gap list (about 40px visible after the shadow); the
  tabs keep the 14px shell rhythm and a header keeps 8px to its own panel, so
  each title stays bound to its rows.
- **Row type pass.** The first renders showed two-line descriptions ending on
  the divider. The title dropped from 16px to the handoff's 15px and the body
  gained 8px vertical padding. The description is already at the 12px floor, so
  only its weight (600 to 500) and line height (1.4 to 1.35) changed; two-line
  rows grow to about 71px instead of pressing on the divider.
- **Reset in the group caption only.** Repeating it per row duplicated
  information and pushed rows to three and four lines.
- **One grouped panel per group.** One panel per mission (the old screen)
  destroyed the grouped-row rhythm.
- **One-time has no counter.** The API has no one-time budget; the tab shows
  `Never expires` and the six rewards instead of an invented total.
- **Earned XP is derived from the rows.** `counters.weeklyXpEarned` is a
  check-in count in the current API, so displaying it would show `1 of 100 XP`
  beside a ticked 25 XP row. The caps still come from the API, and the sum
  equals the cap when the group is complete.
- **The Weekly Strategist progress meter is deferred.** The handoff draws
  `1 of 2 wins`, but the API returns only `completed`; a meter would need a new
  payload field, which this UI batch does not add.
- **Default text for group titles.** Mint is the success/progress/you colour;
  the handoff draws the group names in default text.
- **Try again.** The handoff has no Missions error screen, so the shared Banner
  gains a secondary action; the error is recoverable without leaving the tab.
- **Home's `xpReward` fix is separate.** It is a field-name bug, not a Missions
  port, and it is committed on its own.

### Renders

18 PNGs in `docs/superpowers/renders/missions/after/` (6 states at
360/390/430) and 3 before PNGs in `docs/superpowers/renders/missions/before/`.
The review page is `docs/superpowers/renders/missions/review/index.html`;
`NOTES.md` holds the sign-off list and deliberate choices. Raw audit is
`docs/superpowers/renders/missions/audit/final-audit.jsonl`.

### Remaining

1. `/api/missions` and `/api/players/me` still report weekly XP as a check-in
   count; the header does not consume it, but a later API batch should sum the
   week's weekly-mission rewards under the existing field names.
2. Weekly Strategist progress needs a payload field before the handoff's
   `1 of 2 wins` meter can land.
3. Real-device Nimiq Pay pass at 360-430 is the user's sign-off step; the
   sandbox has no `.env.local`.
4. Do not merge or push until the user signs off.


---

## 20. Ranks UI status - 2026-11-09

**Branch:** `ranks-ui-redesign` (from `main` at `646e85f`).
**Verdict:** `/leaderboard` is the handoff's Ranks screen. Ranked/Unranked
tabs stay; Everyone/Friends are 44px filter chips with cream selected fills; the
board is one grouped panel of 56px rows; the caller's row is a 60px
mint-bordered row that bleeds through the panel padding; and a caller outside
the top 50 is pinned in its own `Your rank` panel.

### What landed

- **Header:** title only. The "Friends on/off" header button is gone.
- **Filter chips:** a new `FilterChip` primitive (native button,
  `aria-pressed`, 44px, 2px bevel, 13px/700) and `.sv-filter` plus
  `.sv-filter[aria-pressed='true']`. Selected is cream (`--fg`) fill with
  ground (`--shell`) text; unselected is the surface with a bevel border. Mint
  remains the tab, progress/success and You colour.
- **Rows:** one grouped `PixelPanel` (`px-3.5 py-0.5`) of 56px rows with 12px
  gaps: rank in a 26px centred Jakarta 700/14 tabular column, name 15px/700,
  bracket 12px/700 muted in a 52px column, and a 14px/700 tabular figure in a
  48px ranked / 56px unranked column. Ranks 1-3 use default text and 4+ muted,
  as the handoff draws them. The old level/wins/streak metadata line, the
  bracket Chip and the `(you)` suffix are gone.
- **Your row:** `Row variant="you"` and `.sv-row--you`: 60px, mint top and
  bottom borders, `margin-block: 4px`, `margin-inline: -14px`,
  `padding-inline: 14px`, `background: var(--you-surface)` (new `#1B2E29`
  token). The variant suppresses `sv-row--56` and `sv-row--divider`; the row
  above keeps its track divider, so the handoff's 4px gap is visible. The mint
  rank and a 24px `Chip variant="fill"` `You` tag sit on the tinted row.
- **Crown and verified marker:** rank 1 draws `RankCrown`, the handoff's 24x24
  crown (yellow `#FEE761` / brown `#BD6C4A` paths), on both boards. The mint
  verified marker remains beside names with `verifiedSaver`.
- **Pinned rank:** when the API's additive `you` row exists and no list row is
  `isMe`, a second `PixelPanel` under a 12px `Your rank` caption renders the
  same You row. The panel is separate so it never reads as rank 51 or as part
  of the contiguous list.
- **Footer:** the board-specific handoff line at 12px (`Ranked points from
  human ranked battles.` / `Savings score from check-in growth and
  consistency.`) followed by `N players`, with ` · ⟡ verified saver` only when
  a rendered row carries the marker. The "display names only, never addresses
  or balances" promise is in both board lines.
- **States:** loading keeps the tabs and chips with the three-dot
  `LoadingState`; error is a `Banner` plus a 56px secondary `Try again`;
  Everyone-empty and Friends-empty are distinct panels; a 401 redirects to
  `/setup`. The footer is hidden in both empty states.
- **API:** `GET /api/leaderboards` maps every sorted row through one `toRow`
  helper and returns the caller's full row as the additive `you` field. `rows`,
  `total`, both sorts, the friends filter and the unranked score mutation are
  unchanged.
- **Removed:** the header Friends button, the per-row metadata, the bracket
  Chip and the old two-line footer. `Tabs`, `Chip`, `Button`, `Banner`,
  `PixelPanel` and `LoadingState` are unchanged.

### Verification

| Check | Result |
|---|---|
| `npm test` | 396 pass, 0 fail (382 before the batch) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 49 warnings, 0 errors |
| `npm run build` | exit 0; `/leaderboard` compiles |
| Type floor | no `text-[10px]`/`text-[11px]`; min rendered font 12 (bracket, footer, You tag) |
| Audit | 24 rows (8 states x 360/390/430): `overflowX: 0`, no wide element, no interactive target below 44px, min font 12, every tab stop in view/uncovered with the mint outline |
| Geometry | 56px list rows, 60px You row, 4px block margin, 14px inline bleed; 26/52/48px columns ranked and 26/52/56 unranked |

### 360 behaviour

- The rank column, 52px bracket column and 48/56px figure leave a 126px name
  column. The long fixture name wraps to two lines inside 56px; nothing
  truncates.
- The two tabs and the two filter chips each fit on one line; the chips keep
  18px inline padding.
- The ranked footer line wraps to three lines at 360 and two at 390/430, with no
  clipping and no smaller type.
- The You row's mint borders reach the panel's left and right inner edges; the
  stepped panel outline is untouched.
- With the caller pinned, the list + `Your rank` panel fill the viewport and the
  footer scrolls into view. Empty, friends-empty, error and loading fit without
  scrolling.

### Rulings

- **A new `FilterChip`, not Chip or Tabs.** `Chip` is a non-interactive 24px
  status span; `Tabs` is a `role="tablist"` that switches panels. Everyone/
  Friends filter one list, so they need buttons with `aria-pressed` and a
  pressed visual state.
- **Cream selected chip.** The handoff fills the selected chip with `#F3EEDD`
  and ground text. Mint stays reserved for the selected tab, progress/success
  and the You row, so the two controls never compete.
- **Savings score stays on Unranked.** The API's combined check-in growth and
  consistency score orders the board and fills the 56px column. The handoff's
  level ordering and `Lv N` are a recorded divergence; changing them would be a
  rules/API change.
- **Single-line rows.** The handoff rows carry rank, name, bracket and figure
  only. Level, wins and streak are still on Home and Profile; Ranks is a board,
  not a stats sheet.
- **Both crown and verified marker.** The user chose the handoff crown plus the
  vault marker. The crown is positional and decorative: the rank cell already
  announces `Rank 1`, and a provenance test extracts both `d` paths from
  `Savborne-handoff.html` so the art cannot drift.
- **The crown is not the Golden Crown badge.** `golden_crown` is the
  Gold-bracket badge in `src/lib/game/badges.ts` and a 16px item. The rank-1
  crown is the handoff's separate 24x24 drawing and means "rank 1" only. The
  badge continues to live on Profile; the leaderboard payload has no item data.
- **Rank colour follows the handoff.** 1-3 default, 4+ muted. The old
  gold/silver/bronze rank numbers are dropped from Ranks.
- **Your row bleeds on purpose.** The panel uses 14px inline padding, and the
  row pulls back by exactly that amount. The 4px block margin plus the retained
  divider on the row above reproduces the handoff's separated mint frame. A
  future panel padding change must update `.sv-row--you`.
- **The You tag is 24px.** The handoff's 20px/11px tag is below the 12px floor.
  The existing fill Chip is 24px at 12px, so it is 4px taller and reuses the
  primitive.
- **The footer legend is conditional.** `⟡ verified saver` appears only when a
  visible row carries the marker; the count always appears with a listable
  board. The promise sentence stays attached to the board-specific line.
- **Friends-empty is its own state.** The API always includes the caller, so a
  Friends board with no one else would otherwise be a one-row list. The panel
  names the definition (players you have fought in a human battle) and leaves
  Everyone one tap away.
- **The pinned row needed one additive API field.** `you` is the caller's full
  row at its real rank, computed after the friends filter, so the pinned rank is
  honest for the displayed board. `rows`, `total` and the ranking logic are
  untouched; older clients ignore the field.
- **Local tab/filter state.** No query parameter, matching Missions. The back
  button does not accumulate board states.
- **401 redirects to `/setup`.** The page previously surfaced the status
  number; it now follows the other data screens.

### Renders

24 PNGs in `docs/superpowers/renders/ranks/after/` (8 states at 360/390/430)
and 3 before PNGs in `docs/superpowers/renders/ranks/before/`. The review page
is `docs/superpowers/renders/ranks/review/index.html`; `NOTES.md` holds the
sign-off list and deliberate choices. Raw audit is
`docs/superpowers/renders/ranks/audit/final-audit.jsonl`.

### Remaining

1. Real-device Nimiq Pay pass at 360-430 is the user's sign-off step; the
   sandbox has no `.env.local`.
2. If the product later wants the Golden Crown item badge on rank 1, the
   leaderboard payload needs item/badge data; this batch shows the positional
   crown only.
3. Do not merge or push until the user signs off.

---

## 21. Ranks UI revision - 2026-11-10

**Branch:** `ranks-ui-redesign` (same branch, after section 20).
**Verdict:** three review corrections are in. The Everyone/Friends control is a
right-aligned segmented bar visibly smaller than the tabs; the grey divider
above the You row is gone; and the pinned rank highlights its container, not
the row.

### What changed

- **Filter bar:** `FilterChip` is replaced by `FilterBar`. One 2px beveled
  track, 32px tall, right aligned on its own row under the tabs, with a 2px
  internal divider. The visible segments are 28px with 12px/700 labels; each
  segment is a 44px button with `margin-block: -8px`, so the touch target is
  kept while the control reads smaller than the 44px tabs. The selected segment
  stays cream with ground text. `.sv-filter` is gone.
- **You row divider:** the row directly above the caller passes
  `divider={false}` when the next row is `isMe`, and `.sv-row--you` changes
  from `margin-block: 4px` to `margin-block: 0 4px`. The mint top border now
  sits where the grey divider was; the 4px bottom gap remains.
- **Pinned rank:** the `Your rank` panel uses `PixelPanel tone="mint"`. The row
  inside passes `highlight={false}`: no tint, no mint rank, no `You` tag. The
  caption and the 56px row geometry stay. The in-list You row is unchanged
  apart from the divider correction.
- **Tests:** the FilterBar test replaces the FilterChip test; the page contract
  now pins the right-aligned `min-h-11` row, the divider suppression, the mint
  pinned panel and `highlight={false}`.

### Verification

| Check | Result |
|---|---|
| `npm test` | 396 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 49 warnings, 0 errors |
| `npm run build` | exit 0; `/leaderboard` compiles |
| Type floor | min rendered font 12 |
| Audit | 24 rows (8 states x 360/390/430): `overflowX: 0`, no wide element, no interactive target below 44px, every tab stop in view/uncovered with the mint outline |
| Filter targets | Everyone 83x44, Friends 73x44; 32px track, 28px segments |
| Row geometry | 56px list rows, 60px You row, no divider above it, 0 top gap, 4px bottom gap |

### Rulings

- **One bar, not two chips.** The handoff's pair read as two separate boxes
  once it moved out of the handoff's own spacing. A single track with an
  internal divider is one control and reads as a filter, not a second tab row.
- **32px visual, 44px target.** The visible bar is deliberately smaller than
  the tabs without shrinking the tap target. The 44px button overflows the
  32px track vertically; the overflow is invisible and sits inside the 14px
  gap, so it never overlaps another target. The audit measures the button, not
  the track.
- **The top divider goes, the bottom gap stays.** The grey line directly above
  the caller competed with the mint top border. Closing the top gap makes the
  mint border the separator; the 4px bottom gap keeps the mint frame from
  pressing on the next row.
- **Pinned highlights the container.** A second mint-framed row inside a mint
  panel was two highlights for one fact. The panel outline says "this is your
  rank"; the row stays a normal row, and the caption names it.
- **The pinned fixture no longer repeats the caller.** The list now ends at
  rank 6 with Ngozi and the pinned Kemi sits at 57, so the render does not show
  the same player at two ranks.

### Renders

The 24 after PNGs in `docs/superpowers/renders/ranks/after/` were re-captured
at 360/390/430; the 3 before PNGs are unchanged. The review page is
`docs/superpowers/renders/ranks/review/index.html`; `NOTES.md` carries the
revision choices. Raw audit is
`docs/superpowers/renders/ranks/audit/final-audit.jsonl`.

### Remaining

1. Real-device Nimiq Pay pass at 360-430 is the user's sign-off step; the
   sandbox has no `.env.local`.
2. Do not merge or push until the user signs off.

---

## 22. App-specific routes polish - 2026-11-10

**Branch:** `app-routes-polish` (from `main` at `a41f704`).
**Verdict:** `/vault`, `/receipts` and `/card/[token]` now use Foundation 2
only. No `.vpx` or `.vpx-soft` remains in the three route sources, and no shared
CSS changed.

### What landed

- **Vault:** `h2.sv-subheading` section headings at 20px default text; mint
  stays for the unlocked success line. Both amount fields and the passphrase
  use the existing 56px `.sv-input`, and the passphrase has a visible label.
  Movements are one grouped `PixelPanel` of 56px `Row`s with direction, status
  and amount; long status text wraps instead of truncating. The balance
  skeleton adds `motion-reduce:animate-none`. The no-vault panel is now an
  `h2`, so the shell owns the only `h1`. The load error is friendly
  (`Couldn't load your vault.` / `Try again in a moment.`) with a secondary
  Try again. The empty list reads `No movements yet.`.
- **Receipts:** snapshot rows are `PixelPanel tone="off"` and still have no
  hash or explorer link. The transfer anatomy is unchanged: hash, time,
  included-only explorer link, Check again while pending and Try again while
  expired. The load error is `Couldn't load receipts.` with a secondary Try
  again, and a 401 redirects to `/setup`.
- **Card:** the inner `.vpx-soft` box is a nested `PixelPanel tone="off"`; the
  outer card stays `tone="off"`. The page remains a public server component
  with no `ScreenShell`, wallet, session, balance or player wallet address.
  `getFlexCard`'s explicit columns and the 404 path are untouched.
- **No behaviour change:** `useVault`, the money handlers, polling, the receipt
  timeline shape, the API routes, SQL and the card contract are unchanged.
- **No shared CSS change:** the batch consumes `.sv-input`, `.sv-subheading`,
  `Row`, `PixelPanel tone="off"`, `Banner`, `Button` and `LoadingState` as they
  already exist.

### Verification

| Check | Result |
|---|---|
| `npm test` | 411 pass, 0 fail (396 before the batch) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 49 warnings, 0 errors |
| `npm run build` | exit 0; `/vault`, `/receipts` and `/card/[token]` compile |
| Legacy classes | no `vpx` in the three route sources |
| Type floor | minimum rendered font 12 |
| Audit | 36 rows (12 states x 360/390/430): `overflowX` 0, no wide element, no target below 44px, 236 focus stops all in view, uncovered and mint-outlined |

### Renders

36 after PNGs in `docs/superpowers/renders/app-routes/after/` and 9 before PNGs
in `.../before/` at 360/390/430. The review page is
`docs/superpowers/renders/app-routes/review/index.html`; `NOTES.md` carries the
sign-off list and deliberate choices. Raw audit is
`.../audit/final-audit.jsonl`.

Vault states: Deposit default, Withdraw unlocked, no vault, Withdraw locked,
empty movements, error, loading. Receipts states: mixed
included/pending/expired plus a snapshot, empty, error, loading. Card: valid. A
401 is source-tested rather than rendered.

### 360 behaviour

- The Vault movement status wraps under the direction rather than shrinking
  type or truncating; the row grows past 56px when needed.
- The passphrase label, 56px input and full-width Unlock button stack cleanly.
- The balance card's address breaks across two lines at 360.
- The Receipts snapshot drops the time to its own line at 360.
- The Card is unchanged in width: `max-w-90` with the page gutter, and the
  nested off-tone box keeps the same inner padding.

### Rulings

- **Tab shell for Vault.** It is a route in the `(tabs)` group, so it keeps the
  tab shell, Home back link and bottom nav rather than becoming a pushed screen.
- **Sub-heading, not a mint label.** Section headings move to the handoff's
  20px sub-heading role. Mint is reserved for success/progress/you.
- **`.sv-input` at 56px.** No compact variant and no shared CSS change.
- **Grouped movement panel.** One panel of rows matches Ranks and Economy; the
  per-item `.vpx-soft` cards are gone.
- **Friendly load errors.** Both Vault and Receipts stop printing raw HTTP
  statuses. Vault keeps its balance-banner network diagnostic because that
  explains a real chain failure.
- **401 redirects.** Receipts follows the other data screens with
  `router.replace('/setup')`, covered by a source contract.
- **Snapshots are off-tone panels.** A quiet panel reads as a different receipt
  type, and the row still cannot render a hash.
- **Card nested off tone.** The inner vault proof uses the same off tone as the
  card; its 2px outline and darker 4px shadow carry the sub-box. The page stays
  public and outside the tab shell.
- **Card render fixture.** Supabase is unavailable in the sandbox, so the valid
  card captures used a temporary uncommitted `getFlexCard` fixture, reverted
  before the final test/build. The committed tree keeps Supabase only.
- **Skeleton motion.** `motion-reduce:animate-none` gives the balance skeleton
  a static reduced-motion path without touching `globals.css`.
- **Audit false positive.** The first audit pass sampled the nav link outline
  30ms into `transition-colors`; waiting 200ms showed the 2px mint ring. The
  UI did not change.

### Revision - 2026-11-10

Three review corrections are in:

- **Deposit and Withdraw are tabs.** `Tabs` now sits below the balance, shields
  and banners, and only the selected form is visible. Deposit is the default; a
  receipt's `?direction=out` link opens Withdraw and prefills the amount. The
  tab is local state, not a URL parameter. Balance, banners and Recent
  movements stay on both tabs.
- **The passphrase moved inside Withdraw.** Selecting Withdraw while locked
  shows the `.sv-input` passphrase and Unlock vault in that tab. Deposit stays
  usable in its own tab. After unlock, Withdraw shows its action and the mint
  success line.
- **Banner spacing is a shared fix.** `.sv-banner` is a flex column with an 8px
  gap, and `.sv-banner > .sv-btn` adds 8px, so text lines are 8px apart and the
  action sits 16px below the text. Every screen gets the same rhythm; no local
  wrapper is needed.
- **Loading dots were already centred.** The first review images distorted
  them: the capture harness expanded the shell to take a full-page screenshot,
  which collapsed the body and pulled the dots toward the top. Loading states
  are now captured at viewport height, so the images show the real centre. No
  `LoadingState` code changed.

The revised renders add `vault-withdraw`; `vault-locked` now opens the Withdraw
tab. Verification after the revision is 411 tests, tsc clean, 49 lint warnings,
build green, and a 36-row audit (236 focus stops) with no overflow, no wide
element, no target below 44px and a 12px minimum font.

### Remaining

1. Real-device Nimiq Pay pass at 360-430 is the user's sign-off step; the
   sandbox has no `.env.local`.
2. Apply `supabase/FINAL-SCHEMA.sql` before deploying if the target database is
   behind.
3. Do not merge or push until the user signs off.


---

## 23. Missions API gaps - 2026-11-11

**Branch:** `missions-api-gaps` (from `main` at `2e67f75`).
**Verdict:** both Missions API gaps in section 19 are closed. Weekly XP is the
exact sum of the week's weekly mission rewards in all four server call sites,
Weekly Strategist carries an additive progress payload, AI wins no longer
count toward it, and the handoff's `1 of 2 wins` meter is on the row.

### What landed

- **One helper** (`src/lib/game/weekly-missions.ts`): the pure
  `sumWeeklyMissionXp` applies the UTC week window, dedupes by mission key,
  keeps only `missions.type = 'weekly'` definitions, sums the exact
  `xp_reward` values and clamps to `WEEKLY_MISSION_XP_CAP`. `weeklyMissionXp`
  reads `player_missions` and the mission definitions;
  `weeklyHumanWins` counts ranked/unranked battles where the player won,
  never AI.
- **All four call sites agree:** `/api/missions` `counters.weeklyXpEarned`,
  `/api/players/me` `player.weeklyXpEarnedThisWeek`, `settleMissions` cap
  headroom and the check-in route's `weeklyXpEarnedThisWeek` all call
  `weeklyMissionXp`. The `* 33` count approximations and the weekly
  `check_ins` read are gone.
- **Progress payload:** `progress: { current, target }` is additive and appears
  only on `weekly_strategist`. `current` is this UTC week's human wins clamped
  to the target; `target` is the new shared `WEEKLY_STRATEGIST_WINS = 2`.
- **AI and off-by-one fix:** `battleServer` now uses `weeklyHumanWins` and
  passes the count as-is. The old query included `ai` and subtracted one even
  though `completed_at < now` already excluded the battle being settled. The
  award now fires on the second human win, matching the meter.
- **Meter row:** `Meter` at 14px and 90px wide plus `N of 2 wins` replaces the
  Weekly Strategist description. Title + line + 8px row padding keeps the row
  at 58px. Completed rows keep the meter with `2 of 2 wins`, a muted label and
  muted XP. No shared CSS change.
- **Field names and shapes:** no existing API field was renamed or removed.
  Other mission items are byte-for-byte the same shape; the only addition is
  `progress` on the strategist item.

### Verification evidence

| Check | Result |
|---|---|
| `npm test` | 438 pass, 0 fail (412 before the test task; 411 at the branch base) |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, 49 warnings, 0 errors |
| `npm run build` | exit 0; `/missions` and both APIs compile |
| Type floor | no `text-[10px]` / `text-[11px]`; min rendered font 12 |
| Audit | 9 rows (3 states x 360/390/430): `overflowX: 0`, no wide elements, no interactive target below 44px, min font 12, every tab stop in view and uncovered with the 2px mint outline |
| Row | Weekly Strategist is 58px at 360/390/430; meter is 90x14 |

### 360 behaviour

- The 90px meter plus `0/1/2 of 2 wins` fits the Weekly Strategist content
  column at 360; the line wraps rather than overflowing if copy grows.
- The row stays 58px at 0, 1 and 2 wins. The Steady Saver description still
  wraps to about 73px; the strategist meter fits without growing.
- Nothing is truncated. The 2-win completed row keeps the meter and its muted
  label.

### Rulings

- **All four call sites, not two.** One weekly number means one helper. The
  source contract test fails if any consumer stops calling it or a `* 33`
  approximation returns.
- **Generic progress.** `{ current, target }` keeps the payload reusable and
  lets the UI render the target from the API. A named `weeklyWins` field would
  hardcode the target in the page.
- **Clamp, not raw.** A player with three wins sees `2 of 2`, never `3 of 2`.
- **Progress replaces the description.** The handoff draws the meter where the
  description would sit, and this keeps the 58px rhythm. Other rows are
  unchanged.
- **Completed rows keep the meter.** It is success/progress/you colour, and the
  muted label and XP carry the done state alongside the check.
- **AI wins are not human wins.** The evaluator already required
  `isHumanOpponent`; the query now matches it.
- **The settlement count is used as-is.** Keeping the old `- 1` would leave the
  meter at `2 of 2` while the mission only credited on the third win. Tests pin
  one prior win as the qualifying case.
- **No `weekly_xp` ledger.** The exact figure is derived from the existing
  mission credits and definitions; no SQL or schema change is needed.
- **No other state re-rendered.** The row change only affects the strategist
  row; the 2-win render is the completed row the all-done state would show.

### Renders

9 PNGs in `docs/superpowers/renders/missions-api/after/`
(`missions-strategist-{0,1,2}@{360,390,430}.png`), 3 pre-batch images in
`.../before/`, and the 9-row raw audit in `.../audit/final-audit.jsonl`. The
review page is `.../review/index.html`; `NOTES.md` holds the sign-off list and
deliberate choices.

### Remaining

1. The real-device Nimiq Pay pass at 360-430 is the user's sign-off step; the
   sandbox has no `.env.local`.
2. No live Supabase or Nimiq check was run; tests, build and fixture renders do
   not need one.
3. Do not merge or push until the user signs off.

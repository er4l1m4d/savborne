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
- Connection lost is an in-page state; polling continues.
- The check-in gate migration is manual and still needs the live acceptance run.

### Renders

45 PNGs in `docs/superpowers/renders/battle/after/` plus the Foundation 2 before pair in `docs/superpowers/renders/battle/before/`. The review page is `docs/superpowers/renders/battle/review/index.html`; raw audit is `docs/superpowers/renders/battle/audit/final-audit.jsonl`.

### Remaining

1. Apply `supabase/FINAL-SCHEMA.sql` to the live project and run the five-POST, concurrency and rate-limit acceptance checks.
2. The real-device Nimiq Pay pass at 360-430 is the user's final sign-off step.
3. Do not merge until the user signs off.

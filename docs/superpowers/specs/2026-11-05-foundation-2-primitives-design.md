# Savborne — Foundation 2: shared primitives and handoff corrections

**Date:** 2026-11-05
**Status:** design for review
**Batch:** Foundation 2 (batch 0 of the screen-port programme)
**Artefact of record:** `Savborne-handoff.html`
**Audit:** `docs/superpowers/audits/2026-11-05-ui-gap-audit.md`

---

## 1. Intent

The app already has the handoff's palette and bottom nav. It does not have the
handoff's screens because it does not have the handoff's **component
vocabulary**. Every page hand-rolls its own header, panels, buttons, rows and
tabs, so each screen drifts differently.

Foundation 2 makes the handoff's language executable:

- Build the shared primitives the handoff's screens are made from.
- Apply the global corrections the audit found (panel geometry, 12px type
  floor, coral primary CTA, focus rings, 44px targets).
- Migrate existing screens onto the primitives **without rebuilding their
  layouts**.

**Success:** after this batch, a later screen batch is layout work, not
architecture. The app looks like one system, even where a screen's layout has
not been rebuilt yet.

**This batch does not build any handoff screen.** It builds the vocabulary and
migrates the existing markup mechanically.

---

## 2. Decisions taken

| Decision | Choice |
|---|---|
| Panel geometry | Adopt the handoff's stepped `.pxw`/`.px` panels (3px stepped corners, 4px hard shadow, drop-shadow outline) |
| Primary CTA | Coral `#F2735A` with ground text for every advancing CTA; mint only for success/progress/you |
| Type | Enforce the handoff's 12px floor; 10px only for battle state labels |
| Batch order | Foundation 2 → Economy → Home → Battle → Onboarding → app-specific redesign |
| Settings destructive | Disconnect savings account + Delete account (Economy batch) |
| Disconnect behaviour | Clear local session and local vault key; return to setup; keep server profile and vault mapping |
| Display name | 16 chars for new names; existing longer names keep displaying |
| App-specific routes | Vault, Receipts, Card get redesigned to handoff patterns in the final batch |
| Delivery | One branch, one commit per primitive and one per migrated screen, before/after render per screen |
| Acceptance | Same structure, type scale, colours, spacing rhythm and states; not pixel-identical at 390px |
| Performance | Fidelity over performance: keep filter-based panels even with minor jank; measure and report on device; no silent fallback |
| Type overflow | Let screens scroll taller and drop secondary metadata; never truncate an action label or a value |

---

## 3. Scope

### In scope

1. New primitives:
   - `ScreenShell`
   - `PixelPanel`
   - `Button`
   - `Chip`
   - `Row`
   - `Tabs`
   - `Banner`
   - `BottomSheet`
   - `ResultPanel`
2. Global additions:
   - `.pxw` / `.px` panel classes
   - Type utilities and the 12px floor
   - Global `:focus-visible` rule
   - Motion utilities (press, sheet, dots, error-shake, xp-pop)
3. Mechanical migration of every existing route:
   - panel containers → `PixelPanel`
   - buttons → `Button`
   - 10/11px text → 12px+ by role
   - page frames → `ScreenShell`
4. A source-level type-floor test and a small panel-class test.
5. Before/after renders at 360 / 390 / 430 for every route.

### Out of scope

- No new routes. Settings, delete flow, Items, Bracket Climb, Withdrawal,
  First Check-in, Home checked-in, Ranked Locked, Queue Timeout, Connection
  Lost and Result screens belong to later batches.
- No layout rebuild of Home, Profile, Missions, Battle, Ranks or Setup.
  Their structure changes in their own batches.
- No character, item or battle-arena art extraction.
- No Vault, Receipts or Card redesign.
- No API, database, auth, vault, battle or deletion logic changes.
- No change to `PixelNav`; it already matches the handoff.

---

## 4. Design system additions

### 4.1 Panel geometry

Add to `src/app/globals.css`:

```css
.pxw {
  filter:
    drop-shadow(2px 0 0 var(--o))
    drop-shadow(-2px 0 0 var(--o))
    drop-shadow(0 2px 0 var(--o))
    drop-shadow(0 -2px 0 var(--o))
    drop-shadow(0 4px 0 var(--s));
}

.px {
  clip-path: polygon(
    0 6px, 3px 6px, 3px 3px, 6px 3px, 6px 0,
    calc(100% - 6px) 0, calc(100% - 6px) 3px,
    calc(100% - 3px) 3px, calc(100% - 3px) 6px, 100% 6px,
    100% calc(100% - 6px), calc(100% - 3px) calc(100% - 6px),
    calc(100% - 3px) calc(100% - 3px), calc(100% - 6px) calc(100% - 3px),
    calc(100% - 6px) 100%, 6px 100%,
    6px calc(100% - 3px), 3px calc(100% - 3px),
    3px calc(100% - 6px), 0 calc(100% - 6px)
  );
}
```

Usage rules:

| Element | Class/component | Why |
|---|---|---|
| Cards, panels, grouped containers | `PixelPanel` (`.pxw` + `.px`) | Stepped pixel panel, 4px hard shadow |
| Flat tiles, stat tiles | `.vpx-soft` (unchanged) | Handoff's flat tile: 2px border + 3px shadow, no stepped corners |
| Inputs, textareas | `.vpx` (unchanged) | Handoff inputs are square with 2px borders |
| Buttons | `Button` | Own wrapper, primary outline/shadow rules |
| Chips | `Chip` | 6px radius, 24px high |

`.vpx` is **deprecated for panel containers** and stays only for square
controls. A comment in `globals.css` records this so later batches do not
reintroduce it on panels.

### 4.2 Type scale

Add `sv-*` utilities to avoid colliding with Tailwind's `text-*`:

| Utility | Family / weight | Size / line-height | Use |
|---|---|---|---|
| `.sv-display` | Silkscreen 400 | 44 / 1.05 | `You win!`, result headlines |
| `.sv-heading` | Silkscreen 400 | 28 / 1.1 | Screen titles |
| `.sv-subheading` | Jakarta 800 | 20 / 1.2, -0.01em | Group headings (`Daily`, `Weekly`) |
| `.sv-body` | Jakarta 500 | 16 / 1.5 | Body copy |
| `.sv-label` | Jakarta 700 | 13 / 1.4 | Labels, row titles, captions |
| `.sv-figure` | Jakarta 700 | 13 / 1.3, tabular | Figures, chips, XP values |
| `.sv-number-xl` | Silkscreen 400 | 36 / 1 | NIM balance |
| `.sv-number-m` | Silkscreen 400 | 24 / 1 | `+30 XP`, stat values |
| `.sv-section-label` | Jakarta 700 | 12 / 1.3, 0.1em uppercase | `ACCOUNT`, `PREFERENCES` |
| `.sv-state` | Jakarta 700 | 10 / 1.2, 0.08em uppercase | Battle state labels only |

**Floor:** no text below 12px except `.sv-state`. Replace all `text-[10px]` and
`text-[11px]` uses by role:

- section label → `.sv-section-label`
- caption/metadata → `.sv-label` or `text-xs`
- figure/chip → `.sv-figure`
- battle state label → `.sv-state`
- decorative index in a word grid → `.sv-figure` (12px); the grid may need to
  reflow to 2 columns at 360px

When the floor causes overflow at 360px, the rule is:

1. Let the screen scroll taller.
2. Drop secondary metadata (duplicate captions, extra rank lines, repeated
   reset text).
3. Never truncate an action label, a balance, an XP value or a row title.

### 4.3 Primary action classification

Approved table. Every existing button is classified during migration.

| Treatment | Actions |
|---|---|
| **Coral primary (64px)** | Get started, Create my vault, Continue, Start playing, Check in, Deposit, Withdraw, Find ranked match, Fight AI, Create challenge, Accept challenge, Delete everything (final confirm), Try again, Unlock / Reveal / Verify words |
| **Mint success / progress** | "Checked in just now", XP / level-up confirmations, "Deposit received", "Vault unlocked", progress bars, level chip, "You" tag |
| **Secondary surface (56px)** | Back, Cancel, Copy, Share, Show recovery phrase, Change passphrase, Restore, Defend, Use item, Battle again |
| **Destructive row (warn-fill)** | Delete account, Disconnect savings account |
| **Icon (44×44)** | Back, Settings, Leave battle |
| **Ghost/text** | Inline back links, "Cancel", "Show tour again" |

Battle move order follows the handoff: Attack = coral primary; Defend and Use
item = secondary; Special Move = off/disabled with cooldown note.

### 4.4 Focus and touch

Global rule:

```css
:where(a, button, input, textarea, select, [tabindex]):focus-visible {
  outline: 2px solid var(--mint);
  outline-offset: 2px;
}
```

- Remove `outline-none` from inputs; keep the mint focus border only as an
  additional cue.
- Minimum touch target: 44px. Icon buttons are exactly 44×44. Text links that
  are primary actions become `Button variant="ghost"` with a 44px hit area.
- Disabled controls keep the off palette and `cursor: not-allowed`.

### 4.5 Motion

Add utilities:

- `.sv-press` — 80ms `translateY(4px)` and shadow removal on `:active`.
- `.sv-sheet` — 180ms slide-up.
- `.sv-dots` — searching dots.
- `.sv-shake` — error shake.
- `.sv-pop` — xp/level pop.

All collapse under `prefers-reduced-motion: reduce` via the existing token
guard. No new animation runs without a reduced-motion path.

---

## 5. Primitives

### 5.1 `ScreenShell`

```tsx
type ScreenShellProps = {
  variant?: 'tab' | 'pushed'
  title?: string
  backHref?: string
  actions?: React.ReactNode
  children: React.ReactNode
}
```

Rules:

- `tab`: 36px header row. `title` renders Silkscreen 28px. `actions` sits right.
  Home passes the icon + wordmark as `actions`/custom header content; Profile
  passes the settings icon.
- `pushed`: 44px header row. 44×44 back icon button, Silkscreen 28px title,
  optional `actions` right.
- Body: `padding: 20px 22px 0`, `display: flex; flex-direction: column;
  gap: 16px` (Missions may pass `gap-3.5`).
- Header is fixed; the body is the scroll region. The shell uses
  `min-height: 0` and `overflow-y: auto`.
- The tabs layout keeps owning the bottom nav and its space. `ScreenShell` does
  **not** add nav padding inside the tabs group.
- Pushed screens outside the tabs group add bottom safe-area/gutter inside the
  shell.
- Back destinations in this batch:
  - `/vault` → `/`
  - `/receipts` → `/vault`
  - `/battle/[id]` → `/battle`
  - `/setup/vault` → `/vault`
  - `/setup` keeps its internal step back buttons; no route back icon.
  - `/card/[token]` has no back icon.

### 5.2 `PixelPanel`

```tsx
type Tone = 'default' | 'mint' | 'coral' | 'cream' | 'off'
type PixelPanelProps = {
  tone?: Tone
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}
```

Tones:

| Tone | Outline `--o` | Shadow `--s` | Background |
|---|---|---|---|
| `default` | `--bevel` `#C9C1A8` | `--bevel-shadow` `#2E4642` | `--surface` `#151F1D` |
| `mint` | `--mint` `#6FD0AE` | `--bevel-shadow` | `--surface` |
| `coral` | `--coral` `#F2735A` | `--bevel-shadow` | `--coral-tint` `#2A1B18` |
| `cream` | `--fg` `#F3EEDD` | `#8E866E` | `--fg` |
| `off` | `--off` `#4B5A56` | `#1B2624` | `--surface-low` `#101A18` |

The component renders the wrapper and inner div. `className` is applied to the
inner div, so existing padding/background utilities keep working.

### 5.3 `Button`

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'icon'
type ButtonSize = 'lg' | 'md' | 'sm' | 'move'
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}
```

| Variant | Height | Fill | Text | Outline | Shadow |
|---|---|---|---|---|---|
| `primary` | 64 (`lg`) | `--coral` | `--shell` | `--cream` | `--coral-edge` |
| `secondary` | 56 (`md`) | `--surface` | `--fg` | `--bevel` | `--bevel-shadow` |
| `destructive` | 56 (`md`) | `--coral-tint` | `--coral-text` | `--coral` | `--coral-edge` |
| `ghost` | 44 min | transparent | `--fg-muted` | none | none |
| `icon` | 44 (`sm`) | `--surface` | `--fg` | `--bevel` | `--bevel-shadow` |

- `size="move"` = 84px, used with `primary`/`secondary`/off.
- `loading` renders the label plus `.sv-dots` and disables the button.
- Pressed: `.sv-press` (translateY 4px, shadow removed).
- Disabled: off fill, off outline, muted text, `not-allowed`.
- `fullWidth` defaults to `true` for primary/secondary/destructive; `false` for
  icon/ghost.
- Focus comes from the global `:focus-visible` rule.

### 5.4 `Chip`

```tsx
type ChipProps = {
  variant?: 'outline' | 'fill'
  color?: string
  children: React.ReactNode
}
```

- 24px high, `padding: 0 10px`, inline-flex, 6px radius, 2px border, 12px/700
  tabular.
- `outline`: border `--bevel`, text `--fg` or `color`.
- `fill`: mint fill, ground text.
- Replaces the current 32px `vpx-soft` chip spans.

### 5.5 `Row`

```tsx
type RowProps = {
  leading?: React.ReactNode
  trailing?: React.ReactNode
  divider?: boolean
  minHeight?: 56 | 58
  children: React.ReactNode
}
```

- `display: flex; align-items: center; gap: 14px; min-height: 58px` (56 for
  rank rows).
- Divider: `border-bottom: 2px solid var(--track)`; last row none.
- The parent `PixelPanel` provides horizontal padding (`2px 16px` for grouped
  rows).
- Used by Settings, Missions, Ranks and any grouped list.

### 5.6 `Tabs`

```tsx
type TabItem = { value: string; label: string }
type TabsProps = {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}
```

- Two equal 44px buttons, 2px border, 14px/700.
- Selected: mint fill, ground text, mint border.
- Unselected: surface fill, text, line border.
- `role="tablist"`, `role="tab"`, `aria-selected`.

### 5.7 `Banner`

```tsx
type BannerProps = {
  tone?: 'error' | 'info'
  children: React.ReactNode
}
```

- `error`: warn-fill background, 2px coral border, coral-text, padding 14px,
  600 weight.
- `info`: surface background, 2px mint border, text, same padding.
- Replaces the ad-hoc `vpx bg-coral-tint` notes.

### 5.8 `BottomSheet`

```tsx
type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}
```

- Fixed scrim `rgba(12,18,17,.7)`.
- Panel: surface, top 2px `--bevel` outline, 22px gutter, max-height 80dvh,
  scroll inside.
- 180ms slide-up; reduced-motion instant.
- Focus trap, Escape closes, body scroll lock.
- `role="dialog"`, `aria-modal="true"`.
- First consumers: delete confirmation (Economy), item sheet (Battle).

### 5.9 `ResultPanel`

```tsx
type ResultTile = { label: string; value: string }
type ResultPanelProps = {
  title: string
  tone: 'mint' | 'coral' | 'cream'
  tiles: ResultTile[]
  unlocks?: React.ReactNode[]
  actions: React.ReactNode
}
```

- Headline `.sv-display`, colour by tone.
- Tiles: flat `.vpx-soft` tiles, `.sv-number-m` value, `.sv-label` label.
- Unlock list: icon + name + blurb.
- Actions: primary + secondary buttons.
- First consumers: Bracket Climb (Economy) and Battle results (Battle).

---

## 6. Migration rules

### 6.1 Panels

- `vpx bg-surface ...` on a card → `<PixelPanel className="bg-surface ...">`.
- `vpx bg-surface-low` on a card → `<PixelPanel tone="off" ...>` only if it is
  an inset panel; otherwise keep the background class.
- `vpx-soft` on flat tiles stays `.vpx-soft`.
- Inputs/textareas keep `.vpx`.
- Do not leave `.vpx` on a panel container.

### 6.2 Buttons

- Apply the approved table.
- Remove `active:translate-y-0.5`, ad-hoc `style={{ boxShadow: ... }}` and
  `bg-mint`/`bg-coral` from buttons that become `Button`.
- Keep button copy unchanged unless a screen batch is rewriting it.
- Keep `disabled`, `aria-*`, `type`, `onClick` and loading labels.

### 6.3 Type

- Replace `text-[10px]`/`text-[11px]` by role (section 4.2).
- Replace `text-3xl` Silkscreen headings with `.sv-heading`.
- Replace `text-3xl` Jakarta figures with `.sv-number-xl` or `.sv-number-m`.
- Body copy becomes `.sv-body` (16/1.5). This may make some panels taller; that
  is expected. Drop secondary metadata where the screen gets too tall at 360px.
- Keep `.num` for tabular figures; it composes with `.sv-figure`.

### 6.4 Headers and padding

- Every page adopts `ScreenShell`.
- Remove the page's own `p-(--gut)`, `mt-4`, `max-w-105`, `min-h-dvh` and
  header markup; the shell owns them.
- The tabs layout keeps `paddingBottom: calc(var(--nav-h) + safe-area)`; the
  shell does not duplicate it.
- Pushed screens outside the tabs group get the shell's bottom safe-area.

### 6.5 Inputs

- Keep `.vpx` square border.
- Remove `outline-none`; the global focus ring applies.
- Keep `focus:border-butter` only as an extra cue, or replace with a mint
  border if butter reads as a second accent. The spec recommends mint for
  consistency with the focus ring.

### 6.6 Delete account during this batch

- Keep the flow inline at the bottom of Profile.
- Migrate its panels/buttons/type to the primitives.
- Do **not** move it to Settings or create `/settings/delete` until Economy.

---

## 7. Verification

### Automated

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- New `src/lib/type-floor.test.ts`: scans `src/**/*.tsx` for `text-[10px]` and
  `text-[11px]` and fails unless the line also uses `.sv-state`. The test
  prints file and line.
- New `src/lib/panels.test.ts`: asserts `globals.css` contains `.pxw` and `.px`
  with the stepped polygon, and that `.vpx` still exists for inputs.
- Existing `src/lib/tokens.test.ts` and nav tests stay green.

### Visual

- Render every route at 360, 390 and 430:
  `/`, `/missions`, `/battle`, `/leaderboard`, `/profile`, `/vault`,
  `/receipts`, `/setup`, `/setup/vault`, `/battle/[id]`, `/card/[token]`.
- Save before/after renders under `docs/superpowers/renders/foundation-2/`.
- Show each screen's before/after in its commit message or the batch summary.
- The phone remains the final measure; test at least one real device.

### Accessibility

- Keyboard pass: every interactive element reachable, focus ring visible.
- 44px target audit.
- 12px floor audit (automated + visual).
- Contrast stays as measured in the foundation spec.

---

## 8. Risks

| Risk | Decision / mitigation | Status |
|---|---|---|
| Large diff | One branch, one commit per primitive and per screen, before/after render per screen | Closed |
| Coral primary misclassification | Approved table in §4.3; every button classified during migration | Closed |
| Type-floor overflow at 360px | Scroll taller, drop secondary metadata, never truncate action labels/values | Closed |
| `clip-path` + `drop-shadow` jank | Fidelity over performance: keep the filters, measure on device, report; no silent fallback | Accepted |
| Double padding after `ScreenShell` | Shell owns header/body/scroll; tabs layout owns nav; remove old page padding | Closed |
| Inputs lose their square look | `.vpx` stays on inputs; only panels move to `PixelPanel` | Closed |
| Bottom sheet traps focus incorrectly | Focus trap, Escape, scroll lock, `aria-modal`; test with keyboard | Mitigated |
| Type utility names collide with Tailwind | Use `sv-*` prefixes, not `text-*` | Closed |
| Migration changes behaviour | No API/logic changes; only markup/classes; verify flows manually | Mitigated |

---

## 9. Later batches (not this spec)

| Batch | Contents |
|---|---|
| **Economy** | Profile, Items, Missions, Bracket Climb, Withdrawal, Settings (Disconnect + Delete), `/settings/delete` flow |
| **Home** | Home, Home checked-in, character card, delta chip, streak tick |
| **Battle** | Menu, Ranked Locked, Daily Limit, Queue, Timeout, Friend Wait, Battle, Wait, Results, Connection Lost, item sheet |
| **Onboarding** | Welcome, Connect/vault, Privacy, Name, First Check-in, Gate, Preparing, Update Pay, Balance Error |
| **App-specific** | Vault, Receipts, Card redesigned to handoff patterns |

---

## 10. Open questions

None blocking this batch. Deferred decisions:

- Exact back destinations for app-specific screens are settled in their batch.
- Disconnect confirmation copy and delete-flow copy are settled in Economy.
- Character/item/battle art extraction is settled in Home/Battle.
- Whether to add a visual-regression tool is deferred; manual renders are the
  gate for this batch.

# Foundation 2 — Shared Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The tasks share CSS and component interfaces and are tightly coupled, so native execution is recommended. Subagent-driven execution is possible but will need the same contract discipline.

**Goal:** Build the handoff's shared component vocabulary, apply the global corrections the audit found, and migrate every existing route onto those primitives without rebuilding its layout.

**Architecture:** Add the handoff's stepped panel geometry, type scale, focus rule and motion utilities to `globals.css`, then build nine thin primitives under `src/components/ui/`. Migrate one screen per commit, removing each screen from a temporary type-floor allowlist as it is cleaned. No API, database, auth, vault, battle or deletion logic changes.

**Tech Stack:** Next.js 16.4 (App Router), React 19.3, TypeScript 5, Tailwind CSS 4, Node's built-in test runner (`node --import tsx --test`).

**Spec:** `docs/superpowers/specs/2026-11-05-foundation-2-primitives-design.md`

**Audit:** `docs/superpowers/audits/2026-11-05-ui-gap-audit.md`

---

## Global Constraints

- **Panel geometry:** cards, panels and grouped containers use `.pxw` + `.px` (3px stepped corners, 4px hard shadow). Flat tiles keep `.vpx-soft`. Inputs and textareas keep `.vpx`. Never leave `.vpx` on a panel container.
- **Type floor:** no text below 12px except `.sv-state` (10px), used only for battle state labels. Replace every `text-[10px]` and `text-[11px]` by role.
- **Primary CTA:** coral `#F2735A` with ground text for every advancing action. Mint is reserved for success, progress, level and "you".
- **Touch targets:** minimum 44px. Icon buttons are exactly 44×44. Inline primary actions become ghost buttons with a 44px hit area.
- **Inline buttons:** `Button` defaults to full width for primary/secondary/destructive. Any action inside a header, a row, a button pair or the tour must pass `fullWidth={false}`; only form and advancing CTAs stay full width.
- **Focus:** the global `:where(a, button, input, textarea, select, [tabindex]):focus-visible` ring is the only focus cue. Remove `outline-none` from inputs.
- **Type overflow at 360px:** scroll taller, drop secondary metadata, never truncate an action label, balance, XP value or row title.
- **Motion:** every animation has a reduced-motion path. No new animation without one.
- **Scope:** no new routes, no layout rebuild of Home/Profile/Missions/Battle/Ranks/Setup, no art extraction, no `PixelNav` change, no API/DB/auth/vault/battle/deletion logic change.
- **Delivery:** one branch, one commit per primitive and one per migrated screen, before/after renders in each screen commit.
- **Renders:** PNGs are committed evidence under `docs/superpowers/renders/foundation-2/`. The capture harness is throwaway, outside the repo.
- **Tests:** source-level only. Do not add a React test renderer.
- **Untracked user work:** never stage `AGENTS.md`, `assets/character-glows.json`, `scripts/character-glow.mjs` or `scripts/glow-ship.mjs`.

## Review Focus

These are the five input classes the spec implies but no task's own tests exercise directly. Each gets a test in the task that owns the code.

1. **Legacy display names up to 32 characters** must not push the shell header's actions off-screen. `.sv-shell__title` gets `min-width: 0` and `overflow-wrap: anywhere`; the ScreenShell test pins both.
2. **A 64-character tx hash or a 95-character vault address at 360px** must wrap inside its panel and never cause horizontal scroll. `.sv-break` gets `overflow-wrap: anywhere`; the panels test pins it and every hash/address element uses it.
3. **A BottomSheet with no focusable children** must still close on Escape and must not let focus escape to the page behind it. The BottomSheet test pins the empty-list fallback and the Escape handler.
4. **Reduced motion must stop the looping loading dots entirely**, not merely run them at 0.01ms. The panels test pins `.sv-dots span { animation: none }` inside the reduced-motion block.
5. **A focused control near the bottom of a scrolled ScreenShell body** must not hide under the fixed header or nav. `.sv-shell__body` gets `scroll-padding-top` and `scroll-padding-bottom`; the ScreenShell test pins both.

---

## File Structure

**New files**

- `src/components/ui/Button.tsx` — `Button`, `ButtonLink`, shared class resolver.
- `src/components/ui/PixelPanel.tsx` — `.pxw` wrapper + `.px` inner, tone variables.
- `src/components/ui/ScreenShell.tsx` — header + scroll body + back icon.
- `src/components/ui/Chip.tsx` — 24px outline/fill chip.
- `src/components/ui/Row.tsx` — 56/58px grouped-list row.
- `src/components/ui/Tabs.tsx` — controlled two-up tablist.
- `src/components/ui/Banner.tsx` — error/info note.
- `src/components/ui/BottomSheet.tsx` — focus-trapped modal sheet.
- `src/components/ui/ResultPanel.tsx` — result headline, tiles, unlocks, actions.
- `src/lib/type-floor.test.ts` — source scan for sub-12px text.
- `src/lib/panels.test.ts` — CSS contracts for panels, type, focus, motion.
- `src/lib/ui-primitives.test.ts` — one contract test appended per primitive.

**Modified files**

- `src/app/globals.css` — tokens, `.pxw`/`.px`, `sv-*` type utilities, focus, motion, primitive classes.
- `src/app/(tabs)/page.tsx`, `missions/page.tsx`, `battle/page.tsx`, `leaderboard/page.tsx`, `profile/page.tsx`, `vault/page.tsx`.
- `src/app/receipts/page.tsx`, `src/app/battle/[id]/page.tsx`, `src/app/setup/page.tsx`, `src/app/setup/vault/page.tsx`, `src/app/card/[token]/page.tsx`.
- `src/components/DeleteAccount.tsx`, `src/components/VaultTour.tsx`, `src/components/VersionGate.tsx`.
- `src/components/vault/BackupSettings.tsx`, `BackupQuiz.tsx`, `CopyButton.tsx`, `PassphraseField.tsx`, `PhraseCeremony.tsx`.

**No change:** `src/app/(tabs)/layout.tsx`, `src/components/PixelNav.tsx`, `src/lib/nav.ts`, all `src/app/api/**`, all `src/lib/game/**`, `src/lib/vault/**` logic.

---

## Task 0: Baseline, capture harness and before renders

**Files:**
- Create (repo): `docs/superpowers/renders/foundation-2/before/*.png`
- Create (throwaway, not committed): `%TEMP%/opencode/capture-ui.mjs`

**Interfaces:**
- Consumes: the running app, the existing `%TEMP%/opencode/capture.mjs` CDP pattern.
- Produces: 33 before PNGs (11 routes × 360/390/430) and a reusable route list the later tasks use for after renders.

- [ ] **Step 1: Create the branch and confirm the baseline**

```powershell
git checkout main
git pull --ff-only
git checkout -b feat/foundation-2-primitives
npm test
```

Expected: 182 tests pass, 0 fail. Record the count in the branch's first commit message.

- [ ] **Step 2: Write the throwaway capture harness**

Copy `%TEMP%/opencode/capture.mjs` to `%TEMP%/opencode/capture-ui.mjs` and extend it. It must:

- Accept `--route <path> --width <360|390|430> --out <png>` and `--all --outDir <dir>`.
- Launch headless Chrome with CDP on a random port and a fresh `--user-data-dir`.
- Inject before any page script:
  - `window.nimiqPay = { language: 'en' }`.
  - `window.nimiq` with a provider whose `getBalance` is a function and whose `listAccounts` returns `['NQ07 0000 0000 0000 0000 0000 0000 0000 0000']`.
  - A `<style>nextjs-portal{display:none!important}</style>`.
  - `localStorage` seeds for routes that need a session (see the fixture table below).
- Intercept and fulfil `/api/**` with the fixture table below; leave `/card/**` alone.
- Set `Emulation.setDeviceMetricsOverride` to the requested width, height 844, deviceScaleFactor 2, mobile true.
- Wait for `document.fonts.ready` plus 400ms, then capture the viewport.
- Fail loudly if the page contains the text `Open inside Nimiq Pay` or `Preparing Savborne…`.

Fixture table (response JSON unless stated):

| Route | Fixtures |
|---|---|
| `/` | `/api/players/me` with `player` = level 4, 120 XP, 1.25 NIM, 6-day streak, 1 shield, 9 check-ins, bracket `bronze`; `/api/missions` with two daily missions and both `xp_reward` and `xpReward` keys |
| `/missions` | `/api/missions` with daily/weekly/one-time missions and counters |
| `/battle` | `/api/players/me` with `battlesToday: 1` |
| `/leaderboard` | `/api/leaderboards` with 5 rows, one `isMe`, one `verifiedSaver` |
| `/profile` | `/api/profile` with player, ownedItems, activeBadges, cardToken |
| `/vault` | `/api/vaults` with a vault; `/api/transfers` → `{ transfers: [] }`; RPC stub for `rpc.nimiqwatch.com` (`getAccountByAddress` → `{result:{data:{balance}}}`, `getBlockNumber` → `{result:{data:123456}}`) |
| `/receipts` | `/api/receipts` with one included transfer, one pending transfer, one expired transfer, one snapshot |
| `/battle/test-battle` | `/api/battles/test-battle` with an active battle, both sides, one last turn |
| `/setup` | wallet stub only; no API |
| `/setup/vault` | wallet stub + `localStorage` session |
| `/card/<token>` | no API; real Supabase row |

`localStorage` seeds:

```js
localStorage.setItem('savborne.session.v1', JSON.stringify({
  playerAddress: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
  savingsAddress: 'NQ07 1111 1111 1111 1111 1111 1111 1111 1111',
  displayName: 'Ada the Saver',
}))
localStorage.setItem('savborne.tour.v1', 'done')
```

Give every route a default `/api/players/me` fixture and a **non-null** `/api/vaults` fixture. `VaultGuard` runs in the tabs layout and redirects to `/vault` whenever `/api/vaults` returns `{ vault: null }`; a missing fixture would therefore turn every tabs render into a Vault render. The table's route-specific rows override these defaults.

- [ ] **Step 3: Find or create the card fixture**

Query the dev database for a real `vaults.card_token`:

```powershell
node --env-file=.env.local -e "import('@supabase/supabase-js').then(async ({createClient})=>{const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const {data,error}=await s.from('vaults').select('card_token').limit(1);if(error)throw error;console.log(data?.[0]?.card_token??'')})"
```

If it prints a token, use it. If it prints nothing, insert a temporary fixture with the service role:

```js
const address = 'NQ07 2222 2222 2222 2222 2222 2222 2222 2222'
const token = 'f0dda2b0-0000-4000-8000-000000000002'
await db.from('players').insert({
  address,
  savings_account_address: address,
  display_name: 'Ada the Saver',
  level: 4,
  xp: 120,
  bracket: 'bronze',
  streak_current: 6,
  shields: 1,
})
await db.from('vaults').insert({
  address: 'NQ57 2F6C 1111 2222 3333 4444 5555 6666 7777 8888',
  player_address: address,
  network: 'testnet',
  card_token: token,
  backup_verified_at: new Date().toISOString(),
})
```

Delete both rows in a `finally` after the card capture. Never leave the fixture behind.

- [ ] **Step 4: Capture the before renders**

Start `npm run dev` in the background, wait for `http://localhost:3000`, then:

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --all --outDir docs/superpowers/renders/foundation-2/before
```

Expected: 33 PNGs named `<slug>@<width>.png`, where slugs are `home`, `missions`, `battle`, `ranks`, `profile`, `vault`, `receipts`, `setup`, `setup-vault`, `battle-detail`, `card`. Inspect all 33; no route may show a gate, spinner-only state or an error banner caused by the harness.

- [ ] **Step 5: Commit the before renders**

```powershell
git add docs/superpowers/renders/foundation-2/before
git commit -m "chore: capture foundation 2 before renders (baseline 182 tests)"
```

---

## Task 1: CSS foundation and guards

**Files:**
- Modify: `src/app/globals.css`
- Test: `src/lib/panels.test.ts`
- Test: `src/lib/type-floor.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `.pxw`, `.px`, `[data-tone]` panel variables, `.sv-panel`, `.sv-*` type utilities, `.sv-break`, focus rule, motion classes, and the two guard tests every later task runs.

- [ ] **Step 1: Write the failing panel/type/focus/motion test**

Create `src/lib/panels.test.ts` with five tests:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

function block(selector: string): string {
  // Match the selector at the start of a line so `.px` does not match `.pxw`.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{`).exec(CSS)
  assert.ok(match, `${selector} is missing`)
  const open = match.index + match[0].length - 1
  const close = CSS.indexOf('}', open)
  return CSS.slice(open + 1, close)
}

test('stepped panel geometry exists', () => {
  const pxw = block('.pxw')
  assert.match(pxw, /drop-shadow\(2px 0 0 var\(--o\)\)/)
  assert.match(pxw, /drop-shadow\(0 4px 0 var\(--s\)\)/)
  const px = block('.px')
  assert.match(px, /clip-path:\s*polygon\(/)
  assert.match(px, /3px 6px/)
  assert.match(px, /calc\(100% - 6px\)/)
})

test('.vpx survives for square controls and is marked deprecated for panels', () => {
  assert.match(block('.vpx'), /border:\s*2px solid var\(--bevel\)/)
  assert.match(CSS, /deprecated for panel containers/i)
})

test('the sv type scale meets the floor except sv-state', () => {
  const sizes: Record<string, number> = {
    '.sv-display': 44,
    '.sv-heading': 28,
    '.sv-subheading': 20,
    '.sv-body': 16,
    '.sv-label': 13,
    '.sv-figure': 13,
    '.sv-number-xl': 36,
    '.sv-number-m': 24,
    '.sv-section-label': 12,
    '.sv-state': 10,
  }
  for (const [selector, size] of Object.entries(sizes)) {
    assert.match(block(selector), new RegExp(`font-size:\\s*${size}px`), selector)
  }
  assert.match(block('.sv-break'), /overflow-wrap:\s*anywhere/)
})

test('the global focus ring is present', () => {
  assert.match(
    CSS,
    /:where\(a, button, input, textarea, select, \[tabindex\]\):focus-visible\s*\{[^}]*outline:\s*2px solid var\(--mint\)/s,
  )
  assert.match(CSS, /outline-offset:\s*2px/)
})

test('every motion class has a reduced-motion path', () => {
  for (const selector of ['.sv-press', '.sv-sheet', '.sv-dots', '.sv-shake', '.sv-pop']) {
    assert.match(CSS, new RegExp(selector.replace('.', '\\.')), selector)
  }
  // The file already has one reduced-motion block near the tokens; the
  // Foundation 2 block is the last one and is the one under test.
  const media = CSS.slice(CSS.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(media, /\.sv-sheet/)
  assert.match(media, /\.sv-dots span[^}]*animation:\s*none/)
  assert.match(media, /\.sv-shake/)
  assert.match(media, /\.sv-pop/)
  assert.match(media, /\.sv-press:active/)
  assert.match(media, /--t-dots/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test src/lib/panels.test.ts`
Expected: FAIL on the missing `.pxw` block.

- [ ] **Step 3: Add the CSS foundation**

Append to `src/app/globals.css` (and add `--t-dots: 1s; --t-shake: 300ms;` to `:root` and the reduced-motion token block):

```css
/* ── Foundation 2: stepped panels ─────────────────────────────────────── */
@layer components {
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

  .sv-panel { background: var(--surface); }
  .pxw[data-tone='default'] { --o: var(--bevel); --s: var(--bevel-shadow); }
  .pxw[data-tone='mint']    { --o: var(--mint);  --s: var(--bevel-shadow); }
  .pxw[data-tone='coral']   { --o: var(--coral); --s: var(--bevel-shadow); }
  .pxw[data-tone='cream']   { --o: var(--fg);    --s: #8E866E; }
  .pxw[data-tone='off']     { --o: var(--off);   --s: #1B2624; }
  .pxw[data-tone='coral'] > .px { background: var(--coral-tint); }
  .pxw[data-tone='cream'] > .px { background: var(--fg); color: var(--shell); }
  .pxw[data-tone='off']   > .px { background: var(--surface-low); }
}

/* `.vpx` is deprecated for panel containers. Keep it for square controls
   (inputs, textareas) only; panels use `.pxw` + `.px`. */

/* ── Foundation 2: type scale ─────────────────────────────────────────── */
@layer components {
  .sv-display      { font-family: var(--font-silkscreen); font-weight: 400; font-size: 44px; line-height: 1.05; }
  .sv-heading      { font-family: var(--font-silkscreen); font-weight: 400; font-size: 28px; line-height: 1.1; }
  .sv-subheading   { font-family: var(--font-jakarta); font-weight: 800; font-size: 20px; line-height: 1.2; letter-spacing: -0.01em; }
  .sv-body         { font-family: var(--font-jakarta); font-weight: 500; font-size: 16px; line-height: 1.5; }
  .sv-label        { font-family: var(--font-jakarta); font-weight: 700; font-size: 13px; line-height: 1.4; }
  .sv-figure       { font-family: var(--font-jakarta); font-weight: 700; font-size: 13px; line-height: 1.3; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }
  .sv-number-xl    { font-family: var(--font-silkscreen); font-weight: 400; font-size: 36px; line-height: 1; }
  .sv-number-m     { font-family: var(--font-silkscreen); font-weight: 400; font-size: 24px; line-height: 1; }
  .sv-section-label{ font-family: var(--font-jakarta); font-weight: 700; font-size: 12px; line-height: 1.3; letter-spacing: 0.1em; text-transform: uppercase; }
  .sv-state        { font-family: var(--font-jakarta); font-weight: 700; font-size: 10px; line-height: 1.2; letter-spacing: 0.08em; text-transform: uppercase; }
  .sv-break        { overflow-wrap: anywhere; word-break: break-word; }
}

/* ── Foundation 2: focus ──────────────────────────────────────────────── */
:where(a, button, input, textarea, select, [tabindex]):focus-visible {
  outline: 2px solid var(--mint);
  outline-offset: 2px;
}

/* ── Foundation 2: motion ─────────────────────────────────────────────── */
@keyframes sv-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes sv-dot { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
@keyframes sv-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-3px); }
  40%, 60% { transform: translateX(3px); }
}
@keyframes sv-pop {
  0% { transform: scale(0.9); opacity: 0; }
  60% { transform: scale(1.04); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.sv-press { transition: transform var(--t-press) var(--ease), box-shadow var(--t-press) var(--ease); }
.sv-press:active { transform: translateY(4px); box-shadow: none; }
.sv-sheet { animation: sv-sheet-in var(--t-enter) var(--ease); }
.sv-dots { display: inline-flex; gap: 3px; }
.sv-dots span { width: 4px; height: 4px; background: currentColor; animation: sv-dot var(--t-dots) infinite; }
.sv-dots span:nth-child(2) { animation-delay: 0.15s; }
.sv-dots span:nth-child(3) { animation-delay: 0.3s; }
.sv-shake { animation: sv-shake var(--t-shake) var(--ease); }
.sv-pop { animation: sv-pop var(--t-pop) var(--ease); }

@media (prefers-reduced-motion: reduce) {
  :root {
    --t-press: 0.01ms;
    --t-enter: 0.01ms;
    --t-fill: 0.01ms;
    --t-pop: 0.01ms;
    --t-dots: 0.01ms;
    --t-shake: 0.01ms;
  }
  .sv-sheet, .sv-shake, .sv-pop, .sv-dots span { animation: none; }
  .sv-press:active { transform: none; }
}
```

- [ ] **Step 4: Run the panel test and confirm it passes**

Run: `node --import tsx --test src/lib/panels.test.ts`
Expected: 5 pass, 0 fail.

- [ ] **Step 5: Write the type-floor guard**

Create `src/lib/type-floor.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../', import.meta.url))

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

/** Files still waiting for their migration commit. This list must be empty at the end. */
const PENDING = new Set([
  'app/(tabs)/page.tsx',
  'app/(tabs)/missions/page.tsx',
  'app/(tabs)/battle/page.tsx',
  'app/(tabs)/leaderboard/page.tsx',
  'app/(tabs)/profile/page.tsx',
  'app/(tabs)/vault/page.tsx',
  'app/receipts/page.tsx',
  'app/battle/[id]/page.tsx',
  'app/setup/page.tsx',
  'app/card/[token]/page.tsx',
  'components/DeleteAccount.tsx',
  'components/VaultTour.tsx',
  'components/vault/PhraseCeremony.tsx',
  'components/vault/BackupSettings.tsx',
])

function violations() {
  const out: { file: string; line: number; text: string }[] = []
  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length).replaceAll('\\', '/')
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((text, i) => {
      if (/text-\[(?:10|11)px\]/.test(text) && !text.includes('sv-state')) {
        out.push({ file: rel, line: i + 1, text: text.trim() })
      }
    })
  }
  return out
}

test('no text below 12px outside .sv-state', () => {
  const bad = violations().filter((v) => !PENDING.has(v.file))
  assert.equal(
    bad.length,
    0,
    bad.map((v) => `${v.file}:${v.line} ${v.text}`).join('\n'),
  )
})

test('every PENDING file still needs its entry', () => {
  const files = new Set(violations().map((v) => v.file))
  const stale = [...PENDING].filter((file) => !files.has(file))
  assert.deepEqual(stale, [])
})
```

- [ ] **Step 6: Prove the guard catches a new violation**

Temporarily add `<span className="text-[10px]">probe</span>` to `src/components/PixelNav.tsx`, run `node --import tsx --test src/lib/type-floor.test.ts`, confirm it fails naming `components/PixelNav.tsx`, then remove the probe. Run again; expect 2 pass.

- [ ] **Step 7: Run the full suite and commit**

Run: `npm test`
Expected: 189 pass (182 + 5 panel tests + 2 type-floor tests), 0 fail.

```powershell
git add src/app/globals.css src/lib/panels.test.ts src/lib/type-floor.test.ts
git commit -m "feat: add foundation 2 css foundation and guards"
```

---

## Task 2: `Button`, `ButtonLink` and `.sv-link`

**Files:**
- Create: `src/components/ui/Button.tsx`
- Modify: `src/app/globals.css` (`.sv-btn*`, `.sv-link`)
- Test: `src/lib/ui-primitives.test.ts` (create with this task)

**Interfaces:**
- Consumes: `.sv-press` and `.sv-dots` from Task 1.
- Produces: `Button`, `ButtonLink`, and `buttonClasses(variant, size, fullWidth)`. Variants `primary | secondary | destructive | ghost | icon`; sizes `lg | md | sm | move`. Default size: `lg` for primary, `sm` for icon, `md` otherwise. `fullWidth` defaults to true for primary/secondary/destructive, false for icon/ghost.

- [ ] **Step 1: Write the failing contract test**

Create `src/lib/ui-primitives.test.ts` with the shared header and the Button contract:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const ui = (name: string) => readFileSync(new URL(`../components/ui/${name}`, import.meta.url), 'utf8')

test('Button exposes the approved variants and press/loading states', () => {
  const src = ui('Button.tsx')
  for (const variant of ['primary', 'secondary', 'destructive', 'ghost', 'icon']) {
    assert.match(src, new RegExp(variant))
  }
  assert.match(src, /ButtonLink/)
  assert.match(src, /sv-dots/)
  assert.match(src, /sv-press/)
  assert.match(src, /loading\?:\s*boolean/)
  assert.match(CSS, /\.sv-link\s*\{[^}]*min-height:\s*44px/)
  assert.match(CSS, /\.sv-btn--primary\s*\{[^}]*height:\s*64px/)
  assert.match(CSS, /\.sv-btn--move\s*\{[^}]*height:\s*84px/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts`
Expected: FAIL — `Button.tsx` does not exist.

- [ ] **Step 3: Add the button and link CSS**

```css
@layer components {
  .sv-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 2px solid transparent;
    font-family: var(--font-jakarta), system-ui, sans-serif;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    user-select: none;
  }
  .sv-btn--full { width: 100%; }
  .sv-btn--primary {
    height: 64px;
    background: var(--coral);
    color: var(--shell);
    border-color: var(--cream);
    box-shadow: 0 4px 0 var(--coral-edge);
  }
  .sv-btn--secondary {
    height: 56px;
    background: var(--surface);
    color: var(--fg);
    border-color: var(--bevel);
    box-shadow: 0 4px 0 var(--bevel-shadow);
  }
  .sv-btn--destructive {
    height: 56px;
    background: var(--coral-tint);
    color: var(--coral-text);
    border-color: var(--coral);
    box-shadow: 0 4px 0 var(--coral-edge);
  }
  .sv-btn--ghost {
    min-height: 44px;
    background: transparent;
    color: var(--fg-muted);
    border-color: transparent;
    box-shadow: none;
    padding: 0 8px;
  }
  .sv-btn--icon {
    width: 44px;
    height: 44px;
    padding: 0;
    background: var(--surface);
    color: var(--fg);
    border-color: var(--bevel);
    box-shadow: 0 3px 0 var(--bevel-shadow);
  }
  .sv-btn--sm { height: 44px; }
  .sv-btn--md { height: 56px; }
  .sv-btn--lg { height: 64px; }
  .sv-btn--move {
    height: 84px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
    padding: 0 16px;
    font-size: 18px;
  }
  .sv-btn:disabled {
    background: var(--surface-low);
    color: var(--fg-faint);
    border-color: var(--off);
    box-shadow: 0 3px 0 #1B2624;
    cursor: not-allowed;
  }
  .sv-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--mint);
    text-decoration: underline;
    text-underline-offset: 4px;
  }
}
```

- [ ] **Step 4: Implement `Button.tsx`**

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

- `buttonClasses` returns `sv-btn sv-btn--<variant> sv-btn--<resolvedSize> [sv-btn--full] sv-press`.
- `variant` defaults to `'secondary'`; `size` defaults to `lg` for primary, `sm` for icon, `md` otherwise.
- `Button` spreads `...rest`; `loading` renders the children, then `<span className="sv-dots" aria-hidden><span /><span /><span /></span>`, sets `disabled` and `aria-busy`.
- `ButtonLink` takes `React.ComponentProps<typeof Link>` plus the same style props, uses `buttonClasses`, and has no `loading`/`disabled`.
- `Button` defaults `type="button"`; `ButtonLink` keeps `Link`'s own props.

- [ ] **Step 5: Run the test and the full suite**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts` → 1 pass.
Run: `npm test` → 190 pass.

- [ ] **Step 6: Commit**

```powershell
git add src/components/ui/Button.tsx src/app/globals.css src/lib/ui-primitives.test.ts
git commit -m "feat: add Button and ButtonLink primitives"
```

---

## Task 3: `PixelPanel`

**Files:**
- Create: `src/components/ui/PixelPanel.tsx`
- Test: `src/lib/ui-primitives.test.ts`

**Interfaces:**
- Consumes: `.pxw` / `.px` and `[data-tone]` from Task 1.
- Produces: `PixelPanel({ tone?: 'default' | 'mint' | 'coral' | 'cream' | 'off', className?, wrapperClassName?, style?, children })`. `className` goes on the inner `.px`; `wrapperClassName` and `style` go on the `.pxw` wrapper (so absolutely positioned panels can carry `top/left/transform`). The wrapper carries `data-tone={tone}`.

- [ ] **Step 1: Append the failing test**

```ts
test('PixelPanel composes the stepped panel and tone variables', () => {
  const src = ui('PixelPanel.tsx')
  assert.match(src, /wrapperClassName\?:\s*string/)
  assert.match(src, /data-tone=\{tone\}/)
  assert.match(src, /className=\{`pxw/)
  assert.match(src, /className=\{`px sv-panel/)
  assert.match(CSS, /\.pxw\[data-tone='coral'\]\s*>\s*\.px/)
  assert.match(CSS, /\.pxw\[data-tone='off'\]\s*>\s*\.px/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts`
Expected: FAIL — `PixelPanel.tsx` does not exist.

- [ ] **Step 3: Implement `PixelPanel.tsx`**

```tsx
type Tone = 'default' | 'mint' | 'coral' | 'cream' | 'off'
type PixelPanelProps = {
  tone?: Tone
  className?: string
  wrapperClassName?: string
  style?: React.CSSProperties
  children: React.ReactNode
}
```

Default `tone` is `'default'`. Render `<div className={`pxw ${wrapperClassName ?? ''}`} data-tone={tone} style={style}><div className={`px sv-panel ${className ?? ''}`}>{children}</div></div>`.

- [ ] **Step 4: Run the test and the full suite**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts` → 2 pass.
Run: `npm test` → 191 pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ui/PixelPanel.tsx src/lib/ui-primitives.test.ts
git commit -m "feat: add PixelPanel primitive"
```

---

## Task 4: `ScreenShell`

**Files:**
- Create: `src/components/ui/ScreenShell.tsx`
- Modify: `src/app/globals.css` (`.sv-shell*`)
- Test: `src/lib/ui-primitives.test.ts`

**Interfaces:**
- Consumes: `ButtonLink` from `src/components/ui/Button.tsx` (Task 2), `Glyph` from `src/components/Glyphs.tsx`.
- Produces: `ScreenShell({ variant?: 'tab' | 'pushed', title?, backHref?, actions?, bodyClassName?, children })`. `tab` height is `calc(100dvh - var(--nav-h) - env(safe-area-inset-bottom, 0px))`; `pushed` is `100dvh`. The header is omitted when `title`, `backHref` and `actions` are all absent.

- [ ] **Step 1: Append the failing contract test**

```ts
test('ScreenShell owns the header, the scroll body and the back icon', () => {
  const src = ui('ScreenShell.tsx')
  assert.match(src, /variant\?:\s*'tab'\s*\|\s*'pushed'/)
  assert.match(src, /backHref\?:\s*string/)
  assert.match(src, /sv-shell__body/)
  assert.match(src, /ButtonLink/)
  assert.match(CSS, /\.sv-shell--tab\s*\{[^}]*100dvh/)
  assert.match(CSS, /\.sv-shell--pushed\s*\{[^}]*100dvh/)
  assert.match(CSS, /\.sv-shell__title\s*\{[^}]*min-width:\s*0/)
  assert.match(CSS, /\.sv-shell__title\s*\{[^}]*overflow-wrap:\s*anywhere/)
  assert.match(CSS, /\.sv-shell__body\s*\{[^}]*scroll-padding-top/)
  assert.match(CSS, /\.sv-shell__body\s*\{[^}]*scroll-padding-bottom/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts`
Expected: FAIL — `ScreenShell.tsx` does not exist.

- [ ] **Step 3: Add the shell CSS**

Append to `src/app/globals.css`:

```css
@layer components {
  .sv-shell {
    display: flex;
    flex-direction: column;
    padding: 20px var(--gut) 0;
  }
  .sv-shell--tab { height: calc(100dvh - var(--nav-h) - env(safe-area-inset-bottom, 0px)); }
  .sv-shell--pushed { height: 100dvh; }
  .sv-shell__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 36px;
    flex-shrink: 0;
  }
  .sv-shell--pushed .sv-shell__header { min-height: 44px; }
  .sv-shell__title {
    font-family: var(--font-silkscreen);
    font-size: 28px;
    line-height: 1.1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .sv-shell__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
    overflow-y: auto;
    padding-top: 16px;
    padding-bottom: 16px;
    scroll-padding-top: 16px;
    scroll-padding-bottom: 16px;
  }
  .sv-shell--pushed .sv-shell__body {
    padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px));
    scroll-padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px));
  }
}
```

`min-height` rather than `height` so the 44px back icon still fits in a `tab` header without overflowing; text-only tab headers stay at the handoff's 36px rhythm.

- [ ] **Step 4: Implement `ScreenShell.tsx`**

```tsx
type ScreenShellProps = {
  variant?: 'tab' | 'pushed'
  title?: string
  backHref?: string
  actions?: React.ReactNode
  bodyClassName?: string
  children: React.ReactNode
}
```

Render a `.sv-shell.sv-shell--<variant>`; `variant` defaults to `'tab'`. When `backHref` is present, the header's left slot is `<ButtonLink href={backHref} variant="icon" aria-label="Back"><Glyph name="back" size={24} /></ButtonLink>`; `title` renders in `.sv-shell__title`. Put the back button and title in one left group (`flex items-center gap-2 min-w-0`), and `actions` in a `flex-shrink-0` right slot, so a long title shrinks instead of pushing the actions off-screen. The body is `.sv-shell__body` plus `bodyClassName`. Omit the header entirely when no title, backHref or actions.

- [ ] **Step 5: Run the test and the full suite**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts` → 3 pass.
Run: `npm test` → 192 pass.

- [ ] **Step 6: Commit**

```powershell
git add src/app/globals.css src/components/ui/ScreenShell.tsx src/lib/ui-primitives.test.ts
git commit -m "feat: add ScreenShell primitive"
```

---

## Task 5: `Chip`

**Files:**
- Create: `src/components/ui/Chip.tsx`
- Modify: `src/app/globals.css` (`.sv-chip*`)
- Test: `src/lib/ui-primitives.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Chip({ variant?: 'outline' | 'fill', color?: string, children })`. Outline uses the bevel border and `color` for text; fill is mint with ground text.

- [ ] **Step 1: Append the failing test**

```ts
test('Chip is 24px high with outline and fill variants', () => {
  const src = ui('Chip.tsx')
  assert.match(src, /variant\?:\s*'outline'\s*\|\s*'fill'/)
  assert.match(src, /color\?:\s*string/)
  assert.match(CSS, /\.sv-chip\s*\{[^}]*height:\s*24px/)
  assert.match(CSS, /\.sv-chip--fill\s*\{[^}]*background:\s*var\(--mint\)/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts`
Expected: FAIL — `Chip.tsx` does not exist.

- [ ] **Step 3: Add the CSS and implement `Chip.tsx`**

```css
@layer components {
  .sv-chip {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 10px;
    border: 2px solid var(--bevel);
    border-radius: 6px;
    font-family: var(--font-jakarta), system-ui, sans-serif;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .sv-chip--outline { background: transparent; color: var(--fg); }
  .sv-chip--fill { background: var(--mint); border-color: var(--mint); color: var(--shell); }
}
```

`Chip` renders a `<span className={`sv-chip sv-chip--${variant}`} style={variant === 'outline' && color ? { color } : undefined}>`; `variant` defaults to `'outline'`.

- [ ] **Step 4: Run the test and the full suite**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts` → 4 pass.
Run: `npm test` → 193 pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ui/Chip.tsx src/app/globals.css src/lib/ui-primitives.test.ts
git commit -m "feat: add Chip primitive"
```

---

## Task 6: `Row`

**Files:**
- Create: `src/components/ui/Row.tsx`
- Modify: `src/app/globals.css` (`.sv-row*`)
- Test: `src/lib/ui-primitives.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Row({ leading?, trailing?, divider?, minHeight?: 56 | 58, children })`. Default `minHeight` is 58; `divider` defaults to false. The parent `PixelPanel` supplies horizontal padding.

- [ ] **Step 1: Append the failing test**

```ts
test('Row supports 56/58 heights and dividers', () => {
  const src = ui('Row.tsx')
  assert.match(src, /minHeight\?:\s*56\s*\|\s*58/)
  assert.match(src, /divider\?:\s*boolean/)
  assert.match(CSS, /\.sv-row\s*\{[^}]*min-height:\s*58px/)
  assert.match(CSS, /\.sv-row--56\s*\{[^}]*min-height:\s*56px/)
  assert.match(CSS, /\.sv-row--divider\s*\{[^}]*border-bottom:\s*2px solid var\(--track\)/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts`
Expected: FAIL — `Row.tsx` does not exist.

- [ ] **Step 3: Add the CSS and implement `Row.tsx`**

```css
@layer components {
  .sv-row { display: flex; align-items: center; gap: 14px; min-height: 58px; }
  .sv-row--56 { min-height: 56px; }
  .sv-row--divider { border-bottom: 2px solid var(--track); }
  .sv-row--divider:last-child { border-bottom: 0; }
}
```

`Row` renders leading, a `flex-1 min-w-0` child slot, and trailing. Add `sv-row--56` when `minHeight === 56`, `sv-row--divider` when `divider`.

- [ ] **Step 4: Run the test and the full suite**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts` → 5 pass.
Run: `npm test` → 194 pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ui/Row.tsx src/app/globals.css src/lib/ui-primitives.test.ts
git commit -m "feat: add Row primitive"
```

---

## Task 7: `Tabs`

**Files:**
- Create: `src/components/ui/Tabs.tsx`
- Modify: `src/app/globals.css` (`.sv-tabs`, `.sv-tab`)
- Test: `src/lib/ui-primitives.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Tabs({ items: { value: string; label: string }[], value, onChange, ariaLabel })`. Controlled, two or more equal 44px buttons.

- [ ] **Step 1: Append the failing test**

```ts
test('Tabs is a controlled, accessible tablist', () => {
  const src = ui('Tabs.tsx')
  assert.match(src, /role="tablist"/)
  assert.match(src, /aria-selected/)
  assert.match(src, /ariaLabel/)
  assert.match(src, /onChange/)
  assert.match(CSS, /\.sv-tab\s*\{[^}]*height:\s*44px/)
  assert.match(CSS, /\.sv-tab\[aria-selected='true'\]/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts`
Expected: FAIL — `Tabs.tsx` does not exist.

- [ ] **Step 3: Add the CSS and implement `Tabs.tsx`**

```css
@layer components {
  .sv-tabs { display: flex; gap: 8px; }
  .sv-tab {
    flex: 1;
    height: 44px;
    border: 2px solid var(--bevel);
    background: var(--surface);
    color: var(--fg);
    font-family: var(--font-jakarta), system-ui, sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .sv-tab[aria-selected='true'] {
    background: var(--mint);
    border-color: var(--mint);
    color: var(--shell);
  }
}
```

`Tabs` is a client component. Each button has `type="button"`, `role="tab"`, `aria-selected={value === item.value}`, and calls `onChange(item.value)`.

- [ ] **Step 4: Run the test and the full suite**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts` → 6 pass.
Run: `npm test` → 195 pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ui/Tabs.tsx src/app/globals.css src/lib/ui-primitives.test.ts
git commit -m "feat: add Tabs primitive"
```

---

## Task 8: `Banner`

**Files:**
- Create: `src/components/ui/Banner.tsx`
- Modify: `src/app/globals.css` (`.sv-banner*`)
- Test: `src/lib/ui-primitives.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Banner({ tone?: 'error' | 'info', children })`. Default `error`. Error uses `role="alert"`; info uses `role="status"`.

- [ ] **Step 1: Append the failing test**

```ts
test('Banner has error and info tones', () => {
  const src = ui('Banner.tsx')
  assert.match(src, /tone\?:\s*'error'\s*\|\s*'info'/)
  assert.match(src, /role="alert"/)
  assert.match(CSS, /\.sv-banner--error\s*\{[^}]*background:\s*var\(--coral-tint\)/)
  assert.match(CSS, /\.sv-banner--info\s*\{[^}]*border-color:\s*var\(--mint\)/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts`
Expected: FAIL — `Banner.tsx` does not exist.

- [ ] **Step 3: Add the CSS and implement `Banner.tsx`**

```css
@layer components {
  .sv-banner {
    padding: 14px;
    border: 2px solid;
    font-family: var(--font-jakarta), system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.45;
  }
  .sv-banner--error { background: var(--coral-tint); border-color: var(--coral); color: var(--coral-text); }
  .sv-banner--info { background: var(--surface); border-color: var(--mint); color: var(--fg); }
}
```

- [ ] **Step 4: Run the test and the full suite**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts` → 7 pass.
Run: `npm test` → 196 pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ui/Banner.tsx src/app/globals.css src/lib/ui-primitives.test.ts
git commit -m "feat: add Banner primitive"
```

---

## Task 9: `BottomSheet`

**Files:**
- Create: `src/components/ui/BottomSheet.tsx`
- Modify: `src/app/globals.css` (`.sv-scrim`, `.sv-sheet-panel`)
- Test: `src/lib/ui-primitives.test.ts`

**Interfaces:**
- Consumes: `.sv-sheet` and `.sv-press` from Task 1.
- Produces: `BottomSheet({ open, onClose, title?, children })`. No consumer this batch; delete confirmation (Economy) and item sheet (Battle) use it later.

- [ ] **Step 1: Append the failing test**

```ts
test('BottomSheet traps focus, closes on Escape and locks scroll', () => {
  const src = ui('BottomSheet.tsx')
  assert.match(src, /aria-modal="true"/)
  assert.match(src, /Escape/)
  assert.match(src, /document\.body\.style\.overflow\s*=\s*'hidden'/)
  assert.match(src, /focusable\.length === 0/)
  assert.match(src, /panel\.focus\(\)/)
  assert.match(CSS, /\.sv-scrim\s*\{[^}]*position:\s*fixed/)
  assert.match(CSS, /\.sv-sheet-panel\s*\{[^}]*max-height:\s*80dvh/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts`
Expected: FAIL — `BottomSheet.tsx` does not exist.

- [ ] **Step 3: Add the CSS and implement `BottomSheet.tsx`**

```css
@layer components {
  .sv-scrim { position: fixed; inset: 0; z-index: 60; background: rgba(12, 18, 17, 0.7); }
  .sv-sheet-panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 61;
    max-height: 80dvh;
    overflow-y: auto;
    padding: 22px;
    padding-bottom: calc(22px + env(safe-area-inset-bottom, 0px));
    background: var(--surface);
    border-top: 2px solid var(--bevel);
  }
}
```

The component is a client component. Return `null` when `open` is false. On open: focus the panel (`tabIndex={-1}`), add a `keydown` listener for `Escape` (calls `onClose`) and `Tab` (wraps within the panel's focusable elements). If `focusable.length === 0`, prevent the default and focus the panel. Lock `document.body.style.overflow = 'hidden'` and restore the previous value on cleanup; restore focus to the previously active element. Render a `.sv-scrim` button (aria-label "Close") and the panel with `className="sv-sheet-panel sv-sheet"`, `role="dialog"`, `aria-modal="true"`, `aria-labelledby` from `useId` when `title` exists.

- [ ] **Step 4: Run the test and the full suite**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts` → 8 pass.
Run: `npm test` → 197 pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ui/BottomSheet.tsx src/app/globals.css src/lib/ui-primitives.test.ts
git commit -m "feat: add BottomSheet primitive"
```

---

## Task 10: `ResultPanel`

**Files:**
- Create: `src/components/ui/ResultPanel.tsx`
- Test: `src/lib/ui-primitives.test.ts`

**Interfaces:**
- Consumes: `.sv-display`, `.sv-number-m`, `.sv-label`, `.vpx-soft`.
- Produces: `type ResultTile = { label: string; value: string }` and `ResultPanel({ title, tone: 'mint' | 'coral' | 'cream', tiles: ResultTile[], unlocks?: React.ReactNode[], actions: React.ReactNode })`. No consumer this batch.

- [ ] **Step 1: Append the failing test**

```ts
test('ResultPanel renders a display headline, tiles and actions', () => {
  const src = ui('ResultPanel.tsx')
  assert.match(src, /tone:\s*'mint'\s*\|\s*'coral'\s*\|\s*'cream'/)
  assert.match(src, /tiles:\s*ResultTile\[\]/)
  assert.match(src, /unlocks\?/)
  assert.match(src, /sv-display/)
  assert.match(src, /vpx-soft/)
  assert.match(src, /sv-number-m/)
  assert.match(src, /actions/)
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts`
Expected: FAIL — `ResultPanel.tsx` does not exist.

- [ ] **Step 3: Implement `ResultPanel.tsx`**

Tone colours: `mint` → `var(--mint)`, `coral` → `var(--coral-text)`, `cream` → `var(--fg)`. The headline is `<h1 className="sv-display" style={{ color }}>`. Tiles are a three-column grid of `.vpx-soft` tiles, each with `.sv-number-m` value and `.sv-label` label. `unlocks` render as a list of icon + name + blurb. `actions` render in a `flex flex-col gap-2` at the bottom.

- [ ] **Step 4: Run the test and the full suite**

Run: `node --import tsx --test src/lib/ui-primitives.test.ts` → 9 pass.
Run: `npm test` → 198 pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ui/ResultPanel.tsx src/lib/ui-primitives.test.ts
git commit -m "feat: add ResultPanel primitive"
```

---

## Task 11: Migrate Home

**Files:**
- Modify: `src/app/(tabs)/page.tsx`
- Test: `src/lib/type-floor.test.ts` (remove this file from `PENDING`)
- Renders: `docs/superpowers/renders/foundation-2/after/home@390.png`

**Interfaces:**
- Consumes: `ScreenShell`, `PixelPanel`, `Button`, `ButtonLink`, `Chip`, `Banner`, `Row` (optional), all `sv-*` utilities.
- Produces: the first migrated tab screen; proves the shell + panel + chip + coral CTA combination.

- [ ] **Step 1: Migrate the frame and header**

Replace the root `<main>` with `<ScreenShell variant="tab" title={player.displayName} actions={<div className="flex items-center gap-2"><span className="sv-label text-fg-muted">Level {player.level}</span></div>}>`. Delete `Header`. Keep the loading/error states inside `ScreenShell` with a short `.sv-body` message and a `Banner` for errors. Render those states as `<ScreenShell variant="tab">` **before** dereferencing `player`, so the loading render cannot read `player.displayName`.

- [ ] **Step 2: Migrate chips, bars and panels**

- `Chips`: replace every `vpx-soft ... h-8` span with `Chip`. Bracket chip gets `color={BRACKETS[bracket].color}`; streak, shields and check-ins are outline chips. The "Shields" word becomes `.sv-label` inside the chip only if it fits at 360px; otherwise drop it and keep the `aria-label`.
- `XpBar`: labels `.sv-label text-fg-faint`, value `.sv-figure`, bar `.vpx-soft h-3`.
- `BalanceCard`: `<PixelPanel className="p-4 flex flex-col gap-1">`; heading `.sv-section-label`; figure `.sv-number-xl`; last check-in `.sv-label`; "Open vault" becomes `<ButtonLink href="/vault" variant="ghost">Open vault</ButtonLink>`.
- `DailyMissions`: `<PixelPanel className="p-4 flex flex-col gap-3">`; heading `.sv-section-label`; figures `.sv-figure`; mission names `.sv-label`; progress bar unchanged.
- `AwardsPanel`: `<PixelPanel tone="mint" className="p-4 flex flex-col gap-2">`; heading `.sv-subheading text-mint`; list and notes `.sv-label`; unlocked items `.sv-label`.
- Check-in error: `<Banner tone="error">{checkError}</Banner>`.
- Check In: `<Button variant="primary" size="lg" onClick={onCheckIn} disabled={checking}>` with the same copy.
- Footnote: `.sv-label text-fg-faint text-center`.

- [ ] **Step 3: Remove the type-floor exemption and run the guards**

Delete `app/(tabs)/page.tsx` from `PENDING` in `src/lib/type-floor.test.ts`. Run `npm test`; expect the type-floor test to pass and no other failures.

- [ ] **Step 4: Render the after state at 390**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route / --width 390 --out docs/superpowers/renders/foundation-2/after/home@390.png
```

Compare with `before/home@390.png`: same information, shell header, stepped balance/mission/award panels, coral Check In, no sub-12px text.

- [ ] **Step 5: Commit**

```powershell
git add "src/app/(tabs)/page.tsx" src/lib/type-floor.test.ts docs/superpowers/renders/foundation-2/after/home@390.png
git commit -m "feat: migrate Home to foundation 2 primitives"
```

---

## Task 12: Migrate Missions

**Files:**
- Modify: `src/app/(tabs)/missions/page.tsx`
- Test: `src/lib/type-floor.test.ts`
- Renders: `after/missions@390.png`

**Interfaces:**
- Consumes: `ScreenShell`, `PixelPanel`, `Row`, `Chip`, `Banner`, `Button`.
- Produces: the grouped `PixelPanel` + `Row` list pattern later reused by Ranks.

- [ ] **Step 1: Migrate the frame**

`<ScreenShell variant="tab" title="Missions" bodyClassName="gap-3.5">`. Loading/error states use `ScreenShell` and `Banner`.

- [ ] **Step 2: Migrate caps and sections**

- `CapMeters`: keep two `.vpx-soft` flat tiles (spec: flat stat tiles unchanged). Label `.sv-section-label`; value `.sv-figure`; progress bar unchanged.
- Each `Section`: heading `.sv-subheading`; caption `.sv-label text-fg-faint`; wrap the list in `<PixelPanel className="px-4 py-0">` and render `Row` for each mission.
- `MissionRow`: `Row` with `divider={i < list.length - 1}`; title `.sv-label` (no truncate; wrap), description `.sv-label text-fg-muted`, reset `.sv-label text-fg-faint`, XP trailing `.sv-figure`; completed state uses `<Chip variant="fill">Done</Chip>`.
- Drop the repeated reset caption on weekly/one-time sections if the screen exceeds 844px at 360; keep the per-row reset only on open rows.

- [ ] **Step 3: Remove the exemption and run tests**

Delete `app/(tabs)/missions/page.tsx` from `PENDING`; run `npm test`.

- [ ] **Step 4: Render and commit**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /missions --width 390 --out docs/superpowers/renders/foundation-2/after/missions@390.png
git add "src/app/(tabs)/missions/page.tsx" src/lib/type-floor.test.ts docs/superpowers/renders/foundation-2/after/missions@390.png
git commit -m "feat: migrate Missions to foundation 2 primitives"
```

---

## Task 13: Migrate the Battle menu

**Files:**
- Modify: `src/app/(tabs)/battle/page.tsx`
- Test: `src/lib/type-floor.test.ts`
- Renders: `after/battle@390.png`

**Interfaces:**
- Consumes: `ScreenShell`, `PixelPanel`, `Button`, `Banner`, `Chip`.
- Produces: coral primary CTA for every mode; queue panel uses secondary buttons.

- [ ] **Step 1: Migrate the frame**

`<ScreenShell variant="tab" title="Battle" actions={<span className={`sv-figure ${limitReached ? 'text-coral-text' : 'text-fg-muted'}`}>{battlesToday} / {BATTLE.dailyLimit} today</span>}>`. Error becomes `<Banner tone="error">`.

- [ ] **Step 2: Migrate mode cards and queue**

- `ModeCard`: `<PixelPanel className="p-4 flex flex-col gap-3">`; title `.sv-subheading` with the accent colour; blurb `.sv-label text-fg-muted`; CTA `<Button variant="primary">` (coral for both "Fight the AI" and "Create challenge"); footnote `.sv-label text-fg-faint`.
- Challenge panel: `<PixelPanel className="p-4 flex flex-col gap-2">`; code `.sv-figure font-mono sv-break`; Copy button `<Button variant="secondary">`.
- Queue panel: `<PixelPanel className="p-4 flex flex-col gap-3">`; status `.sv-body font-bold text-mint`; timer/window `.sv-figure`; warning `.sv-label text-butter-text`; Cancel search `<Button variant="secondary">`; Battle AI instead `<Button variant="secondary">`.
- Ranked panel: `<PixelPanel tone="off" className="p-4 flex flex-col gap-1.5">`; title `.sv-subheading`; blurb `.sv-label`; unlock note `.sv-label text-butter-text`; Find ranked match `<Button variant="primary">`.
- "How battles work": heading `.sv-section-label`; list `.sv-label text-fg-muted`.

- [ ] **Step 3: Remove the exemption and run tests**

Delete `app/(tabs)/battle/page.tsx` from `PENDING`; run `npm test`.

- [ ] **Step 4: Render and commit**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /battle --width 390 --out docs/superpowers/renders/foundation-2/after/battle@390.png
git add "src/app/(tabs)/battle/page.tsx" src/lib/type-floor.test.ts docs/superpowers/renders/foundation-2/after/battle@390.png
git commit -m "feat: migrate Battle menu to foundation 2 primitives"
```

---

## Task 14: Migrate Ranks

**Files:**
- Modify: `src/app/(tabs)/leaderboard/page.tsx`
- Test: `src/lib/type-floor.test.ts`
- Renders: `after/ranks@390.png`

**Interfaces:**
- Consumes: `ScreenShell`, `Tabs`, `PixelPanel`, `Row`, `Chip`, `Banner`, `Button`.
- Produces: the 56px rank-row pattern and the `Tabs` consumer.

- [ ] **Step 1: Migrate the frame and tabs**

`<ScreenShell variant="tab" title="Ranks" actions={<Button variant="secondary" size="sm" fullWidth={false} aria-pressed={friends} onClick={() => setFriends(f => !f)}>Friends {friends ? 'on' : 'off'}</Button>}>`. Replace the two `BoardTab` buttons with `<Tabs ariaLabel="Leaderboard" value={board} onChange={(v) => setBoard(v as 'ranked' | 'unranked')} items={[{ value: 'ranked', label: 'Ranked' }, { value: 'unranked', label: 'Unranked' }]} />`. Drop the tab hints (secondary metadata).

- [ ] **Step 2: Migrate rows**

- Error → `Banner`.
- Empty state → `<PixelPanel className="p-6 text-center flex flex-col gap-2">` with `.sv-body` and `.sv-label`.
- Rows → `<PixelPanel className="px-4 py-0">` with `Row minHeight={56} divider={i < rows.length - 1}`.
- Rank leading `.sv-figure` with the existing medal colours; name `.sv-label` with no `truncate`; "(you)" `.sv-label text-fg-faint`; bracket `<Chip variant="outline" color={...}>`; verified `⟡` stays with its `aria-label`; metadata `.sv-label text-fg-faint`; score `.sv-figure text-butter-text`.
- Footer notes `.sv-label text-fg-faint text-center`; keep one verified-saver line only.

- [ ] **Step 3: Remove the exemption and run tests**

Delete `app/(tabs)/leaderboard/page.tsx` from `PENDING`; run `npm test`.

- [ ] **Step 4: Render and commit**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /leaderboard --width 390 --out docs/superpowers/renders/foundation-2/after/ranks@390.png
git add "src/app/(tabs)/leaderboard/page.tsx" src/lib/type-floor.test.ts docs/superpowers/renders/foundation-2/after/ranks@390.png
git commit -m "feat: migrate Ranks to foundation 2 primitives"
```

---

## Task 15: Migrate Profile and its account components

**Files:**
- Modify: `src/app/(tabs)/profile/page.tsx`
- Modify: `src/components/DeleteAccount.tsx`
- Modify: `src/components/vault/BackupSettings.tsx`
- Modify: `src/components/vault/BackupQuiz.tsx`
- Modify: `src/components/vault/CopyButton.tsx`
- Test: `src/lib/type-floor.test.ts`
- Renders: `after/profile@390.png`

**Interfaces:**
- Consumes: every primitive except `BottomSheet` and `ResultPanel`.
- Produces: the migrated delete and backup flows; both stay inline in Profile this batch.

- [ ] **Step 1: Migrate the Profile frame**

`<ScreenShell variant="tab" title={data.player.displayName} actions={<div className="flex items-center gap-2"><span className="sv-label text-fg-muted">Level {data.player.level}</span>{b && <Chip variant="outline" color={BRACKETS[b].color}>{BRACKETS[b].label}</Chip>}</div>}>`. Define `const b = data.player.bracket` in the page body. Delete `IdentityStrip`. Loading/error states use `ScreenShell` + `Banner` and render before dereferencing `data`.

- [ ] **Step 2: Migrate Profile sections**

- `StatGrid`: keep three `.vpx-soft` flat tiles; value `.sv-number-m`, label `.sv-label`; the W/L/T line `.sv-label`.
- Badges: keep the `.vpx-soft` grid; names `.sv-label` (wrap, no truncate).
- Inventory: wrap in `<PixelPanel className="px-4 py-0">`; each item becomes a `Row` with `divider`; title `.sv-label`, bracket `<Chip variant="outline">`, blurb `.sv-label text-fg-muted`, active note `.sv-label text-mint`.
- Share: heading `.sv-section-label`; Share button `<Button variant="secondary">`; URL `.sv-figure font-mono sv-break`; caption `.sv-label`.
- Help: heading `.sv-section-label`; Show tour again `<Button variant="secondary">`.
- Footer: `.sv-label text-fg-faint`; contact link `.sv-link`; address `.sv-figure font-mono sv-break`.

- [ ] **Step 3: Migrate `DeleteAccount`**

- Every `.vpx bg-surface` panel → `PixelPanel`.
- Confirm panel → `<PixelPanel tone="coral">`.
- Every note → `Banner tone="error"`.
- "Delete account" row → `<Button variant="destructive" className="justify-start">`.
- Reveal words, Continue, Verify words, Delete everything → `<Button variant="primary">` (Delete everything is the approved coral final confirm).
- `BackLink` → `<Button variant="ghost">`.
- Inputs keep `.vpx`, drop `outline-none`, use `focus:border-mint`.
- Word-grid index `.sv-figure`; footnote `.sv-label`; headings `.sv-section-label`.

- [ ] **Step 4: Migrate `BackupSettings`, `BackupQuiz` and `CopyButton`**

- `BackupSettings`: heading `.sv-section-label`; the three entry buttons → `Button variant="secondary" className="justify-start"`; panels → `PixelPanel`; `ActionButton` gains `variant?: 'primary' | 'secondary'` (default secondary); Reveal words → primary, Change passphrase → secondary, Restore vault → secondary; `BackButton` → ghost; error → `Banner tone="error"`, success → `Banner tone="info"`; inputs drop `outline-none`, use `focus:border-mint`; word-grid index `.sv-figure`.
- `BackupQuiz`: heading `.sv-heading`; body `.sv-body`; inputs as above; Check words → primary; Back → ghost; error → `Banner`.
- `CopyButton`: replace the `.vpx-soft` button with `<Button variant="secondary" size="sm" fullWidth={false} aria-live="polite" className={...}>`; keep the three labels and the failed state.

- [ ] **Step 5: Remove the exemptions and run tests**

Delete `app/(tabs)/profile/page.tsx`, `components/DeleteAccount.tsx` and `components/vault/BackupSettings.tsx` from `PENDING`; run `npm test`.

- [ ] **Step 6: Render and commit**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /profile --width 390 --out docs/superpowers/renders/foundation-2/after/profile@390.png
git add "src/app/(tabs)/profile/page.tsx" src/components/DeleteAccount.tsx src/components/vault/BackupSettings.tsx src/components/vault/BackupQuiz.tsx src/components/vault/CopyButton.tsx src/lib/type-floor.test.ts docs/superpowers/renders/foundation-2/after/profile@390.png
git commit -m "feat: migrate Profile and account flows to foundation 2 primitives"
```

---

## Task 16: Migrate Vault and the tour

**Files:**
- Modify: `src/app/(tabs)/vault/page.tsx`
- Modify: `src/components/VaultTour.tsx`
- Test: `src/lib/type-floor.test.ts`
- Renders: `after/vault@390.png`

**Interfaces:**
- Consumes: `ScreenShell` with `variant="tab"` + `backHref="/"`, `PixelPanel` with `wrapperClassName`/`style`, `Button`, `ButtonLink`, `Banner`, `Chip`.
- Produces: the app-specific Vault screen migrated mechanically; its redesign is the final batch.

- [ ] **Step 1: Migrate the Vault frame and hero**

`<ScreenShell variant="tab" title="Vault" backHref="/">`. Loading/error/no-vault states use the shell; the no-vault CTA is `<ButtonLink href="/setup/vault" variant="primary">Create my vault</ButtonLink>`.

- Balance panel: wrap `<div data-tour="vault"><PixelPanel className="p-4 flex flex-col gap-2">...</PixelPanel></div>` so the tour anchor measures the panel. Label `.sv-section-label`; figure `.sv-number-xl`; address `.sv-figure font-mono sv-break`.
- `ShieldStrip`: `.sv-label`.
- Network mismatch → `Banner tone="error"`.
- Backup warning → `<PixelPanel className="bg-butter-tint p-3 flex flex-col gap-2">` (the utility overrides the tone background) with `.sv-label` copy.
- Empty note → `.sv-body`.

- [ ] **Step 2: Migrate money actions**

- Deposit heading `.sv-section-label`; amount field label `.sv-label`, input keeps `.vpx`, drops `outline-none`, uses `focus:border-mint`; Deposit → `<Button variant="primary" data-tour="deposit">` (coral); footnote `.sv-label`.
- Withdraw heading `.sv-section-label`; destination copy `.sv-label`; amount field as above; Unlock vault → `<Button variant="primary">`; Withdraw → `<Button variant="primary">` (coral, not butter); unlocked message `.sv-label text-mint`.
- Action error → `Banner`; notice → `Banner tone="info"`.
- Recent movements: keep the `.vpx-soft` flat rows; label `.sv-label`, status `.sv-label`, amount `.sv-figure`; links `.sv-link`.
- `ErrorCard` → `Banner tone="error"` with `<Button variant="primary" size="sm" fullWidth={false}>Retry</Button>`.

- [ ] **Step 3: Migrate `VaultTour`**

- Replace the `.vpx` card with `<PixelPanel wrapperClassName="absolute w-[calc(100%-2rem)] max-w-90" style={cardPosition(rect)} className="p-4 flex flex-col gap-3">`.
- Step label `.sv-section-label`; title `.sv-subheading`; body `.sv-body`.
- Back → `<Button variant="secondary" size="sm" fullWidth={false}>`; Next/Deposit now → `<Button variant="primary" size="sm" fullWidth={false}>`; Skip → `<Button variant="ghost">`.
- Keep the dimmer, Escape handler, focus and anchor measurement unchanged.

- [ ] **Step 4: Remove the exemptions and run tests**

Delete `app/(tabs)/vault/page.tsx` and `components/VaultTour.tsx` from `PENDING`; run `npm test`.

- [ ] **Step 5: Render and commit**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /vault --width 390 --out docs/superpowers/renders/foundation-2/after/vault@390.png
git add "src/app/(tabs)/vault/page.tsx" src/components/VaultTour.tsx src/lib/type-floor.test.ts docs/superpowers/renders/foundation-2/after/vault@390.png
git commit -m "feat: migrate Vault and tour to foundation 2 primitives"
```

---

## Task 17: Migrate Receipts

**Files:**
- Modify: `src/app/receipts/page.tsx`
- Test: `src/lib/type-floor.test.ts`
- Renders: `after/receipts@390.png`

**Interfaces:**
- Consumes: `ScreenShell` pushed with `backHref="/vault"`, `PixelPanel`, `Button`, `ButtonLink`, `Banner`.
- Produces: the pushed-screen shell pattern reused by battle detail and setup.

- [ ] **Step 1: Migrate the frame**

`<ScreenShell variant="pushed" title="Receipts" backHref="/vault">`. Move the intro paragraph into the body as `.sv-body text-fg-muted`. Remove the old `<header>` and the bottom "Back to vault" link (the shell back icon replaces it).

- [ ] **Step 2: Migrate rows and states**

- Loading `.sv-body`; error `<Banner tone="error">` with `<Button variant="primary" size="sm" fullWidth={false} onClick={load}>Retry</Button>`; check result `<Banner tone="info">`; empty `.sv-body`.
- `TransferRow` → `<PixelPanel className="p-4 flex flex-col gap-2">`; label `.sv-label`; amount `.sv-figure`; hash `.sv-figure font-mono sv-break`; time `.sv-label`; included/pending/expired text `.sv-label`.
- Check again → `<Button variant="secondary" size="sm" fullWidth={false}>`; Try again → `<ButtonLink href={...} variant="primary" size="sm" fullWidth={false}>Try again</ButtonLink>`.
- `SnapshotRow` stays `.vpx-soft`; label `.sv-label`, amount `.sv-figure`, time `.sv-label`.

- [ ] **Step 3: Remove the exemption and run tests**

Delete `app/receipts/page.tsx` from `PENDING`; run `npm test`.

- [ ] **Step 4: Render and commit**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /receipts --width 390 --out docs/superpowers/renders/foundation-2/after/receipts@390.png
git add src/app/receipts/page.tsx src/lib/type-floor.test.ts docs/superpowers/renders/foundation-2/after/receipts@390.png
git commit -m "feat: migrate Receipts to foundation 2 primitives"
```

---

## Task 18: Migrate Battle detail

**Files:**
- Modify: `src/app/battle/[id]/page.tsx`
- Test: `src/lib/type-floor.test.ts`
- Renders: `after/battle-detail@390.png`

**Interfaces:**
- Consumes: `ScreenShell` pushed with `backHref="/battle"`, `PixelPanel`, `Button`, `ButtonLink`, `Banner`, `Glyph`.
- Produces: the battle move-button pattern and the only `.sv-state` consumers.

- [ ] **Step 1: Migrate the frame and terminal states**

`<ScreenShell variant="pushed" title="Battle" backHref="/battle">`. Delete the local `Shell` and `Panel`.

- Loading `.sv-body`; error `<Banner tone="error">`.
- Pending creator/joiner → `PixelPanel`; heading `.sv-heading`; body `.sv-body`/`.sv-label`; Accept challenge → `<Button variant="primary">`; BackLink → `<Button variant="ghost">`.
- Completed → `PixelPanel`; headline `.sv-display` with the existing mint/coral/butter colour; XP note `.sv-body`; HP line `.sv-label`; back → ghost.
- Abandoned → `PixelPanel` with `.sv-heading` and `.sv-body`.

- [ ] **Step 2: Migrate the active battle**

- Mode line `.sv-section-label`; turn counter `.sv-figure` in the shell `actions`.
- `Hp` labels `.sv-state`; HP values `.sv-figure`; bars keep `.vpx-soft`.
- Opponent last move `.sv-label text-mint`.
- Waiting panel → `PixelPanel`; text `.sv-body`; countdown `.sv-figure`.
- "Choose your move" `.sv-subheading`.
- `MoveButton` → `Button size="move"` with `variant="primary"` for Attack, `variant="secondary"` for Defend/Use item/Special Move, `disabled` for Special Move when on cooldown. Keep the `Glyph`, label and corner note; the note uses `.sv-state`.
- Item list → `PixelPanel tone="off"`; heading `.sv-section-label`; each item `<Button variant="secondary" size="sm" fullWidth className="justify-start">`.
- Auto-Defend countdown `.sv-state`.
- `TurnLog` heading `.sv-state`; body `.sv-label`; keep `.vpx-soft` on the log tile.
- Error → `Banner tone="error"`.

- [ ] **Step 3: Remove the exemption and run tests**

Delete `app/battle/[id]/page.tsx` from `PENDING`; run `npm test`.

- [ ] **Step 4: Render and commit**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /battle/test-battle --width 390 --out docs/superpowers/renders/foundation-2/after/battle-detail@390.png
git add "src/app/battle/[id]/page.tsx" src/lib/type-floor.test.ts docs/superpowers/renders/foundation-2/after/battle-detail@390.png
git commit -m "feat: migrate Battle detail to foundation 2 primitives"
```

---

## Task 19: Migrate Setup and its ceremony components

**Files:**
- Modify: `src/app/setup/page.tsx`
- Modify: `src/components/vault/PhraseCeremony.tsx`
- Modify: `src/components/vault/PassphraseField.tsx`
- Test: `src/lib/type-floor.test.ts`
- Renders: `after/setup@390.png`

**Interfaces:**
- Consumes: `ScreenShell` pushed (no back), `PixelPanel`, `Button`, `Banner`.
- Produces: the 16-character display-name limit and the five-dot progress bar.

- [ ] **Step 1: Migrate the Setup frame and progress**

`<ScreenShell variant="pushed">` (no title/back). Replace `ProgressBar` with five dots plus one active label at `.sv-label`: dots are 8px squares (mint done, butter active, line upcoming); only the active step's label renders, so five labels never compete at 360px.

- [ ] **Step 2: Migrate the steps**

- `Section` heading → `.sv-heading`; body copy `.sv-body`; muted copy `.sv-body text-fg-muted`.
- `PrimaryButton` → `<Button variant="primary">` (Create my vault, I understand — Continue, Start saving).
- `BackButton` → `<Button variant="ghost">`.
- Account picker buttons → `<Button variant="secondary" fullWidth className="justify-start font-mono sv-break">`.
- `ErrorNote` → `Banner tone="error"`; `StatusNote` → `.sv-label text-fg-faint italic`.
- Privacy panel → `<PixelPanel tone="off" className="p-4 flex flex-col gap-2">`; paragraphs `.sv-label text-fg-soft`; address line `.sv-label` + `.sv-figure font-mono sv-break`.
- Name input: `maxLength={16}`, placeholder "16 characters max", validity `<= 16`; keep the server's 32-char column unchanged. Drop `outline-none`, use `focus:border-mint`.

- [ ] **Step 3: Migrate `PhraseCeremony` and `PassphraseField`**

- `PhraseCeremony`: heading `.sv-heading`; body `.sv-body`; word-grid index `.sv-figure`; checkbox label `.sv-label`; Continue → primary; Back → ghost.
- `PassphraseField`: body `.sv-body`; labels `.sv-label text-fg-faint`; inputs drop `outline-none`, use `focus:border-mint`; error → `Banner`; Lock my vault → primary.

- [ ] **Step 4: Remove the exemptions and run tests**

Delete `app/setup/page.tsx` and `components/vault/PhraseCeremony.tsx` from `PENDING`; run `npm test`.

- [ ] **Step 5: Render and commit**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /setup --width 390 --out docs/superpowers/renders/foundation-2/after/setup@390.png
git add src/app/setup/page.tsx src/components/vault/PhraseCeremony.tsx src/components/vault/PassphraseField.tsx src/lib/type-floor.test.ts docs/superpowers/renders/foundation-2/after/setup@390.png
git commit -m "feat: migrate Setup to foundation 2 primitives"
```

---

## Task 20: Migrate Setup vault

**Files:**
- Modify: `src/app/setup/vault/page.tsx`
- Renders: `after/setup-vault@390.png`

**Interfaces:**
- Consumes: `ScreenShell` pushed with `backHref="/vault"`, `Button`, `Banner`, the migrated ceremony components.
- Produces: the existing-player vault creation screen on the same shell as Setup.

- [ ] **Step 1: Migrate the frame and phases**

`<ScreenShell variant="pushed" backHref="/vault">`. Pick phase: heading `.sv-heading`; body `.sv-body`; account buttons → `<Button variant="secondary" fullWidth className="justify-start font-mono sv-break">`; error → `Banner`. Show/quiz/passphrase phases: headings `.sv-heading`; passphrase section uses the migrated `PassphraseField`; error → `Banner`; loading `.sv-label text-fg-faint italic`.

- [ ] **Step 2: Run tests**

`npm test` (this file has no type-floor exemption; it should already be clean). Confirm 198 pass.

- [ ] **Step 3: Render and commit**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /setup/vault --width 390 --out docs/superpowers/renders/foundation-2/after/setup-vault@390.png
git add src/app/setup/vault/page.tsx docs/superpowers/renders/foundation-2/after/setup-vault@390.png
git commit -m "feat: migrate Setup vault to foundation 2 primitives"
```

---

## Task 21: Migrate Card and VersionGate

**Files:**
- Modify: `src/app/card/[token]/page.tsx`
- Modify: `src/components/VersionGate.tsx`
- Test: `src/lib/type-floor.test.ts`
- Renders: `after/card@390.png`

**Interfaces:**
- Consumes: `PixelPanel`, `Chip`, `Button`, `Banner`, `sv-*` utilities.
- Produces: the public card on the handoff type scale without the shell (it keeps its centred `<main>`).

- [ ] **Step 1: Migrate the Card**

Keep `<main className="min-h-dvh flex items-center justify-center p-(--gut)">`. Replace `<article className="vpx ...">` with `<PixelPanel tone="off" wrapperClassName="max-w-90 w-full" className="p-6 flex flex-col gap-4">`.

- Label `text-[10px]` → `.sv-section-label`; name `text-3xl` → `.sv-heading sv-break`; stat labels `.sv-section-label`, values `.sv-number-m`; bracket label `.sv-section-label`, value `.sv-label`; verification tile stays `.vpx-soft` with `.sv-section-label`, `.sv-figure font-mono sv-break`, `.sv-label`; footer `.sv-label`.

- [ ] **Step 2: Migrate `VersionGate`**

`GateShell` → `<PixelPanel className="p-6 max-w-90 w-full flex flex-col gap-3">`; heading `.sv-heading`; body `.sv-body`; loading `.sv-body`. Keep the public-route bypass unchanged.

- [ ] **Step 3: Remove the exemption and run tests**

Delete `app/card/[token]/page.tsx` from `PENDING`; run `npm test`. `PENDING` is now empty; both type-floor tests pass.

- [ ] **Step 4: Render and commit**

Use the real card token found in Task 0 (or recreate the temporary fixture, then delete it):

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route "/card/<token>" --width 390 --out docs/superpowers/renders/foundation-2/after/card@390.png
git add "src/app/card/[token]/page.tsx" src/components/VersionGate.tsx src/lib/type-floor.test.ts docs/superpowers/renders/foundation-2/after/card@390.png
git commit -m "feat: migrate Card and VersionGate to foundation 2 primitives"
```

---

## Task 22: Final verification and sign-off

**Files:**
- Create: `docs/superpowers/renders/foundation-2/after/*.png` (full sweep)
- Modify: `docs/superpowers/audits/2026-11-05-ui-gap-audit.md` (status note only)

**Interfaces:**
- Consumes: every task above.
- Produces: the evidence package the user signs off on.

- [ ] **Step 1: Run the full automated suite**

Stop the Task 0 dev server first so `next build` owns `.next`, then:

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: `npm test` → 198 pass, 0 fail. `tsc`, lint and build → exit 0.

- [ ] **Step 2: Prove the type floor is enforced**

```powershell
Get-ChildItem -Recurse -File -Path src -Include *.tsx | Select-String -Pattern 'text-\[(10|11)px\]'
```

Expected: no output. `PENDING` in `src/lib/type-floor.test.ts` is an empty set.

- [ ] **Step 3: Capture the full after sweep**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --all --outDir docs/superpowers/renders/foundation-2/after
```

Expected: 33 PNGs. If the card token came from the temporary Task 0 fixture, recreate that fixture for the sweep and delete it in a `finally`. Compare each before/after pair at 360, 390 and 430. Record any intentional drops (secondary metadata) in the audit status note.

- [ ] **Step 4: Keyboard and touch audit**

- Tab through every route: focus ring visible, order follows reading order, no control hidden under the fixed header/nav.
- Confirm every icon button is 44×44 and every text action has a 44px hit area.
- Confirm the BottomSheet's Escape/focus trap from the `ui-primitives.test.ts` source contract and the CSS assertions; it has no consumer this batch, so do not add a scratch route (the spec forbids new routes). If a consumer lands before sign-off, test it in place.
- Confirm the 12px floor visually at 360px; no action label, balance, XP value or row title is truncated.
- Record in the sign-off note that the real-device pass is the user's final step; the agent's evidence is the emulated sweep. The spec's "phone remains the final measure" is not satisfiable from a headless harness.

- [ ] **Step 5: Performance note**

Measure one `.pxw` list screen (Missions or Ranks) in Chrome with 4× CPU throttle. Record the observed frame cost in the audit status note. Do not replace the filters with a fallback; the spec accepts minor jank for fidelity.

- [ ] **Step 6: Commit the sign-off evidence**

```powershell
git add docs/superpowers/renders/foundation-2/after docs/superpowers/audits/2026-11-05-ui-gap-audit.md
git commit -m "chore: foundation 2 sign-off renders and verification"
```

---

## Deviations from the spec

These are deliberate and should be reviewed with the plan:

1. **Profile's settings icon is deferred to Economy.** There is no `/settings` route yet, so rendering the icon would ship a dead control. Profile's tab header carries the level and bracket chip instead.
2. **`BottomSheet` and `ResultPanel` have no consumer in this batch.** They are built and contract-tested now because Economy and Battle are their first consumers; wiring them into the current screens would rebuild layouts this batch forbids.
3. **Display-name 16 is client-side only.** `src/app/setup/page.tsx` enforces `maxLength={16}`; the server column stays 32 because this batch makes no API changes. Existing longer names keep rendering.
4. **`ButtonLink` and `.sv-link` live in the Button module.** The spec names `Button` only; navigation and inline links need the same class resolver, and a separate module would duplicate it.
5. **`PixelPanel` has `wrapperClassName` and applies `style` to the wrapper.** `VaultTour` is absolutely positioned and needs `top/left/transform` on the `.pxw` element; the spec's `style` prop did not say which element it targets.
6. **`backHref` is independent of `variant`.** `/vault` lives inside the tabs group but needs a back icon; using `variant="pushed"` there would double the height.
7. **`ScreenShell` gains `bodyClassName`.** Missions needs the handoff's 14px body gap; the spec says "Missions may pass `gap-3.5`" without naming the prop.
8. **`/card/[token]` keeps its centred `<main>`.** It is a public, chrome-less page; `ScreenShell` would add a header and scroll region it does not need.
9. **Home keeps the display name + level chip in the shell header.** The handoff's icon + wordmark header is Home-batch work, not Foundation 2.
10. **Panel tone backgrounds live in `@layer components`.** `bg-surface-low` and `bg-butter-tint` must override them, so the tone rules sit below Tailwind utilities.
11. **Primitive styling lives in `globals.css` classes.** Components are thin class composers, which lets the source-level tests pin CSS contracts without a renderer.
12. **`ScreenShell` heights are fixed:** `tab` = `calc(100dvh - var(--nav-h) - safe-area)`, `pushed` = `100dvh` with 32px + safe-area bottom padding.
13. **Ranks and Missions adopt grouped `PixelPanel` + `Row` lists.** The spec names `Row` for grouped lists; these are the two screens that already have list semantics. Rank row titles stop truncating and wrap.
14. **The Setup progress bar becomes five dots + one active label.** Five 12px labels cannot fit at 360px without truncation, which the spec forbids.
15. **The type-floor guard uses a temporary `PENDING` allowlist.** It is empty at the end of Task 21; the stale-entry test forces each screen to remove its entry in its own commit.
16. **`.sv-break` is added.** The spec's type section does not name a wrapping utility, but 64-char hashes and 95-char addresses must not cause horizontal scroll at 360px.
17. **Battle state labels use `.sv-state`:** HP labels, the Special Move cooldown note, the TurnLog heading and the Auto-Defend countdown. These are the only 10px consumers.
18. **No `ResultPanel` in the battle result.** The result screen is rebuilt in the Battle batch; this batch keeps its custom headline and migrates only the shell, panel and type.
19. **Inline coral actions inside a list row use `size="sm"` (44px), not 64px.** The approved table's 64px is the full-width advancing CTA; a 64px button inside a receipt row would break the row rhythm. The colour and variant stay coral primary.
20. **`ScreenShell` bodies get a 16px bottom padding on tab screens.** The spec's body padding ends at `0` because the tabs layout reserves the nav; a 16px bottom keeps the last card from touching the nav border, matching the app's previous 22px gutter without stealing nav space. Pushed screens use 32px + safe area.

---

## Execution notes

- **Order matters.** Task 1 must land before any primitive; Tasks 2–4 must land before any screen. Screens can then be migrated in any order, but the listed order keeps the review diff small.
- **Every screen commit includes its after render.** Do not batch renders at the end; the before/after pair is the review evidence.
- **Never stage untracked user work.** The four files listed in Global Constraints are not part of this plan.
- **When a test fails, fix the code, not the test.** The only exception is a stale `PENDING` entry, which is removed by design.
- **If a screen exceeds 844px at 360px,** drop secondary metadata (duplicate captions, repeated reset text, extra rank lines). Never truncate an action label, balance, XP value or row title.
- **If the capture harness cannot reach a route,** fix the fixture; do not accept a gate or error screen as evidence.

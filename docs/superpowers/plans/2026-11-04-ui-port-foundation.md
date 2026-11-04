# UI port to the handoff — foundation batch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `src/` onto the handoff's palette and five-tab nav, so later screen batches are layout work rather than architecture.

**Architecture:** Values are swapped inside `src/app/globals.css` and every class/variable name is preserved, so no component repaints itself for colour. The nav becomes a new `PixelNav` component fed by a pure `src/lib/nav.ts` data module; its five icons are extracted verbatim from `Savborne-handoff.html` into a tracked `assets/nav-icons.json` because their source pack is gitignored. Vault stays reachable through the Home savings card, which this batch links to `/vault`.

**Tech Stack:** Next.js (App Router, local docs in `node_modules/next/dist/docs/`), React, Tailwind v4 (`@theme inline`), TypeScript, `node --test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-03-ui-port-foundation-design.md`

## Global Constraints

- **No screen from the artefact is built in this batch.** Visible output is the palette, the nav, and one new link on Home.
- **Do not build `ScreenShell`, `SectionCard` or `ResultPanel`,** and do not add the `.chip` utility. All four are specified in the spec but ship with their first consumer in a later batch; building them here would be vocabulary with no user. `PixelNav` is the only new component in this plan.
- **No routing changes.** Home stays `/`, Ranks stays `/leaderboard`. Do not create `/home` or `/ranks`.
- **No new dependencies.** Everything here uses `node:fs`, `node:test`, React and Next already installed.
- **Do not modify `Savborne-handoff.html`.** It is the design of record and the extraction source; it is read-only.
- **Do not add nav icons to `assets/glyphs.json`.** Nav icons are 16×16 Tiny Dungeon tiles; `glyphs.json` is the 24×24 action-glyph set and `Glyphs.tsx` enforces that grid.
- **Do not touch `assets-raw/`.** It is gitignored (`.gitignore:45`); nothing may depend on it at runtime or in CI.
- **Tokens: values change, names do not.** `.vpx`, `.vpx-soft`, `.num` and every `--token` keep their names.
- **Exact values** come from the spec's token table. Do not invent a value for a token the spec says to keep.
- **Tests live at `src/**/*.test.ts`** and run under `node --test`. There is no React test renderer in this repo — component behaviour is verified by types, lint, build, and the render step in Task 7. Do not add a renderer.
- Every task ends green: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Work from the repo root. Commit at the end of every task with the message given.

## Review Focus

Five failure modes the spec implies but no unit test can fully cover. Each is pinned by a test or a check in the task named.

1. **A pushed screen leaves every tab inactive.** `pathname === href` is false on `/battle/123`, so the nav would highlight nothing while the player is mid-battle. Pinned by `isTabActive` tests in Task 4.
2. **A missing or renamed icon key renders an invisible tab.** Injecting an undefined string yields an empty span with no error. Pinned by the key-parity test in Task 4.
3. **The nav is unreadable on a narrow phone.** Five Title Case labels at 12px could wrap at 320–360px, changing nav height and clipping labels. Pinned by the 360px render in Task 7.
4. **The safe-area inset is eaten.** If the nav's bottom padding replaces rather than adds to `env(safe-area-inset-bottom)`, labels sit under the home indicator on iOS. Pinned by keeping the `calc()` form in Task 5.
5. **The art is flattened to one hue later.** Recolouring these icons with `currentColor` would destroy the multi-colour tiles and the Home active remap. Pinned by the per-state fill assertions in Task 3.

---

### Task 1: Palette migration

Swap the palette values in `globals.css` and prove the swap is contrast-safe. Every text token must still pass WCAG AA against all three surfaces.

**Files:**
- Modify: `src/app/globals.css:7-46` (the `:root` block)
- Test: `src/lib/tokens.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: the CSS variables later tasks reference — `--shell` `#0C1211`, `--surface` `#151F1D`, `--surface-low` `#101A18`, `--line` `#2E4642`, `--bevel` `#C9C1A8`, `--fg` `#F3EEDD`, `--fg-soft` `#C9C1A8`, `--fg-muted` `#A9B8B2`, `--fg-faint` `#7A9187` (unchanged), `--mint` `#6FD0AE`, `--mint-tint` `#0C3B35`, `--coral-text` `#FF9C86`, `--bevel-shadow` `#2E4642`, plus new `--track` `#243532`, `--cream` `#F6EFD9`, `--ember` `#FF6A4D`, `--coral-edge` `#A8452F`, `--off` `#4B5A56`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/tokens.test.ts`. It parses `globals.css` rather than restating it, so the assertion tracks the real file:

```ts
/**
 * The palette swap is a value-only change, which is exactly why it needs a test:
 * every class name stays identical, so nothing in the component tree can fail to
 * compile when a token silently becomes unreadable.
 *
 * Two specific things are pinned here:
 *  - --fg-faint must NOT become #4B5A56. The handoff labels that colour
 *    "Disabled outline" and it measures 2.32:1 on --surface; adopting it for
 *    caption text would have shipped a WCAG failure that no build step catches.
 *  - every text token clears 4.5:1 on every surface, measured not assumed.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

function hexTokens(css: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    out[m[1]] = m[2].toUpperCase()
  }
  return out
}

const luminance = (hex: string) => {
  const c = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const T = hexTokens(CSS)

test('the palette adopts the handoff values', () => {
  assert.equal(T['--shell'], '#0C1211')
  assert.equal(T['--surface'], '#151F1D')
  assert.equal(T['--surface-low'], '#101A18')
  assert.equal(T['--sprite-well'], '#101A18')
  assert.equal(T['--line'], '#2E4642')
  assert.equal(T['--bevel'], '#C9C1A8')
  assert.equal(T['--fg'], '#F3EEDD')
  assert.equal(T['--fg-soft'], '#C9C1A8')
  assert.equal(T['--fg-muted'], '#A9B8B2')
  assert.equal(T['--mint'], '#6FD0AE')
  assert.equal(T['--mint-tint'], '#0C3B35')
  assert.equal(T['--coral-text'], '#FF9C86')
  assert.equal(T['--bevel-shadow'], '#2E4642')
})

test('tokens the handoff has and the app lacked are added', () => {
  assert.equal(T['--track'], '#243532')
  assert.equal(T['--cream'], '#F6EFD9')
  assert.equal(T['--ember'], '#FF6A4D')
  assert.equal(T['--coral-edge'], '#A8452F')
  assert.equal(T['--off'], '#4B5A56')
})

test('tokens with no handoff counterpart keep their values', () => {
  assert.equal(T['--surface-hi'], '#274438')
  assert.equal(T['--butter'], '#F2B544')
  assert.equal(T['--butter-text'], '#FFD37A')
  assert.equal(T['--butter-tint'], '#35280F')
  assert.equal(T['--entry'], '#D9C98A')
  assert.equal(T['--bronze'], '#E08A5B')
  assert.equal(T['--silver'], '#C9D3DC')
})

test('--fg-faint keeps a readable value rather than the handoff disabled-outline colour', () => {
  assert.equal(T['--fg-faint'], '#7A9187')
  assert.notEqual(T['--fg-faint'], '#4B5A56')
})

test('every text token clears 4.5:1 on every surface', () => {
  const surfaces = ['--shell', '--surface', '--surface-low']
  const textTokens = ['--fg', '--fg-soft', '--fg-muted', '--fg-faint', '--cream', '--mint', '--coral-text']
  for (const text of textTokens) {
    for (const surface of surfaces) {
      const ratio = contrast(T[text], T[surface])
      assert.ok(
        ratio >= 4.5,
        `${text} on ${surface} is ${ratio.toFixed(2)}:1, below 4.5:1`
      )
    }
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/tokens.test.ts`
Expected: FAIL — `--shell` is `#152420`, not `#0C1211`.

- [ ] **Step 3: Replace the `:root` values**

In `src/app/globals.css`, change only the values in `:root` (lines 7–46), keeping the comments and grouping. Leave `@theme inline` untouched — every class name stays valid because it maps to a variable, not a literal.

Set exactly: `--shell #0C1211`, `--surface #151F1D`, `--surface-low #101A18`, `--sprite-well #101A18`, `--line #2E4642`, `--bevel #C9C1A8`, `--bevel-shadow #2E4642`, `--fg #F3EEDD`, `--fg-soft #C9C1A8`, `--fg-muted #A9B8B2`, `--mint #6FD0AE`, `--mint-tint #0C3B35`, `--coral-text #FF9C86`.

Leave unchanged: `--fg-faint #7A9187`, `--surface-hi #274438`, `--bevel-soft #4B5A56`, `--coral #F2735A`, `--coral-tint #2A1B18`, `--butter*`, `--entry`, `--bronze`, `--silver`, `--gold`, `--nav-h`, `--gut`.

Add a new `/* ADOPTED FROM THE HANDOFF */` group with `--track #243532`, `--cream #F6EFD9`, `--ember #FF6A4D`, `--coral-edge #A8452F`, `--off #4B5A56`, each with a one-line comment naming its use (trough, lightest text, warmest accent, coral button bevel, disabled outline). These are values only — do **not** add `@theme` mappings for them until a screen needs the class; `--track` and `--cream` have no consumer in this batch and an unused Tailwind colour is vocabulary without a user.

Also update the file's header comment: the source line currently credits "Savborne Type & Colour Specimen.html — Direction A v2"; the values now come from `Savborne-handoff.html`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/lib/tokens.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Confirm nothing depended on the old literals**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tests pass (117 before this batch plus 5), tsc silent, lint reports 0 errors and at most the 41 pre-existing warnings. A new warning means a token reference broke.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/lib/tokens.test.ts
git commit -m "feat(theme): adopt the handoff palette, keeping every token name

Value-only swap in globals.css: class names, variable names and the @theme
mapping are untouched, so no component markup changes for colour.

--fg-faint deliberately keeps #7A9187. The handoff labels #4B5A56 "Disabled
outline" and it measures 2.32:1 on --surface, so it is added as its own --off
token for disabled outlines instead of becoming caption text.

A test parses globals.css and asserts both the values and that every text token
clears 4.5:1 on all three surfaces, because a value swap cannot fail to compile."
```

---

### Task 2: Motion tokens and a reduced-motion guard

The app defines no motion variables at all, so these are additive. They ship with the guard now, because the batches after this one will reach for `700ms` fills and `900ms` celebrations and nothing in the app would stop them.

**Files:**
- Modify: `src/app/globals.css` (`:root`, plus a new media query after it)
- Test: `src/lib/tokens.test.ts` (extend)

**Interfaces:**
- Consumes: the `:root` block from Task 1.
- Produces: `--ease`, `--t-press`, `--t-enter`, `--t-fill`, `--t-pop` as CSS variables, each neutralised under `prefers-reduced-motion: reduce`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/tokens.test.ts`:

```ts
function block(css: string, header: string): string {
  const start = css.indexOf(header)
  if (start < 0) return ''
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  return ''
}

test('motion tokens are the art bible values', () => {
  assert.match(CSS, /--ease:\s*cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/)
  assert.match(CSS, /--t-press:\s*80ms/)
  assert.match(CSS, /--t-enter:\s*180ms/)
  assert.match(CSS, /--t-fill:\s*700ms/)
  assert.match(CSS, /--t-pop:\s*900ms/)
})

test('every motion duration is neutralised under prefers-reduced-motion', () => {
  const reduce = block(CSS, '@media (prefers-reduced-motion: reduce)')
  assert.notEqual(reduce, '', 'no prefers-reduced-motion block found')
  for (const token of ['--t-press', '--t-enter', '--t-fill', '--t-pop']) {
    assert.match(reduce, new RegExp(`${token}:\\s*0\\.01ms`), `${token} not neutralised`)
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/tokens.test.ts`
Expected: FAIL — no `--ease` declaration, and `no prefers-reduced-motion block found`.

- [ ] **Step 3: Add the tokens and the guard**

In the `:root` block add:

```css
  /* MOTION — shared curves so screens do not re-type them */
  --ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --t-press: 80ms;
  --t-enter: 180ms;
  --t-fill: 700ms;
  --t-pop: 900ms;
```

Immediately after the `:root` block add:

```css
/* Vestibular safety. 0.01ms rather than 0s on purpose: a zero-duration
   transition does not fire transitionend in every engine, and later screens key
   state off that event. */
@media (prefers-reduced-motion: reduce) {
  :root {
    --t-press: 0.01ms;
    --t-enter: 0.01ms;
    --t-fill: 0.01ms;
    --t-pop: 0.01ms;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/lib/tokens.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/lib/tokens.test.ts
git commit -m "feat(theme): add motion tokens with a reduced-motion guard

The app defined no motion variables, so these are additive. The guard ships in
the same task on purpose: later batches will use the 700ms fill and 900ms pop
durations, and src/ currently has no prefers-reduced-motion rule anywhere to
collapse them."
```

---

### Task 3: Extract the nav icons into a tracked asset

The five nav icons exist only inside `Savborne-handoff.html`. Their source pack (`assets-raw/kenney_tinydungeon/`) is gitignored, so an asset built from it would vanish on a clean clone. This task extracts the rendered SVGs verbatim, so path data is never hand-transcribed.

Two findings from the spec decide the asset's shape, and both are asserted below: the icons are **multi-colour** (a Home tile is four hues, so no `currentColor` tint can reproduce them), and **only Home's artwork differs between active and inactive** — the other four keep identical fills and active state is carried by the label colour alone.

**Files:**
- Create: `scripts/nav-icons-vendor.mjs`
- Create: `scripts/nav-icons-verify.mjs`
- Create: `assets/nav-icons.json` (generated by the script, then committed)
- Test: `src/lib/nav-icons.test.ts` (create)

**Interfaces:**
- Consumes: `Savborne-handoff.html` (read-only).
- Produces: `assets/nav-icons.json` with shape
  `{ source: string, method: string, grid: string, icons: Record<'home'|'battle'|'missions'|'ranks'|'profile', { active: string, inactive: string }> }`,
  where each `string` is a complete `<svg …>…</svg>` element.

- [ ] **Step 1: Write the failing test**

Create `src/lib/nav-icons.test.ts`:

```ts
/**
 * The nav icons are the only art in the app whose source pack is gitignored, so
 * they are extracted into a tracked asset. These assertions are the contract the
 * component relies on; the drift verifier (scripts/nav-icons-verify.mjs) is what
 * checks the asset against the handoff.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

type Icon = { active: string; inactive: string }
const ASSET = JSON.parse(
  readFileSync(new URL('../../assets/nav-icons.json', import.meta.url), 'utf8')
) as { icons: Record<string, Icon> }

const TABS = ['home', 'battle', 'missions', 'ranks', 'profile'] as const

test('there is exactly one icon per nav tab', () => {
  assert.deepEqual(Object.keys(ASSET.icons).sort(), [...TABS].sort())
})

test('both states exist for every tab', () => {
  for (const tab of TABS) {
    assert.match(ASSET.icons[tab].active, /^<svg[\s\S]*<\/svg>$/, `${tab} active`)
    assert.match(ASSET.icons[tab].inactive, /^<svg[\s\S]*<\/svg>$/, `${tab} inactive`)
  }
})

test('icons are 16x16 art rendered at 24px with pixelated scaling', () => {
  for (const tab of TABS) {
    for (const state of ['active', 'inactive'] as const) {
      const svg = ASSET.icons[tab][state]
      assert.match(svg, /viewBox="0 0 16 16"/, `${tab} ${state} viewBox`)
      assert.match(svg, /width="24"/, `${tab} ${state} width`)
      assert.match(svg, /height="24"/, `${tab} ${state} height`)
      assert.match(svg, /image-rendering:\s*pixelated/, `${tab} ${state} scaling`)
    }
  }
})

test('home art changes on active and the other four do not', () => {
  assert.notEqual(ASSET.icons.home.active, ASSET.icons.home.inactive)
  for (const tab of ['battle', 'missions', 'ranks', 'profile'] as const) {
    assert.equal(ASSET.icons[tab].active, ASSET.icons[tab].inactive, `${tab} should not differ`)
  }
})

test('the icons are multi-colour, so they cannot be tinted with currentColor', () => {
  const fills = (svg: string) => new Set([...svg.matchAll(/fill="(#[0-9A-Fa-f]{6})"/gi)].map((m) => m[1].toUpperCase()))
  for (const tab of TABS) {
    const set = fills(ASSET.icons[tab].inactive)
    assert.ok(set.size >= 2, `${tab} renders as a single colour — the asset has been flattened`)
    assert.ok(!ASSET.icons[tab].inactive.includes('currentColor'), `${tab} must keep literal fills`)
  }
})

test('home active remaps one fill from ember to mint', () => {
  const { active, inactive } = ASSET.icons.home
  assert.ok(inactive.includes('#FF6A4D'), 'inactive home should carry ember')
  assert.ok(active.includes('#6FD0AE'), 'active home should carry mint')
  assert.ok(!active.includes('#FF6A4D'), 'active home should no longer carry ember')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/nav-icons.test.ts`
Expected: FAIL — `ENOENT … assets/nav-icons.json`.

- [ ] **Step 3: Write the extractor**

Create `scripts/nav-icons-vendor.mjs`. It reads the handoff and writes `assets/nav-icons.json`.

Two hard-won details, both of which cost an iteration during the spec review:

- **Slice screens by their `id="A_` boundaries.** Taking `html.slice(html.indexOf('id="A_Home"'))` and then `lastIndexOf('<nav')` on that runs to the end of the document and grabs the *last* screen's nav bar, silently producing another screen's icons.
- **The label styles are inline on each `<a>`**, not in the document's `<style>` block. The label text is a bare text node inside the anchor, after the `<svg>`.

Algorithm:

1. Split the document at every `id="A_[A-Za-z0-9]+"` match into screen chunks.
2. For each chunk, take `chunk.slice(chunk.lastIndexOf('<nav'))`, then match every `<a …>…</a>`.
3. For each anchor: `label = inner.replace(/<[^>]+>/g, '').trim()`, `active = /aria-current="page"/.test(attrs)`, `svg = inner.match(/<svg[\s\S]*?<\/svg>/)[0]`.
4. Keep the first SVG seen per `(label.toLowerCase(), active ? 'active' : 'inactive')`. If a later occurrence differs, fail loudly — the handoff would be inconsistent and the asset would be arbitrary.
5. Only accept the run if all ten screen nav bars contributed five anchors; otherwise fail.
6. Write the JSON with `source: 'Savborne-handoff.html'`, `method: 'extracted by scripts/nav-icons-vendor.mjs'`, `grid: '16x16 art (viewBox 0 0 16 16), rendered 24x24 with image-rendering pixelated'`.

Then run it:

```bash
node scripts/nav-icons-vendor.mjs
```

Expected: prints the five tabs with their fill lists and a count of nav bars seen (10), then writes `assets/nav-icons.json`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/lib/nav-icons.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the drift verifier**

Create `scripts/nav-icons-verify.mjs`. It re-runs steps 1–5 of the extractor in memory and compares the result to the committed `assets/nav-icons.json`, printing a per-tab/per-state OK/DRIFT line and exiting non-zero on any difference. This is the gate that stops the asset and the handoff diverging, matching `scripts/glyph-provenance.mjs`.

Run: `node scripts/nav-icons-verify.mjs`
Expected: `5 tabs, 10 states verified, 0 drift`, exit 0.

- [ ] **Step 6: Confirm the asset is committed, not ignored**

Run: `git check-ignore -v assets/nav-icons.json`
Expected: no output (the file is tracked). If it prints a rule, the asset was written under `assets-raw/` by mistake — move it.

- [ ] **Step 7: Commit**

```bash
git add scripts/nav-icons-vendor.mjs scripts/nav-icons-verify.mjs assets/nav-icons.json src/lib/nav-icons.test.ts
git commit -m "feat(nav): extract the five nav icons into a tracked asset

The icons are 16x16 Tiny Dungeon tiles whose source pack lives in assets-raw/,
which is gitignored — so the only durable copy was inside Savborne-handoff.html.
Extract the rendered SVGs verbatim instead of rebuilding them from the pack.

The asset stores both states per tab because the art is multi-colour: a Home tile
is four fills, so it cannot be reproduced with currentColor or a CSS filter. Only
Home's artwork actually differs between states; the other four are byte-identical
and carry active state through the label colour alone.

nav-icons-verify.mjs re-extracts and fails on drift, the same pattern as
glyph-provenance.mjs."
```

---

### Task 4: The nav data module

Tab order, labels, hrefs and active-matching as a pure module, so the component stays a rendering concern and the rules are testable without a renderer.

**Files:**
- Create: `src/lib/nav.ts`
- Test: `src/lib/nav.test.ts` (create)

**Interfaces:**
- Consumes: nothing at runtime; the tests and Task 5 rely on `assets/nav-icons.json`'s keys.
- Produces:
  - `export type NavIcon = 'home' | 'battle' | 'missions' | 'ranks' | 'profile'`
  - `export type NavTab = { href: string; label: string; icon: NavIcon }`
  - `export const NAV_TABS: readonly NavTab[]`
  - `export function isTabActive(pathname: string, href: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/nav.test.ts`:

```ts
/**
 * The nav is data, not JSX: order, labels and hrefs come from the handoff, while
 * the hrefs themselves stay the app's real routes.
 *
 * isTabActive exists because the old bar compared pathname === href, which
 * highlights nothing on a pushed screen like /battle/123 — the player sees a nav
 * with no current tab while mid-battle.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { NAV_TABS, isTabActive } from './nav'

test('five tabs in the handoff order', () => {
  assert.deepEqual(NAV_TABS.map((t) => t.label), ['Home', 'Battle', 'Missions', 'Ranks', 'Profile'])
})

test('hrefs are the app routes, not the document hrefs', () => {
  assert.deepEqual(NAV_TABS.map((t) => t.href), ['/', '/battle', '/missions', '/leaderboard', '/profile'])
})

test('vault is not a tab', () => {
  assert.ok(!NAV_TABS.some((t) => t.href === '/vault'))
})

test('labels are Title Case, not the old uppercase treatment', () => {
  for (const tab of NAV_TABS) {
    assert.match(tab.label, /^[A-Z][a-z]+$/, `${tab.label} is not Title Case`)
  }
})

test('every icon key exists in the extracted asset, and vice versa', () => {
  const asset = JSON.parse(
    readFileSync(new URL('../../assets/nav-icons.json', import.meta.url), 'utf8')
  ) as { icons: Record<string, unknown> }
  assert.deepEqual(NAV_TABS.map((t) => t.icon).sort(), Object.keys(asset.icons).sort())
})

test('the root tab is active only on the root', () => {
  assert.equal(isTabActive('/', '/'), true)
  assert.equal(isTabActive('/battle', '/'), false)
  assert.equal(isTabActive('/leaderboard', '/'), false)
})

test('a tab is active on its own route and on anything pushed beneath it', () => {
  assert.equal(isTabActive('/battle', '/battle'), true)
  assert.equal(isTabActive('/battle/abc-123', '/battle'), true)
  assert.equal(isTabActive('/leaderboard', '/leaderboard'), true)
  assert.equal(isTabActive('/missions/archive', '/missions'), true)
})

test('a tab is not active on a sibling route that merely shares a prefix', () => {
  assert.equal(isTabActive('/battlefield', '/battle'), false)
  assert.equal(isTabActive('/missions-archive', '/missions'), false)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/nav.test.ts`
Expected: FAIL — cannot find module `./nav`.

- [ ] **Step 3: Implement the module**

Create `src/lib/nav.ts` with the four exports from the Interfaces block.

`isTabActive` rules, which the tests pin:

- `href === '/'` matches only `pathname === '/'`.
- otherwise `pathname === href` or `pathname.startsWith(href + '/')` — the `'/'` suffix is what keeps `/battlefield` from matching `/battle`.
- also match a trailing slash on the exact route (`/battle/`), since Next can render one under a trailing-slash config.

Document in the header that tab order and labels come from `Savborne-handoff.html` while the hrefs stay the app's existing routes, and that Vault is reached from the Home savings card rather than a tab.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/lib/nav.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav.ts src/lib/nav.test.ts
git commit -m "feat(nav): add the tab table and active-route matching

Order and labels follow the handoff (Home, Battle, Missions, Ranks, Profile);
hrefs stay the app's real routes, so /home and /ranks are not created.

isTabActive fixes a real defect the old bar had: comparing pathname === href
highlighted no tab at all on a pushed screen such as /battle/123. It also avoids
the prefix trap where /battlefield would light up the Battle tab."
```

---

### Task 5: PixelNav replaces the tab bar

**Files:**
- Create: `src/components/PixelNav.tsx`
- Modify: `src/app/(tabs)/layout.tsx:12,27`
- Delete: `src/components/BottomTabBar.tsx`

**Interfaces:**
- Consumes: `NAV_TABS`, `isTabActive` from `@/lib/nav`; `assets/nav-icons.json` (Task 3).
- Produces: `export function PixelNav()` — no props.

- [ ] **Step 1: Implement the component**

Create `src/components/PixelNav.tsx` as a client component. It injects the extracted markup with `dangerouslySetInnerHTML`, which is the same narrow, justified use as `Glyphs.tsx`: the string is a build-time constant from a file in this repository, not user input.

Chrome values, all measured from the handoff rather than chosen:

| Property | Value |
|---|---|
| container height | `var(--nav-h)` (84px) |
| container padding | `8px 12px 20px`, with bottom raised to `calc(20px + env(safe-area-inset-bottom, 0px))` |
| container background | `bg-background` (`--shell` `#0C1211`, the ground — not `--surface`) |
| container top border | `border-t-2 border-bevel` (`#C9C1A8`, light; the old bar used `border-line`, which is dark) |
| anchor | `flex: 1`, column, centred, `gap 4px`, `min-height 56px` |
| label | `12px`, `fontWeight` 700 when active / 600 otherwise, Title Case text as authored |
| active colour | `text-mint` (`#6FD0AE`) |
| inactive colour | `text-fg-muted` (`#A9B8B2`) |

Requirements:

- Render from `NAV_TABS.map`, so the table stays the single source of order and labels.
- `const active = isTabActive(pathname, tab.href)` using `usePathname()`.
- Keep `data-tour="home"` on the root tab — `VaultTour` anchors on `[data-tour="home"]` and silently centres its card if the attribute disappears.
- Keep `aria-label="Primary"` on the `<nav>` and `aria-current={active ? 'page' : undefined}` on the active anchor.
- Inject the `active` or `inactive` SVG for the current state. Do not tint, filter, or rewrite fills — the art is multi-colour and Home's two states differ by a per-path hue remap.
- Mark the icon wrapper `aria-hidden`; the label is the accessible name.

- [ ] **Step 2: Wire it into the tabs layout**

In `src/app/(tabs)/layout.tsx` change the import on line 12 to `PixelNav` and the element on line 27 to `<PixelNav />`. Leave `VaultGuard`, `VaultTour`, and the `paddingBottom: calc(var(--nav-h) + env(safe-area-inset-bottom, 0px))` reservation untouched — that reservation is what stops content rendering under the bar.

Update the file's header comment: it currently says the bar has five tabs and lists Home, Missions, Battle, Profile, Leaderboard.

- [ ] **Step 3: Delete the old bar**

Run: `git rm src/components/BottomTabBar.tsx`

Then confirm nothing still references it:

Run (PowerShell): `Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String -Pattern "BottomTabBar"`
Expected: no output.

- [ ] **Step 4: Verify types, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: tsc silent; lint 0 errors with no new warnings beyond the 41 baseline; build succeeds. A `@typescript-eslint/no-explicit-any` or unescaped-entity warning here means the markup was written outside JSX rules.

- [ ] **Step 5: Commit**

```bash
git add src/components/PixelNav.tsx src/app/"(tabs)"/layout.tsx
git commit -m "feat(nav): replace the tab bar with PixelNav

Five tabs from the NAV_TABS table, with the handoff's own chrome: ground
background rather than surface, and a light bevel top border where the old bar
drew a dark line.

Labels become 12px Title Case at 700/600. The old text-[9px] uppercase sat below
the handoff's own stated 10px floor.

Icons come from the tracked asset in both states, injected verbatim — they are
multi-colour tiles, so there is no tint step. data-tour=\"home\" is preserved
because VaultTour's spotlight silently degrades without it.

BottomTabBar is deleted; it had one consumer."
```

---

### Task 6: Reach the vault from the Home savings card

Removing the Vault tab leaves the money path one tap deeper. `VaultGuard` already routes vaultless players to `/vault`, and Profile's "Show tour again" already pushes `/vault`, so nothing is orphaned — but the savings card is the surface the handoff treats as the money card, and it should open the vault.

**Files:**
- Modify: `src/app/(tabs)/page.tsx` (`BalanceCard`, lines 229–249)

**Interfaces:**
- Consumes: the `/vault` route (existing, unchanged).
- Produces: nothing other tasks use.

- [ ] **Step 1: Add the link inside the card**

`BalanceCard` renders `<section className="vpx bg-surface p-4 flex flex-col gap-1">` with an `<h2>` heading, the balance, and the last check-in line.

Keep it a `<section>`. Do **not** convert the card itself into a link: wrapping the `<h2>` and balance in an anchor makes the accessible name the entire card contents and puts a heading inside a link. Instead add one explicit link at the end of the card, after the last check-in line:

```tsx
<Link
  href="/vault"
  className="text-mint underline underline-offset-4 text-xs font-bold self-start mt-1"
>
  Open vault
</Link>
```

Add the `next/link` import to the file's import block.

Do not introduce a `.chip` utility for this — it is specified but deliberately deferred to the Economy batch, and this link needs no new vocabulary.

- [ ] **Step 2: Verify types, lint and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: tsc silent, lint 0 errors, build succeeds.

- [ ] **Step 3: Confirm the link resolves and reads correctly**

Run (PowerShell): `Select-String -Path "src/app/(tabs)/page.tsx" -Pattern "Open vault" -Context 2,2`
Expected: one match, inside `BalanceCard`, pointing at `/vault`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(tabs)/page.tsx"
git commit -m "feat(home): open the vault from the savings card

The Vault tab is gone, so the money card now links to /vault. A plain link inside
the section rather than a card-wide anchor: that would put the heading and the
balance into the link's accessible name."
```

---

### Task 7: Full verification and the sign-off render

**Files:** no source changes. This task produces evidence.

- [ ] **Step 1: Run the whole gate**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all pass; tests are 117 + 5 (tokens) + 2 (motion) + 6 (nav icons) + 8 (nav) = 138.

- [ ] **Step 2: Run the asset gates**

```bash
node scripts/nav-icons-verify.mjs
node scripts/glyph-provenance.mjs
node scripts/type-audit.mjs
node scripts/contrast-check.mjs
```

Expected: nav icons `0 drift`; glyph provenance `0 drift`; type audit unchanged from baseline; contrast check green.

Do **not** run `art-gates.mjs` or `structure-check.mjs` as gates for this batch. `art-gates.mjs` audits `Savborne-handoff.html`'s own pixels and `structure-check.mjs` diffs the handoff against a snapshot in `assets-raw/` — neither reads `src/`, and this batch does not modify the handoff.

- [ ] **Step 3: Render Home at 390×844 with Home active**

Start `npm run dev`, then use the in-app browser at a 390×844 viewport and capture `/`.

The capture must be **on the Home tab** so the active icon state is actually visible — a screenshot taken from another route shows only inactive icons and proves nothing about the state swap.

Save the screenshot under `docs/superpowers/` and show it to the user. This is the sign-off artefact for the batch: the new palette, the five Title Case labels, and the Home icon in its mint state.

- [ ] **Step 4: Render Home at 360px width**

Re-capture at 360px width (the narrowest phone target) and check the five labels sit on one line each with no clipping. Report the result either way — if a label wraps, the fix is to reduce the label `gap`/padding before touching the font size, since 12px is the handoff's value and the floor.

- [ ] **Step 5: Show both renders and stop for sign-off**

Present the 390px and 360px captures with a short note on what changed. Do not claim the batch is done on the strength of a green build — the phone remains the measure, and the user applies their own device pass.

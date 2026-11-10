# App-specific routes polish - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans.
> Steps use checkbox (`- [ ]`) syntax.

**Goal:** Restyle `/vault`, `/receipts` and `/card/[token]` to the Foundation 2
system with zero legacy `.vpx` / `.vpx-soft`, `.sv-input` fields on Vault, a
grouped movement panel, a friendly Receipts error with a 401 redirect, and a
nested off-tone Card sub-box.

**Architecture:** No new primitives and no shared CSS changes. The three pages
consume `ScreenShell`, `PixelPanel`, `Row`, `Button`, `Banner`,
`LoadingState`, `.sv-input` and `.sv-subheading` as they exist. Vault keeps
its tab shell and all money handlers unchanged. Receipts keeps the transfer
anatomy and adds the Missions-style 401 redirect. Card keeps its server
component, `getFlexCard` columns and 404 path.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind plus
`.sv-*` / `.pxw` / `.px`, node:test, the existing CDP render harness.

**Spec:** `docs/superpowers/specs/2026-11-10-app-routes-polish-design.md`.

## Global Constraints

- Branch `app-routes-polish` from `main` at `a41f704`; no stacking.
- Foundation 2 primitives only. No `.vpx`, no `.vpx-soft`, no ad-hoc panels,
  buttons or inputs.
- 12px type floor; 44px targets; no truncation at 360.
- Mint stays for success/progress/you. Section headings are `h2.sv-subheading`
  at default text.
- Vault money semantics do not change: received only after server settlement,
  expired hash terminal, `Try again` starts a new transaction.
- Receipts: hash and explorer link only when included; never on a snapshot.
- Card: public, read-only, no wallet, no session, no balance, no player wallet
  address; `getFlexCard` columns and the 404 path unchanged.
- No API, SQL, route or data changes.
- No shared CSS changes. If one is needed, stop and propose it first.
- One commit per task; `npm test`, `npx tsc --noEmit`, `npm run lint` and
  `npm run build` green before each commit.
- Never stage `.env.local`, `AGENTS.md` or InstaBox tooling.
- The capture harness lives in `/data/tmp/opencode/` and is not committed.
- Do not merge or push until the user signs off.

---

### Task 0: Branch, baseline and before renders

**Files:**
- Create: `docs/superpowers/renders/app-routes/before/vault-before@{360,390,430}.png`
- Create: `docs/superpowers/renders/app-routes/before/receipts-before@{360,390,430}.png`
- Create: `docs/superpowers/renders/app-routes/before/card-before@{360,390,430}.png`
- Create (not committed): `/data/tmp/opencode/capture-app-routes.mjs`
- Temporarily modify (reverted): `src/lib/vault/cards.ts`

- [ ] **Step 1: Confirm the branch and baseline**

```bash
git status --short --branch
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: `app-routes-polish`, 396 pass, tsc clean, lint 49 warnings / 0
errors, build exit 0. Record the exact numbers for audit section 22.

- [ ] **Step 2: Create the capture harness**

Copy `/data/tmp/opencode/capture-ranks.mjs` to
`/data/tmp/opencode/capture-app-routes.mjs`. Keep the CDP launch, connection,
device metrics, screenshot and audit blocks. Replace the Ranks fixture and
navigation as follows:

```js
const ROUTE = { vault: '/vault', receipts: '/receipts', card: '/card/fixture-card-token' }
const WIDTHS = [360, 390, 430]
const HEIGHT = 844
const PASS = 'savborne'
const VAULT = {
  address: 'NQ57 1111 1111 1111 1111 1111 1111 1111 1111',
  network: 'mainnet',
  cardToken: 'fixture-card-token',
  backupVerifiedAt: '2026-11-01T10:00:00.000Z',
  createdAt: '2026-10-01T10:00:00.000Z',
}
const TRANSFERS = [
  { id: 1, direction: 'in', amountLuna: 10_00000000, feeLuna: 0, txHash: 'aa'.repeat(32),
    status: 'included', blockHeight: 3123456, failureReason: null,
    explorerUrl: 'https://nimiq.watch/#aa', at: '2026-11-09T10:00:00.000Z' },
  { id: 2, direction: 'out', amountLuna: 1_50000000, feeLuna: 0, txHash: 'bb'.repeat(32),
    status: 'pending', blockHeight: null, failureReason: null, explorerUrl: null,
    at: '2026-11-09T09:00:00.000Z' },
  { id: 3, direction: 'in', amountLuna: 2_00000000, feeLuna: 0, txHash: 'cc'.repeat(32),
    status: 'expired', blockHeight: null, failureReason: 'wrong_recipient', explorerUrl: null,
    at: '2026-11-08T09:00:00.000Z' },
]
```

Intercept these in the injected fixture's `window.fetch` wrapper, returning
`json(...)` and falling through to `realFetch` otherwise:

| Match | Response |
|---|---|
| `/api/vaults` | `{ vault: VAULT }`, `{ vault: null }` for `no-vault`, 500 for `error`, 2500ms delay for `loading` |
| `/api/transfers` (GET, list) | `{ transfers: TRANSFERS }`, `[]` for `empty` |
| `/api/transfers/<hash>` (GET, one) | `{ transfer: TRANSFERS[0] }` |
| `/api/players/me` | `{ player: { shields: 2 } }` |
| `/api/receipts` | `{ items: MIXED }`, `[]` for `empty`, 500 for `error`, 2500ms for `loading` |
| RPC POST (the URL in `VAULT_RPC_URL`) | JSON-RPC result for `getAccountByAddress` with `balance: 12_34000000`; `0` for `empty` |

`MIXED` is the three transfers above plus:

```js
{ kind: 'snapshot', id: 4, balanceLuna: 12_34000000, at: '2026-11-09T08:00:00.000Z' }
```

For the unlocked Vault states, generate a real blob before launching Chrome:

```js
import { encryptPhrase } from '/data/home/work/savborne/src/lib/vault/crypto.ts'
const blob = await encryptPhrase(Array(24).fill('abandon'), PASS)
const stored = JSON.stringify({
  version: 1,
  address: 'NQ57 1111 1111 1111 1111 1111 1111 1111 1111',
  network: 'mainnet',
  createdAt: '2026-11-01T10:00:00.000Z',
  blob,
})
```

Run the harness with `node --import tsx`, seed
`localStorage['savborne.session.v1']` with `{ playerAddress: ADDRESS, ... }`,
seed `localStorage['savborne.vault.v1.<normalised ADDRESS>']` with `stored`, and
set `localStorage['savborne.tour.v1'] = 'done'`.

After the page is ready:

- `vault-default`, `vault-empty`: fill the passphrase field and click
  `Unlock vault`, then wait for `Withdraw` and the movements heading.
- `vault-locked`: do not unlock; wait for `Vault balance` and `Vault passphrase`.
- `vault-no-vault`: wait for `No vault yet`.
- `vault-error`: wait for `Couldn't load your vault`.
- `vault-loading`: wait 900ms after navigation.
- `receipts-*`: wait for `Deposit` / `Nothing here yet` / `Couldn't load
  receipts.` as appropriate.
- `card-valid`: wait for `Balances are never public`.

Slugs: `vault-before`, `receipts-before`, `card-before` when `BEFORE=1`;
otherwise `vault-default`, `vault-no-vault`, `vault-locked`, `vault-empty`,
`vault-error`, `vault-loading`, `receipts-mixed`, `receipts-empty`,
`receipts-error`, `receipts-loading`, `card-valid`.

- [ ] **Step 3: Add the temporary card fixture**

In `src/lib/vault/cards.ts`, temporarily replace the body of `getFlexCard`
with:

```ts
return {
  displayName: 'Adaeze',
  level: 14,
  streakCurrent: 6,
  shields: 3,
  bracket: 'silver',
  shortVaultAddress: 'NQ57 2F6C…ELRL',
  backupVerified: true,
}
```

Keep the function signature and imports so the build stays clean. Do not stage
this file.

- [ ] **Step 4: Capture the before renders**

```bash
npm run dev -- -p 3001 -H 0.0.0.0
STATE=vault BEFORE=1 OUT_DIR=docs/superpowers/renders/app-routes/before node --import tsx /data/tmp/opencode/capture-app-routes.mjs
STATE=receipts BEFORE=1 OUT_DIR=docs/superpowers/renders/app-routes/before node --import tsx /data/tmp/opencode/capture-app-routes.mjs
STATE=card BEFORE=1 OUT_DIR=docs/superpowers/renders/app-routes/before node --import tsx /data/tmp/opencode/capture-app-routes.mjs
```

Confirm 9 PNGs at 360/390/430, then stop the dev server.

- [ ] **Step 5: Revert the fixture**

```bash
git checkout -- src/lib/vault/cards.ts
git status --short
```

Expected: only `docs/superpowers/renders/app-routes/before/` and the two new
docs are untracked/modified.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/renders/app-routes/before
git commit -m "chore: app routes before renders"
```

---

### Task 1: Vault restyle

**Files:**
- Modify: `src/app/(tabs)/vault/page.tsx`
- Create: `src/lib/app-routes.test.ts`

- [ ] **Step 1: Write the failing Vault source contracts**

Create `src/lib/app-routes.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const VAULT = page('../app/(tabs)/vault/page.tsx')

test('Vault has no legacy panels', () => {
  assert.doesNotMatch(VAULT, /\.vpx|vpx-soft|\bvpx\b/)
})

test('Vault uses .sv-input for both amounts and the passphrase', () => {
  assert.equal((VAULT.match(/className="sv-input/g) ?? []).length, 2)
  assert.match(VAULT, /type="password"/)
  assert.match(VAULT, /sv-input/)
})

test('Vault section headings are the 20px sub-heading, not mint labels', () => {
  for (const title of ['Deposit', 'Withdraw', 'Recent movements']) {
    assert.match(VAULT, new RegExp(`<h2 className="sv-subheading">${title}</h2>`))
  }
  assert.doesNotMatch(VAULT, /<h2[^>]*text-mint/)
})

test('Vault movements are one grouped panel of Rows', () => {
  assert.match(VAULT, /import \{ Row \} from '@\/components\/ui\/Row'/)
  assert.match(VAULT, /<PixelPanel className="px-3\.5 py-0\.5">/)
  assert.match(VAULT, /<Row key=/)
})

test('Vault has one h1: the shell owns it', () => {
  assert.doesNotMatch(VAULT, /<h1/)
  assert.match(VAULT, /<h2 className="sv-subheading">No vault yet<\/h2>/)
})

test('Vault balance skeleton is static under reduced motion', () => {
  assert.match(VAULT, /animate-pulse motion-reduce:animate-none/)
})
```

- [ ] **Step 2: Run to verify failure**

```bash
node --import tsx --test src/lib/app-routes.test.ts
```

Expected: FAIL (`.vpx` inputs, mint headings, per-item cards, `h1`).

- [ ] **Step 3: Restyle the Vault page**

In `src/app/(tabs)/vault/page.tsx`:

1. Import `Row`.
2. Load-error banner: use `Couldn't load your vault.` / `Try again in
   a moment.` (no raw status) and replace the primary
   `Retry` with:

```tsx
<Button variant="secondary" size="sm" fullWidth={false} className="self-start" onClick={refresh}>
  Try again
</Button>
```

3. No-vault panel: `<h2 className="sv-subheading">No vault yet</h2>`. Nothing
   else changes.
4. Balance skeleton:

```tsx
<span className="h-9 w-40 bg-surface animate-pulse motion-reduce:animate-none inline-block" aria-hidden />
```

5. Balance-error button: secondary `Try again`, `size="sm"`,
   `fullWidth={false}`, `className="self-start"`.
6. Section headings: `<h2 className="sv-subheading">Deposit</h2>`,
   `<h2 className="sv-subheading">Withdraw</h2>`,
   `<h2 className="sv-subheading">Recent movements</h2>`.
7. `AmountField`: `className="sv-input num disabled:opacity-50"`; drop the
   `.vpx` and `p-3 text-base` classes.
8. Passphrase: wrap the input in a label with
   `<span className="sv-label text-fg-faint">Vault passphrase</span>` and
   `className="sv-input"`, keeping `type="password"` and the placeholder.
9. Movements:

```tsx
{transfers.length === 0 ? (
  <p className="sv-caption text-fg-faint italic">No movements yet.</p>
) : (
  <PixelPanel className="px-3.5 py-0.5">
    {transfers.slice(0, 8).map((t) => (
      <Row
        key={t.id}
        minHeight={56}
        divider
        trailing={
          <span className="sv-figure shrink-0">
            {(t.amountLuna / LUNA_PER_NIM).toFixed(2)}
          </span>
        }
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="sv-label">{t.direction === 'in' ? 'Deposit' : 'Withdrawal'}</span>
          <span className="sv-caption text-fg-muted">{statusLabel(t.status, t.failureReason)}</span>
        </div>
      </Row>
    ))}
  </PixelPanel>
)}
```

10. Keep the Receipts / Share links in a `flex flex-wrap gap-x-4` row. Keep
    `ShieldStrip`, the network banner, the backup panel, the empty-vault
    sentence, every handler, every disabled expression and every notice string
    unchanged.

- [ ] **Step 4: Verify**

```bash
node --import tsx --test src/lib/app-routes.test.ts
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: new tests pass, 402 pass, tsc clean, lint 49 warnings / 0 errors,
build exit 0.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(tabs)/vault/page.tsx' src/lib/app-routes.test.ts
git commit -m "feat: restyle the vault on foundation 2"
```

---

### Task 2: Receipts restyle

**Files:**
- Modify: `src/app/receipts/page.tsx`
- Modify: `src/lib/app-routes.test.ts`

- [ ] **Step 1: Write the failing Receipts contracts**

Append to `src/lib/app-routes.test.ts`:

```ts
const RECEIPTS = page('../app/receipts/page.tsx')

test('Receipts has no legacy panels and keeps the transfer anatomy', () => {
  assert.doesNotMatch(RECEIPTS, /\.vpx|vpx-soft|\bvpx\b/)
  for (const text of ['Check again', 'Try again', 'explorerUrl', "'included'"]) {
    assert.match(RECEIPTS, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('Receipts snapshots are off-tone panels with no hash', () => {
  assert.match(RECEIPTS, /<PixelPanel tone="off"/)
  const snapshot = RECEIPTS.slice(RECEIPTS.indexOf('function SnapshotRow'))
  assert.doesNotMatch(snapshot, /txHash|explorerUrl/)
})

test('Receipts load error is friendly, recoverable and redirects 401', () => {
  assert.match(RECEIPTS, /const LOAD_ERROR = "Couldn't load receipts\."/)
  assert.match(RECEIPTS, /res\.status === 401/)
  assert.match(RECEIPTS, /router\.replace\('\/setup'\)/)
  assert.match(RECEIPTS, /<Button[^>]*variant="secondary"[^>]*size="sm"[^>]*fullWidth=\{false\}/)
  assert.match(RECEIPTS, /Try again/)
  assert.doesNotMatch(RECEIPTS, /\(\$\{res\.status\}\)/)
})
```

- [ ] **Step 2: Run to verify failure**

```bash
node --import tsx --test src/lib/app-routes.test.ts
```

Expected: FAIL (`.vpx-soft` snapshot, raw status, no 401).

- [ ] **Step 3: Restyle the Receipts page**

1. Import `useRouter` from `next/navigation`; create
   `const router = useRouter()`.
2. Add `const LOAD_ERROR = "Couldn't load receipts."`.
3. In `load`:

```ts
const res = await fetch('/api/receipts', { headers: authHeaders() })
if (res.status === 401) {
  router.replace('/setup')
  return
}
if (!res.ok) throw new Error(LOAD_ERROR)
```

and add `router` to the `useCallback` dependency array.
4. Error banner:

```tsx
<Banner tone="error">
  <p className="sv-label">{LOAD_ERROR}</p>
  <Button
    variant="secondary"
    size="sm"
    fullWidth={false}
    className="self-start"
    onClick={load}
  >
    Try again
  </Button>
</Banner>
```

5. `SnapshotRow`:

```tsx
<li>
  <PixelPanel tone="off" className="px-4 py-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
    <span className="sv-label text-fg-muted">Balance check-in</span>
    <span className="sv-figure text-fg-soft">
      {(item.balanceLuna / LUNA_PER_NIM).toFixed(2)} NIM
    </span>
    <span className="sv-caption text-fg-faint">{formatWhen(item.at)}</span>
  </PixelPanel>
</li>
```

6. Keep the transfer panel, the included/pending/expired branches, the
   explorer link rule, `humanReason`, `formatWhen`, `LoadingState` and the
   empty-state copy unchanged.

- [ ] **Step 4: Verify**

```bash
node --import tsx --test src/lib/app-routes.test.ts
npm test
npx tsc --noEmit
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/receipts/page.tsx src/lib/app-routes.test.ts
git commit -m "feat: restyle receipts and handle load failures"
```

---

### Task 3: Card restyle

**Files:**
- Modify: `src/app/card/[token]/page.tsx`
- Modify: `src/lib/app-routes.test.ts`

- [ ] **Step 1: Write the failing Card contracts**

Append to `src/lib/app-routes.test.ts`:

```ts
const CARD = page('../app/card/[token]/page.tsx')
const CARDS = page('../lib/vault/cards.ts')

test('Card has no legacy panels and no ScreenShell', () => {
  assert.doesNotMatch(CARD, /\.vpx|vpx-soft|\bvpx\b/)
  assert.doesNotMatch(CARD, /ScreenShell/)
})

test('Card keeps the public contract and the nested off-tone box', () => {
  assert.match(CARD, /<PixelPanel tone="off"/)
  assert.equal((CARD.match(/tone="off"/g) ?? []).length, 2)
  assert.match(CARD, /notFound\(\)/)
  assert.doesNotMatch(CARD, /balance|walletAddress|playerAddress/i)
  assert.match(CARD, /Balances are never public/)
})

test('getFlexCard still selects explicit columns only', () => {
  assert.match(CARDS, /select\('address, player_address, backup_verified_at'\)/)
  assert.match(CARDS, /select\('address, display_name, level, streak_current, bracket, shields'\)/)
  assert.doesNotMatch(CARDS, /select\('\*'\)/)
})
```

- [ ] **Step 2: Run to verify failure**

```bash
node --import tsx --test src/lib/app-routes.test.ts
```

Expected: FAIL (`.vpx-soft` inner box, only one off tone).

- [ ] **Step 3: Replace the inner box**

```tsx
<PixelPanel tone="off" className="p-3 flex flex-col gap-1">
  <span className="sv-section-label text-fg-faint">
    {card.backupVerified ? 'Verified saver ⟡' : 'Vault in progress'}
  </span>
  <span className="sv-figure font-mono text-fg-soft sv-break">
    {card.shortVaultAddress}
  </span>
  <span className="sv-label text-fg-faint">
    Funds held in this player&apos;s own vault. Savborne never holds them.
  </span>
</PixelPanel>
```

Keep the outer `PixelPanel tone="off"`, `generateMetadata`, `dynamic`,
`notFound()`, the stats, bracket, promises and `<main>` unchanged.

- [ ] **Step 4: Verify**

```bash
node --import tsx --test src/lib/app-routes.test.ts
npm test
npx tsc --noEmit
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add 'src/app/card/[token]/page.tsx' src/lib/app-routes.test.ts
git commit -m "feat: restyle the public flex card"
```

---

### Task 4: After renders, audit, review and audit doc

**Files:**
- Create: `docs/superpowers/renders/app-routes/after/*.png`
- Create: `docs/superpowers/renders/app-routes/audit/final-audit.jsonl`
- Create: `docs/superpowers/renders/app-routes/review/index.html`
- Create: `docs/superpowers/renders/app-routes/review/NOTES.md`
- Modify: `docs/superpowers/audits/2026-11-05-ui-gap-audit.md`
- Temporarily modify (reverted): `src/lib/vault/cards.ts`

- [ ] **Step 1: Re-apply the temporary card fixture**

Use the same replacement as Task 0, Step 3. Do not stage it.

- [ ] **Step 2: Capture the after renders**

```bash
npm run dev -- -p 3001 -H 0.0.0.0
for state in vault-default vault-no-vault vault-locked vault-empty vault-error vault-loading; do
  STATE=$state OUT_DIR=docs/superpowers/renders/app-routes/after node --import tsx /data/tmp/opencode/capture-app-routes.mjs
done
for state in receipts-mixed receipts-empty receipts-error receipts-loading; do
  STATE=$state OUT_DIR=docs/superpowers/renders/app-routes/after node --import tsx /data/tmp/opencode/capture-app-routes.mjs
done
STATE=card-valid OUT_DIR=docs/superpowers/renders/app-routes/after node --import tsx /data/tmp/opencode/capture-app-routes.mjs
```

Expected: 33 PNGs (11 states x 3 widths). Stop the dev server.

- [ ] **Step 3: Audit every state**

```bash
for state in vault-default vault-no-vault vault-locked vault-empty vault-error vault-loading receipts-mixed receipts-empty receipts-error receipts-loading card-valid; do
  STATE=$state AUDIT=1 node --import tsx /data/tmp/opencode/capture-app-routes.mjs
done > docs/superpowers/renders/app-routes/audit/final-audit.jsonl
```

Check each of the 33 rows for `overflowX: 0`, `wide: []`, `small: []`,
`minFont >= 12`, and no tab stop with `inView: false` or `covered: true`.
Record any deliberate exception in NOTES.md rather than hiding it.

- [ ] **Step 4: Revert the fixture and re-verify the committed tree**

```bash
git checkout -- src/lib/vault/cards.ts
npm test
npx tsc --noEmit
npm run lint
npm run build
grep -R "vpx" 'src/app/(tabs)/vault' src/app/receipts 'src/app/card/[token]' || true
```

Expected: 408 pass, tsc clean, lint 49 warnings / 0 errors, build exit 0, grep
empty.

- [ ] **Step 5: Build the review page and notes**

Create `docs/superpowers/renders/app-routes/review/index.html` from the Ranks
review template: one `<section>` per state, 360/390/430 strip, before strip for
Vault, Receipts and Card, plus a table of the audit results.

Create `NOTES.md` with:

- a sign-off checkbox per state;
- a corrections section per state;
- the deliberate choices: tab shell for Vault, locked-by-default state,
  grouped movement panel, `No movements yet.`, friendly Receipts error and 401
  redirect, off-tone snapshots, nested off-tone Card box, card render from a
  temporary fixture;
- the real-device Nimiq Pay pass as the user's step;
- “Do not merge or push until sign-off.”

- [ ] **Step 6: Append audit section 22**

Append to `docs/superpowers/audits/2026-11-05-ui-gap-audit.md`:

```md
## 22. App-specific routes polish - 2026-11-10
```

Include: branch and baseline, what landed per route, decisions, test counts,
the 33-row audit result, the 360 behaviour, rulings and the remaining
real-device pass.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/renders/app-routes docs/superpowers/audits/2026-11-05-ui-gap-audit.md
git commit -m "chore: app routes renders, audit and review"
```

- [ ] **Step 8: Final state**

```bash
git status --short --branch
git log --oneline -5
```

Expected: clean `app-routes-polish` branch, four commits, no fixture, no
`.env.local`, no `AGENTS.md`, no InstaBox tooling. Stop and ask for sign-off.

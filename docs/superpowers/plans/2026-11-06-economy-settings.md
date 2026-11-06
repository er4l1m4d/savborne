# Economy — Settings and Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/settings` and `/settings/delete`, move account deletion out of Profile, make Disconnect local-only with a working reconnect, and keep the existing delete security contract unchanged.

**Architecture:** Two pushed routes outside the `(tabs)` group reuse the Foundation 2 `ScreenShell`, `PixelPanel`, `Row`, `Button`, `Banner` and `BottomSheet`. The delete phase machine moves from `DeleteAccount.tsx` into a route-owned `DeleteAccountFlow`. Setup gains one read-only profile check before it creates a vault.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Tailwind utilities plus the `.sv-*`/`.pxw` classes in `src/app/globals.css`, node:test.

**Spec:** `docs/superpowers/specs/2026-11-06-economy-settings-design.md`

## Global Constraints

- Branch from the signed-off Foundation 2 head `669c4ec`; do not merge or rebase mid-batch.
- Use only Foundation 2 primitives and classes. No new `.vpx` panels; no ad-hoc buttons.
- Type floor: 12px everywhere except `.sv-state` (battle only). `PENDING` in `src/lib/type-floor.test.ts` stays empty.
- Primary/advancing CTAs are coral `variant="primary"`; destructive rows and final destructive buttons are `variant="destructive"` (warn fill).
- Every interactive target is at least 44×44.
- At 360px nothing may truncate an action label, balance, XP value or row title. Addresses and names wrap with `.sv-break`.
- No API route, schema, crypto or delete-signature changes. The only new network call is the read-only `GET /api/players/me` in Setup with an explicit address header.
- One commit per task, each including its render where the task has one.
- Never stage untracked user work: `AGENTS.md`, `assets/character-glows.json`, `scripts/character-glow.mjs`, `scripts/glow-ship.mjs`.
- Full suite must stay green: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Single-file test runs use the project runner: `node --import tsx --test src/lib/settings.test.ts` (bare `node --test` cannot load `.ts`).

## Review Focus

- A reconnect check must never create a vault or overwrite a session on a 404/401/500. Pinned in Task 2 (`reconnectDecision`) and Task 3 (source contract).
- Disconnect on a device with no local vault key must still sign out and must not call `clearVault` blindly. Pinned in Task 2 (`disconnectPlan`).
- Delete must not clear local state before the server confirms; the proof and signature must remain in the request. Pinned in Task 4 (source contract) and the existing `account-deletion.test.ts`.
- The no-vault delete path must reach Review directly and must not show an unlock/quiz step. Pinned by the existing `deletionGate(false, false) === 'confirm'` test plus Task 4.
- A 16-character display name and a full vault address must wrap at 360px without pushing the settings icon off-screen. Pinned in Task 7 (audit and renders).

---

### Task 0: Branch and before evidence

**Files:**
- Create: `docs/superpowers/renders/economy/before/profile@360.png`
- Create: `docs/superpowers/renders/economy/before/profile@390.png`
- Create: `docs/superpowers/renders/economy/before/profile@430.png`

**Interfaces:**
- Consumes: Foundation 2 head `669c4ec`.
- Produces: the branch and the Profile before renders used in Task 6.

- [ ] **Step 1: Create the branch**

```powershell
git switch -c feat/economy-settings 669c4ec
```

- [ ] **Step 2: Copy the current Profile renders**

Copy the three committed Foundation 2 Profile renders into the new folder; they are the true “before” for this slice.

```powershell
New-Item -ItemType Directory -Force docs/superpowers/renders/economy/before | Out-Null
Copy-Item docs/superpowers/renders/foundation-2/after/profile@360.png docs/superpowers/renders/economy/before/
Copy-Item docs/superpowers/renders/foundation-2/after/profile@390.png docs/superpowers/renders/economy/before/
Copy-Item docs/superpowers/renders/foundation-2/after/profile@430.png docs/superpowers/renders/economy/before/
```

- [ ] **Step 3: Run the baseline suite**

Run: `npm test`
Expected: 198 pass, 0 fail.

- [ ] **Step 4: Commit**

```powershell
git add docs/superpowers/renders/economy/before
git commit -m "chore: economy before renders"
```

---

### Task 1: Extract the shared privacy notice

**Files:**
- Create: `src/components/PrivacyNotice.tsx`
- Create: `src/lib/settings.test.ts`
- Modify: `src/app/setup/page.tsx` (`StepPrivacy`)

**Interfaces:**
- Consumes: nothing.
- Produces: `export function PrivacyNotice(): JSX.Element`, rendering the five paragraphs in a `flex flex-col gap-2` wrapper. Setup and Settings both render it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/settings.test.ts` with this header. Later tasks append to the same file and reuse the path constants.

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const SETUP = source('../app/setup/page.tsx')

test('Setup renders the shared privacy notice', () => {
  assert.match(SETUP, /from '@\/components\/PrivacyNotice'/)
  assert.match(SETUP, /<PrivacyNotice \/>/)
  assert.doesNotMatch(SETUP, /What we collect/)
})
```

Add each later path constant in the same task that creates the file it reads (`SETTINGS`, `DELETE_ROUTE`, `FLOW`, `PROFILE`), so the file never points at a missing path.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/settings.test.ts`
Expected: FAIL because `PrivacyNotice` does not exist and Setup still inlines “What we collect”.

- [ ] **Step 3: Create `PrivacyNotice` and use it in Setup**

Move the five `<p className="sv-label text-fg-soft">` paragraphs from `StepPrivacy` verbatim into `PrivacyNotice`, wrapped in `<div className="flex flex-col gap-2">`. In `StepPrivacy`, render `<PixelPanel tone="off" className="p-4 flex flex-col gap-2"><PrivacyNotice /></PixelPanel>` and delete the inline paragraphs.

- [ ] **Step 4: Run the test and the suite**

Run: `node --import tsx --test src/lib/settings.test.ts` → PASS.
Run: `npm test` → 199 pass, 0 fail.

- [ ] **Step 5: Commit**

```powershell
git add src/components/PrivacyNotice.tsx src/app/setup/page.tsx src/lib/settings.test.ts
git commit -m "refactor: share the privacy notice between setup and settings"
```

---

### Task 2: Reconnect and disconnect helpers

**Files:**
- Create: `src/lib/reconnect.ts`
- Modify: `src/lib/settings.test.ts`

**Interfaces:**
- Consumes: `Session` from `@/lib/session`.
- Produces:
  - `type ReconnectProfile = { address: string; displayName: string; savingsAddress: string }`
  - `sessionFromProfile(profile: ReconnectProfile): Session`
  - `type ReconnectDecision = 'reconnect' | 'create' | 'error'`
  - `reconnectDecision(status: number): ReconnectDecision` — 200 → `reconnect`, 404 → `create`, everything else → `error`.
  - `type DisconnectPlan = 'vault-and-session' | 'session-only'`
  - `disconnectPlan(hasLocalVault: boolean): DisconnectPlan`

- [ ] **Step 1: Write the failing tests**

```ts
import { sessionFromProfile, reconnectDecision, disconnectPlan } from './reconnect'

test('a profile maps to exactly the session fields', () => {
  const result = sessionFromProfile({
    address: 'NQ07 0000',
    displayName: 'Ada',
    savingsAddress: 'NQ57 1111',
  })
  assert.deepEqual(result, {
    playerAddress: 'NQ07 0000',
    displayName: 'Ada',
    savingsAddress: 'NQ57 1111',
  })
  assert.deepEqual(Object.keys(result).sort(), [
    'displayName',
    'playerAddress',
    'savingsAddress',
  ])
})

test('only a 200 reconnects and only a 404 creates', () => {
  assert.equal(reconnectDecision(200), 'reconnect')
  assert.equal(reconnectDecision(404), 'create')
  assert.equal(reconnectDecision(401), 'error')
  assert.equal(reconnectDecision(500), 'error')
})

test('disconnect clears the vault only when one is on this device', () => {
  assert.equal(disconnectPlan(true), 'vault-and-session')
  assert.equal(disconnectPlan(false), 'session-only')
})
```

The extra-fields assertion is the `Object.keys` check, not an extra property on the literal: `npx tsc --noEmit` type-checks test files, and an excess property on a `ReconnectProfile` literal would fail there even though `tsx` would run it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test src/lib/settings.test.ts`
Expected: FAIL with “Cannot find module … reconnect”.

- [ ] **Step 3: Implement `src/lib/reconnect.ts`**

Implement the three exports exactly as the Interfaces block specifies. `sessionFromProfile` returns only the three session keys, ignoring extra profile fields. No trimming, no validation: the caller only passes a parsed 200 profile.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test src/lib/settings.test.ts`
Expected: PASS, 4 tests (privacy + three new).

- [ ] **Step 5: Commit**

```powershell
git add src/lib/reconnect.ts src/lib/settings.test.ts
git commit -m "feat: add reconnect and disconnect session helpers"
```

---

### Task 3: Setup reconnects an existing profile

**Files:**
- Modify: `src/app/setup/page.tsx`
- Test: `src/lib/settings.test.ts`

**Interfaces:**
- Consumes: `sessionFromProfile`, `reconnectDecision` from `@/lib/reconnect`; `PLAYER_HEADER`, `writeSession` from `@/lib/session`.
- Produces: `async function chooseAccount(address: string)` in the Setup page; `StepCreateVault` uses `onPick={chooseAccount}`.

- [ ] **Step 1: Write the failing source contract**

```ts
test('Setup checks for an existing profile before creating a vault', () => {
  assert.match(SETUP, /reconnectDecision/)
  assert.match(SETUP, /\/api\/players\/me/)
  const choose = SETUP.indexOf('async function chooseAccount')
  const create = SETUP.indexOf('async function createVault')
  assert.ok(choose >= 0, 'chooseAccount is missing')
  assert.ok(create > choose, 'createVault must come after chooseAccount')
  assert.match(SETUP, /onPick=\{chooseAccount\}/)
  assert.match(SETUP, /We reconnect it instead of creating a second vault/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/settings.test.ts`
Expected: FAIL because `chooseAccount` is absent.

- [ ] **Step 3: Implement `chooseAccount`**

In `SetupPage`:

1. `setLoading(true)`, `setError(null)`.
2. `const res = await fetch('/api/players/me', { headers: { [PLAYER_HEADER]: address } })`.
3. `reconnectDecision(res.status)`:
   - `reconnect` → parse `{ player: ReconnectProfile }`, `writeSession(sessionFromProfile(json.player))`, `router.replace('/')`, return.
   - `create` → `await createVault(address)`, return.
   - `error` → throw `Could not check this wallet (${res.status}).`
4. `catch` → `setError(describe(err))`.
5. `finally` → `setLoading(false)`.

`createVault` already sets and clears its own `loading`; the outer `finally` clearing it again is harmless. Do not call `createVault` for a 401/500 — that is the failure this check exists to prevent.

Use `player.savingsAddress` for the reconnected session. For vault-era players it is the vault address: `create_player_with_vault` writes `p_vault_address` into `players.savings_account_address`, and `/api/players/me` returns that column. For a legacy row with no vault it remains the savings address Home already expected. That is why one read-only call is enough and no `/api/vaults` round-trip belongs here.

Pass `chooseAccount` to `StepCreateVault` and add the copy under the account buttons: “Already have a profile with this wallet? We reconnect it instead of creating a second vault.”

- [ ] **Step 4: Run the test, typecheck and suite**

Run: `node --import tsx --test src/lib/settings.test.ts` → PASS.
Run: `npx tsc --noEmit` → clean.
Run: `npm test` → 203 pass, 0 fail.

- [ ] **Step 5: Commit**

```powershell
git add src/app/setup/page.tsx src/lib/settings.test.ts
git commit -m "feat: reconnect an existing profile during setup"
```

No render: the picker is step 2 and the headless harness cannot approve a wallet prompt. This task is verified by the helper tests and the source contract; the real-device pass covers it.

---

### Task 4: Delete route and flow

**Files:**
- Create: `src/components/settings/DeleteAccountFlow.tsx`
- Create: `src/app/settings/delete/page.tsx`
- Test: `src/lib/settings.test.ts`
- Render: `docs/superpowers/renders/economy/after/delete@390.png`

**Interfaces:**
- Consumes: `deletionGate` from `@/lib/account-deletion`; `clearVault`, `readVault` from `@/lib/vault/storage`; `decryptPhrase`, `phraseMatchesVault`; `deleteAuthHeaders`, `deleteMessage`; `signMessage`; `authHeaders`, `readSession`, `writeSession`; `BottomSheet`, `PixelPanel`, `Button`, `Banner`; `BackupQuiz`, `CopyButton`.
- Produces: `export function DeleteAccountFlow({ playerAddress }: { playerAddress: string })`; the `/settings/delete` route renders it.

- [ ] **Step 1: Write the failing source contract**

```ts
const DELETE_ROUTE = source('../app/settings/delete/page.tsx')
const FLOW = source('../components/settings/DeleteAccountFlow.tsx')

test('the delete route keeps the proof gate and the signed request', () => {
  assert.match(DELETE_ROUTE, /<DeleteAccountFlow/)
  assert.match(FLOW, /deletionGate/)
  assert.match(FLOW, /signMessage/)
  assert.match(FLOW, /deleteAuthHeaders/)
  assert.match(FLOW, /<BottomSheet/)
  assert.doesNotMatch(FLOW, /phase === 'closed'/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/settings.test.ts`
Expected: FAIL because the route and flow do not exist.

- [ ] **Step 3: Implement `DeleteAccountFlow`**

Move the phase machine from `src/components/DeleteAccount.tsx` into the new component, with these changes only:

- Remove `closed`; start at `checking` and run the `/api/vaults` check on mount (`useEffect(() => { void start() }, [])`, with `start` stable enough for the linter — wrap it in `useCallback` or disable the dependency with a comment, matching the project's existing effect style).
- Drop the old outer `<h2 …>Account</h2>` and the `phase === 'closed'` entry button: the pushed header already names the screen, and the route has no closed phase.
- If the check fails, stay in `checking`: render the `Banner tone="error"` plus a `Try again` ghost button that calls `start()` again. Do not silently return to a closed state.
- Add `BottomSheet` state (`confirmOpen`) and put the real delete call in the sheet. The Review panel's `Delete everything` button opens the sheet; the sheet's confirm button is labelled `Yes, delete everything` so the two buttons are distinguishable.
- Add a dots + `Step N of M · <label>` indicator, reusing the Setup markup (one 8px square per step plus one active label, no new CSS): 4 steps for `unlock` (Proof, Reveal, Quiz, Review), 2 for `type-words` (Proof, Review), 1 for `confirm` (Review). Do not render the indicator while `checking`.
- Keep every existing security call, validation, copy-to-clipboard requirement and error mapping unchanged.
- Keep the closing line “Deleting does not move or destroy NIM. Your vault phrase remains the only key to the funds.”
- On success: `clearVault`, `writeSession(null)`, remove `TOUR_FLAG_KEY`, `window.location.replace('/setup')`.
- On failure: close the sheet, show the `Banner`, reset `busy` so retry is reachable.

The route is a client component that reads the session in an effect, redirects to `/setup` when absent, and renders:

```tsx
<ScreenShell variant="pushed" title="Delete account" backHref="/settings">
  <DeleteAccountFlow playerAddress={playerAddress} />
</ScreenShell>
```

Read the session into state rather than during render (`const [playerAddress, setPlayerAddress] = useState<string | null>(null)`), because `localStorage` is not available during the server render.

- [ ] **Step 4: Run the test, typecheck and suite**

Run: `node --import tsx --test src/lib/settings.test.ts` → PASS.
Run: `npx tsc --noEmit` → clean.
Run: `npm test` → 204 pass, 0 fail.

- [ ] **Step 5: Render the route**

The harness’s injected source already writes a local vault, so `/settings/delete` reaches the proof phase.

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /settings/delete --width 390 --out docs/superpowers/renders/economy/after/delete@390.png
```

Inspect the PNG: pushed header with back, “Delete account”, the step label, the passphrase proof panel, and no bottom nav.

- [ ] **Step 6: Commit**

```powershell
git add src/components/settings/DeleteAccountFlow.tsx src/app/settings/delete/page.tsx src/lib/settings.test.ts docs/superpowers/renders/economy/after/delete@390.png
git commit -m "feat: add the settings delete route"
```

`src/components/DeleteAccount.tsx` stays in place until Task 6 so Profile keeps working; Task 6 deletes it.

---

### Task 5: Settings screen

**Files:**
- Create: `src/app/settings/page.tsx`
- Test: `src/lib/settings.test.ts`
- Render: `docs/superpowers/renders/economy/after/settings@390.png`

**Interfaces:**
- Consumes: `ScreenShell`, `PixelPanel`, `Row`, `Button`, `ButtonLink`, `Banner`, `BottomSheet`, `PrivacyNotice`, `BackupSettings`, `TOUR_FLAG_KEY`, `clearVault`, `readSession`, `writeSession`, `authHeaders`, `disconnectPlan`, `readVault`.
- Produces: the `/settings` route.

- [ ] **Step 1: Write the failing source contract**

```ts
const SETTINGS = source('../app/settings/page.tsx')

test('Settings is a pushed screen with both destructive actions', () => {
  assert.match(SETTINGS, /variant="pushed"/)
  assert.match(SETTINGS, /backHref="\/profile"/)
  assert.match(SETTINGS, /Disconnect savings account/)
  assert.match(SETTINGS, /href="\/settings\/delete"/)
  assert.match(SETTINGS, /<BottomSheet/)
  assert.match(SETTINGS, /<PrivacyNotice \/>/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/settings.test.ts`
Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement the Settings page**

`'use client'`. State: `playerAddress` (from an effect), `profile` (`{ player: { address: string; displayName: string } }`), `vault` (`{ address: string; backupVerifiedAt: string | null } | null`), `error`, `loading`, `sheet: 'privacy' | 'disconnect' | null`, `busy`.

On mount:

- `readSession()`; no session → `router.replace('/setup')`.
- Fetch `/api/profile` and `/api/vaults` in parallel with `authHeaders()`.
- `/api/profile` 401 → `/setup`; other failure → `Banner tone="error"` with a Retry button that re-runs the load.
- `/api/vaults` failure is non-fatal: show `Vault unavailable` in the Account row and keep the rest.
- While loading, render `<p className="sv-body text-fg-muted">Loading settings…</p>` inside the shell.

Render `<ScreenShell variant="pushed" title="Settings" backHref="/profile">` with:

Each section opens with `<h2 className="sv-section-label text-mint">Account</h2>` (same for Help and About). Danger zone uses `text-coral-text`. Backup needs no heading because `BackupSettings` renders one.

1. **Account** — `<PixelPanel className="px-4 py-0">` containing `Row`s (`divider` between them). Each row's children are a `flex flex-wrap items-baseline justify-between gap-2 py-2` line: the label (`sv-label text-fg-muted`) and the value, so a long name or address wraps under its label at 360px instead of colliding. Values: display name from `/api/profile`; vault address (`short(vault.address)`, `sv-figure font-mono sv-break`, or `Not created`); backup status (`Verified` in mint when `backupVerifiedAt`, else `Not backed up` in coral-text). Define `short(a)` the same way Setup does: first 6 + last 4 with an ellipsis when longer than 12.
2. **Backup** — `<BackupSettings />` directly. It owns its own “Backup” heading, so do not add a second one.
3. **Help** — `<PixelPanel className="p-2 flex flex-col gap-1">` with two full-width `Button variant="ghost" className="justify-start"` actions: `Show tour again` (remove `TOUR_FLAG_KEY`, `router.push('/vault')`) and `Contact` (sets `window.location.href = \`mailto:${CONTACT_EMAIL}\``). Define `const CONTACT_EMAIL = 'damilareogooluwade@outlook.com'` in this file; Profile's copy is removed in Task 6.
4. **About** — same panel style: `Version` (`v{version}` imported from `../../../package.json`), `Your address` (`short(playerAddress)`, mono), and a `Privacy notice` ghost button that sets `sheet = 'privacy'`. Below the panel, the custody line from the old Profile footer: “Savborne never holds your NIM. A 24-word phrase generated on your device controls your vault. Balances are read from the chain, never stored by us.”
5. **Danger zone** — `<h2 className="sv-section-label text-coral-text">Danger zone</h2>`, then a `Button variant="destructive"` `Disconnect savings account` that sets `sheet = 'disconnect'`, and a `ButtonLink variant="destructive" href="/settings/delete"` `Delete account`.

Sheets, rendered once at the end of the body:

```tsx
<BottomSheet open={sheet === 'privacy'} onClose={() => setSheet(null)} title="Privacy notice">
  <PrivacyNotice />
  <Button variant="ghost" onClick={() => setSheet(null)}>Close</Button>
</BottomSheet>

<BottomSheet open={sheet === 'disconnect'} onClose={() => setSheet(null)} title="Disconnect this device?">
  {/* spec §7.1 copy */}
  <Button variant="destructive" loading={busy} onClick={disconnect}>Disconnect</Button>
  <Button variant="ghost" onClick={() => setSheet(null)}>Cancel</Button>
</BottomSheet>
```

`disconnect` reads `readVault(playerAddress) !== null`, calls `disconnectPlan(...)`, calls `clearVault(playerAddress)` only for `vault-and-session`, then `writeSession(null)` and `window.location.replace('/setup')`. Keep `TOUR_FLAG_KEY`. Guard the whole action with `busy` so a double tap cannot run it twice. When no local key exists, the sheet's first line becomes “This device has no vault key; this only signs you out.”

- [ ] **Step 4: Run the test, typecheck and suite**

Run: `node --import tsx --test src/lib/settings.test.ts` → PASS.
Run: `npx tsc --noEmit` → clean.
Run: `npm test` → 205 pass, 0 fail.

- [ ] **Step 5: Render the screen**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /settings --width 390 --out docs/superpowers/renders/economy/after/settings@390.png
```

Inspect: pushed header, Account rows, Backup, Help, About, Danger zone; no bottom nav; no truncation.

- [ ] **Step 6: Commit**

```powershell
git add src/app/settings/page.tsx src/lib/settings.test.ts docs/superpowers/renders/economy/after/settings@390.png
git commit -m "feat: add the settings screen"
```

---

### Task 6: Profile entry and cleanup

**Files:**
- Modify: `src/app/(tabs)/profile/page.tsx`
- Delete: `src/components/DeleteAccount.tsx`
- Test: `src/lib/settings.test.ts`
- Render: `docs/superpowers/renders/economy/after/profile@390.png`

**Interfaces:**
- Consumes: `ButtonLink`, `Glyph`, `BRACKETS`.
- Produces: the Profile header contract: `title="Profile"`, settings icon `aria-label="Settings"` to `/settings`, and the name/level/bracket identity strip.

- [ ] **Step 1: Write the failing source contract**

```ts
const PROFILE = source('../app/(tabs)/profile/page.tsx')

test('Profile links to Settings and no longer owns account deletion', () => {
  assert.match(PROFILE, /href="\/settings"/)
  assert.match(PROFILE, /aria-label="Settings"/)
  assert.doesNotMatch(PROFILE, /DeleteAccount/)
  assert.doesNotMatch(PROFILE, /BackupSettings/)
  assert.doesNotMatch(PROFILE, /Show tour again/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/settings.test.ts`
Expected: FAIL because Profile still imports `DeleteAccount` and `BackupSettings`.

- [ ] **Step 3: Implement the Profile change**

- `title="Profile"`.
- `actions`: `<ButtonLink href="/settings" variant="icon" aria-label="Settings"><Glyph name="flag" size={24} /></ButtonLink>`.
- First body block: `<h2 className="sv-heading sv-break">{data.player.displayName}</h2>` and a `.sv-label text-fg-muted` line with `Level {data.player.level}` plus the existing bracket `Chip` in a wrapping flex row.
- Remove `DeleteAccount`, `BackupSettings`, the Help section, and the footer.
- Remove the now-unused `TOUR_FLAG_KEY` and `DeleteAccount`/`BackupSettings` imports, the `CONTACT_EMAIL` constant, and the `short()` helper if the footer was its only caller. `Button` stays: `ShareCardSection` uses it.
- Keep the share section, stats, badges and inventory.
- Delete `src/components/DeleteAccount.tsx`; nothing imports it now.

- [ ] **Step 4: Run the test, typecheck and suite**

Run: `node --import tsx --test src/lib/settings.test.ts` → PASS.
Run: `npx tsc --noEmit` → clean.
Run: `npm test` → 206 pass, 0 fail.

- [ ] **Step 5: Render and compare**

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /profile --width 390 --out docs/superpowers/renders/economy/after/profile@390.png
```

Compare with `docs/superpowers/renders/economy/before/profile@390.png`: settings icon present, name still visible, delete/backup/help/footer gone.

- [ ] **Step 6: Commit**

```powershell
git add "src/app/(tabs)/profile/page.tsx" src/components/DeleteAccount.tsx src/lib/settings.test.ts docs/superpowers/renders/economy/after/profile@390.png
git commit -m "feat: open settings from profile and move account actions out"
```

---

### Task 7: Verification and sign-off evidence

**Files:**
- Create: `docs/superpowers/renders/economy/after/*.png` (full sweep)
- Create: `docs/superpowers/renders/economy/review/index.html` + `NOTES.md` + `current/*.png`
- Modify: `docs/superpowers/audits/2026-11-05-ui-gap-audit.md` (Economy status note only)
- Modify: `.superpowers/sdd/.../progress.md` (execution ledger, git-ignored)

**Interfaces:**
- Consumes: every task above.
- Produces: the evidence package for sign-off.

- [ ] **Step 1: Run the full suite**

Stop the dev server so `next build` owns `.next`, then:

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: `npm test` 206 pass, 0 fail; the other three exit 0. Lint keeps its 41 pre-existing warnings and adds no errors.

- [ ] **Step 2: Prove the type floor**

```powershell
Get-ChildItem -Recurse -File -Path src -Include *.tsx | Select-String -Pattern 'text-\[(10|11)px\]'
```

Expected: no output.

- [ ] **Step 3: Capture the after sweep**

Restart the dev server, then capture Profile, Settings and Delete at all three widths:

```powershell
node "$env:TEMP/opencode/capture-ui.mjs" --route /profile --width 360 --out docs/superpowers/renders/economy/after/profile@360.png
node "$env:TEMP/opencode/capture-ui.mjs" --route /profile --width 430 --out docs/superpowers/renders/economy/after/profile@430.png
node "$env:TEMP/opencode/capture-ui.mjs" --route /settings --width 360 --out docs/superpowers/renders/economy/after/settings@360.png
node "$env:TEMP/opencode/capture-ui.mjs" --route /settings --width 430 --out docs/superpowers/renders/economy/after/settings@430.png
node "$env:TEMP/opencode/capture-ui.mjs" --route /settings/delete --width 360 --out docs/superpowers/renders/economy/after/delete@360.png
node "$env:TEMP/opencode/capture-ui.mjs" --route /settings/delete --width 430 --out docs/superpowers/renders/economy/after/delete@430.png
```

Inspect all six. At 360px, confirm the name and address wrap and the settings icon stays on-screen.

- [ ] **Step 4: Keyboard and touch audit**

Run the harness `--audit` for `/profile`, `/settings` and `/settings/delete` at 360/390/430. Confirm `overflowX: 0`, no element wider than the viewport, no target below 44×44, minimum font 12px, focus in reading order, every stop visible/uncovered, and the 2px mint outline. The harness audits the static route only; open `/settings` once in the dev browser and confirm Escape closes the Disconnect and Privacy sheets and focus returns to the trigger. The trap itself is already covered by `src/lib/ui-primitives.test.ts` and the `BottomSheet` implementation.

- [ ] **Step 5: Write the status note**

Append a “## 10. Economy — Settings slice status” section to `docs/superpowers/audits/2026-11-05-ui-gap-audit.md` recording:

- routes added and the Profile change;
- the reconnect decision and why it was necessary;
- test/lint/build results;
- the audit result;
- any intentional 360px wrapping;
- that the real-device pass is the user’s final step.

- [ ] **Step 6: Build the review folder**

Mirror the Foundation 2 review folder so the user can note corrections against the current PNGs:

```powershell
$dest = "docs/superpowers/renders/economy/review"
New-Item -ItemType Directory -Force "$dest/current" | Out-Null
New-Item -ItemType Directory -Force "$dest/before" | Out-Null
Copy-Item "docs/superpowers/renders/economy/after/*.png" "$dest/current" -Force
Copy-Item "docs/superpowers/renders/economy/before/*.png" "$dest/before" -Force
```

Write `index.html` listing Profile, Settings and Delete at 360/390/430 with the before Profile pair, and `NOTES.md` with one correction section per screen plus a “Known deliberate choices” block (pushed shells have no bottom nav; the Profile header is `Profile` + icon; Delete is a route, not an inline section).

- [ ] **Step 7: Commit**

```powershell
git add docs/superpowers/renders/economy docs/superpowers/audits/2026-11-05-ui-gap-audit.md
git commit -m "chore: economy settings sign-off renders and verification"
```

- [ ] **Step 8: Update the progress ledger**

Append Task 0–7 completion, commit hashes and the test count to `.superpowers/sdd/2026-11-06-economy-settings/progress.md` (create it if absent; it is git-ignored).

---

## Execution notes

- **Order matters.** Tasks 1–3 are independent of the routes; Tasks 4–6 build on each other. Do not start Task 6 before Task 4, because Profile would lose its delete entry with no replacement.
- **The old component is temporary.** `DeleteAccount.tsx` stays until Task 6 deletes it; the duplicated logic exists for one commit only.
- **No render for Setup step 2.** The harness cannot approve a wallet prompt; the reconnect helper tests and source contract are the evidence, plus the real-device pass.
- **When a test fails, fix the code, not the test.** The only exception is a stale source-contract string that the task itself renamed.
- **If a screen exceeds 844px at 360px,** let it scroll; never truncate an action label, balance, XP value or row title.

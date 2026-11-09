# Onboarding UI redesign - implementation plan

**Date:** 2026-11-09
**Branch:** `onboarding-ui-redesign` (from `main` at `f055a35`)
**Spec:** `docs/superpowers/specs/2026-11-09-onboarding-ui-design.md`
**Reference:** `Savborne-handoff.html` figures `A_Welcome`, `A_Connect`, `A_Privacy`, `A_Name`, `A_Gate`, `A_Preparing`, `A_UpdatePay`, `A_BalanceError`.

## Global constraints

- Branch `onboarding-ui-redesign` from `main`; no stacking.
- Use Foundation 2 primitives only. No new `vpx` panels or ad-hoc buttons.
- 12px type floor; 44px targets; 360px no truncation.
- Coral for the advancing CTA; mint for success, progress and "you".
- The 24-word phrase never enters `localStorage`, `sessionStorage`, a URL or a
  cookie. It lives in the onboarding context and is cleared on lock.
- Existing API contracts change only where the spec approves: the additive
  `privacyNoticeVersion` on `POST /api/players`, the 16-character limit on new
  names, and the extended `create_player_with_vault` RPC. `FINAL-SCHEMA.sql` is
  the only SQL file.
- Intermediate commits may link to a route added by the next task. The branch is
  not deployed mid-batch.
- One commit per task. After every task run:
  `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Capture 360/390/430 renders and the audit for every task that changes a
  screen. PNGs go under `docs/superpowers/renders/onboarding/after/`; audit
  lines go to `docs/superpowers/renders/onboarding/audit/`.
- Do not commit `.env.local`, `AGENTS.md`, InstaBox tooling or the throwaway
  capture harness.
- Do not redo Home, Economy or Battle. The only Home edit is the balance-error
  trigger and retry.

---

## Task 0: Branch, before renders, baseline

**Files:**
- Create: `docs/superpowers/renders/onboarding/before/setup@{360,390,430}.png`

- [ ] **Step 1: Branch from main**

```bash
git switch main
git switch -c onboarding-ui-redesign
```

- [ ] **Step 2: Copy the current setup renders**

```bash
mkdir -p docs/superpowers/renders/onboarding/before
cp docs/superpowers/renders/foundation-2/after/setup@360.png docs/superpowers/renders/onboarding/before/
cp docs/superpowers/renders/foundation-2/after/setup@390.png docs/superpowers/renders/onboarding/before/
cp docs/superpowers/renders/foundation-2/after/setup@430.png docs/superpowers/renders/onboarding/before/
```

- [ ] **Step 3: Baseline**

```bash
npm test          # expect 296 pass
npx tsc --noEmit
npm run lint      # expect 50 warnings, 0 errors
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/renders/onboarding/before
git commit -m "chore: onboarding before renders"
```

---

## Task 1: Foundation additions

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/BrandMark.tsx`
- Create: `assets/brand.json`
- Create: `src/components/ui/StepBars.tsx`
- Modify: `assets/glyphs.json`
- Create: `src/lib/onboarding-ui.test.ts`

**Interfaces:**

```ts
// src/components/ui/StepBars.tsx
export function StepBars({ step, total = 3 }: { step: number; total?: number }): JSX.Element

// src/components/BrandMark.tsx
export function BrandMark(): JSX.Element   // 36px logo + 164x14 wordmark, one row
```

- [ ] **Step 1: Add the missing type roles and field styles**

Append to the Foundation 2 type block in `globals.css`:

```css
.sv-display-sm   { font-family: var(--font-silkscreen); font-weight: 400; font-size: 36px; line-height: 1.08; }
.sv-heading-lg   { font-family: var(--font-silkscreen); font-weight: 400; font-size: 32px; line-height: 1.1; }
.sv-subheading-lg{ font-family: var(--font-jakarta); font-weight: 800; font-size: 32px; line-height: 1.1; letter-spacing: -0.02em; }
```

Add a field component class next to `.sv-btn`:

```css
.sv-input {
  width: 100%;
  height: 56px;
  padding: 0 16px;
  background: var(--surface);
  border: 2px solid var(--bevel);
  border-radius: 0;
  color: var(--fg);
  font-family: var(--font-jakarta), system-ui, sans-serif;
  font-size: 18px;
  font-weight: 600;
}
.sv-input::placeholder { color: var(--fg-faint); font-weight: 500; }
.sv-input:focus-visible { border-color: var(--mint); }
```

Add the step bars next to the chips:

```css
.sv-steps { display: flex; gap: 6px; }
.sv-steps > li { flex: 1; height: 8px; background: var(--track); }
.sv-steps > li[data-fill='true'] { background: var(--mint); }
```

- [ ] **Step 2: Port the handoff brand**

Create `assets/brand.json` with the exact inline SVG markup from
`A_Welcome`: a 24x24 logo (mint rounded ground, cream S, coral eyes) and an
82x7 wordmark (cream letters, coral full stop). Keep the handoff's fills.

`BrandMark` renders a 10px-gap row:

```tsx
<span className="flex h-11 items-center gap-[10px]">
  <svg width={36} height={36} viewBox="0 0 24 24" aria-hidden focusable="false"
       dangerouslySetInnerHTML={{ __html: brand.logo }} />
  <svg width={164} height={14} viewBox="0 0 82 7" role="img" aria-label="Savborne"
       dangerouslySetInnerHTML={{ __html: brand.wordmark }} />
</span>
```

The JSON is a build-time constant, so `dangerouslySetInnerHTML` follows the
same rule as `Glyphs.tsx`.

- [ ] **Step 3: Add the step bars**

`StepBars` renders `<ol className="sv-steps" aria-hidden>` with `total` cells;
cells up to and including `step` get `data-fill="true"`. The visible
"Step N of 3" label carries the semantics (Task 2).

- [ ] **Step 4: Add the phone glyph**

Add `phone` to `assets/glyphs.json` with the handoff's 24x24 phone drawing,
`source: "Savborne-handoff A_Gate"`, and the mint frame, cream screen and coral
dot. The provenance script skips hand-drawn glyphs; run it anyway:

```bash
node scripts/glyph-provenance.mjs
```

- [ ] **Step 5: Test the additions**

`onboarding-ui.test.ts` pins:

- `BrandMark` uses `assets/brand.json`, the 36px/164x14 sizes and the
  `Savborne` label.
- `StepBars` takes `step`/`total` and fills up to the current step.
- The three type roles and `.sv-input` exist with the handoff values.
- `phone` is in the glyph set at 24x24.

- [ ] **Step 6: Verify and commit**

No route consumes these yet, so no renders. Run the four checks.

```bash
git add src/app/globals.css assets/brand.json assets/glyphs.json src/components/BrandMark.tsx src/components/ui/StepBars.tsx src/lib/onboarding-ui.test.ts
git commit -m "feat: add onboarding brand, type roles and step bars"
```

---

## Task 2: Onboarding routes, provider and Welcome

**Files:**
- Create: `src/app/(onboarding)/layout.tsx`
- Create: `src/components/onboarding/OnboardingProvider.tsx`
- Create: `src/components/onboarding/OnboardingScreen.tsx`
- Create: `src/app/(onboarding)/welcome/page.tsx`
- Create: `src/lib/wallet-errors.ts`
- Modify: `src/app/setup/page.tsx` (server redirect)
- Modify: `src/app/setup/vault/page.tsx` (shared wallet-error helper)
- Modify: `src/lib/settings.test.ts`
- Create: `src/lib/onboarding.test.ts`

**Interfaces:**

```ts
// OnboardingProvider
type Draft = {
  accounts: string[]
  picked: string | null
  vaultAddress: string | null
  phrase: string[] | null
  vaultLocked: boolean
  displayName: string
  acceptedNoticeVersion: string | null
}

useOnboarding(): Draft & {
  startConnect(): Promise<string[]>
  pickAccount(address: string): Promise<'reconnect' | 'created'>
  lockVault(passphrase: string): Promise<void>
  acceptPrivacy(version: string): void
  setDisplayName(value: string): void
  resetVault(): void
  finish(displayName: string): Promise<void>
}
```

- [ ] **Step 1: Create the provider**

Move the existing account load, reconnect probe, phrase generation, encryption,
vault write and player creation out of `src/app/setup/page.tsx` into the
provider, keeping the behaviours and error strings:

- `startConnect()` sets the account list.
- `pickAccount()` uses `reconnectDecision`/`reconnectProfile`/`sessionFromProfile`
  and `sameAddress` exactly as today. A `200` writes the session and
  `router.replace('/')`; a `404` generates the phrase and vault address; any
  other status throws.
- `lockVault()` encrypts, writes the local vault, clears the phrase, sets
  `vaultLocked` and pushes `/privacy`.
- `finish()` validates the name, posts to `/api/players` with
  `privacyNoticeVersion`, writes the session and replaces to `/`.
- On mount, if `readSession()` returns a session, probe
  `/api/players/me`: `200` -> replace `/`; `404` -> clear the stale session;
  other outcomes leave onboarding alone.

The provider uses `'use client'`, `useRouter` and `useState`. No storage writes
contain the phrase.

- [ ] **Step 2: Create the layout and shared screen**

`(onboarding)/layout.tsx` wraps children in `OnboardingProvider`.
`OnboardingScreen` composes `ScreenShell`:

```tsx
<ScreenShell
  variant="pushed"
  backHref={backHref}
  actions={
    <span className="sv-label text-fg-muted" aria-current="step">
      Step {step} of {total}
    </span>
  }
  bodyClassName="gap-[18px]"
>
  <StepBars step={step} total={total} />
  {children}
</ScreenShell>
```

- [ ] **Step 3: Replace `/setup` with a redirect**

```tsx
import { redirect } from 'next/navigation'
export default function SetupPage() {
  redirect('/welcome')
}
```

Update `settings.test.ts`: remove the old "Setup renders the shared privacy
notice" assertion here; Task 4 restores it against `/privacy`. Keep the
Disconnect `/setup` assertions.

- [ ] **Step 4: Build Welcome**

`ScreenShell variant="pushed"` with no header, `bodyClassName="pt-0 gap-5"`.

- `BrandMark`.
- 300px `PixelPanel` with a 220x260 `bg-sprite-well` well and
  `CharacterArt size={144}`.
- `.sv-display-sm` headline with a `<br />` between the two sentences.
- Body copy from the handoff (vault wording).
- `mt-auto` block: coral `ButtonLink href="/connect"` "Get started" and the
  centered 13px "Built for Nimiq Pay".

- [ ] **Step 5: Test and capture**

`onboarding.test.ts` pins: `/setup` calls `redirect('/welcome')`; the
`(onboarding)` layout uses the provider; Welcome renders `BrandMark`,
`CharacterArt`, the headline, `/connect` and "Built for Nimiq Pay"; no step
bars on Welcome.

Capture `welcome@360/390/430` and run the audit.

- [ ] **Step 6: Verify and commit**

```bash
git add "src/app/(onboarding)" src/components/onboarding src/app/setup/page.tsx src/lib/settings.test.ts src/lib/onboarding.test.ts docs/superpowers/renders/onboarding/after docs/superpowers/renders/onboarding/audit
git commit -m "feat: add the onboarding routes and Welcome screen"
```

---

## Task 3: Create your vault (step 1 of 3)

**Files:**
- Create: `src/app/(onboarding)/connect/page.tsx`
- Modify: `src/components/vault/PhraseCeremony.tsx` (heading level only)
- Modify: `src/components/vault/BackupQuiz.tsx` (h1 when not inline)
- Modify: `src/lib/onboarding.test.ts`

**Interfaces:**

```tsx
// PhraseCeremony gains an opt-out, default keeps today's h1
headingLevel?: 'h1' | 'h2'
```

- [ ] **Step 1: Intro state**

`OnboardingScreen step={1} backHref="/welcome"`:

- `<h1 className="sv-heading-lg">Create your vault</h1>`.
- Handoff Connect body copy, vault-specific.
- `PixelPanel` with three 28px mint numbered steps:
  1. Approve sharing the account address in Nimiq Pay.
  2. Generate 24 words on device and derive the vault.
  3. Write the words down and lock the vault; Savborne reads its balance each
     check-in.
- Two-column can/cannot `PixelPanel`s: "Savborne can / Read the vault balance"
  (mint) and "Savborne cannot / Move, lock or spend your NIM" (coral-text).
- Coral `Button` "Create your vault"; `loading` while `startConnect()` runs.
- Errors in `Banner tone="error"`; no accounts gets an info banner and the CTA
  stays available.

- [ ] **Step 2: Account picker**

After `startConnect()`, show the same heading and a panel of full-width
secondary buttons, one per address (mono, `sv-break`, 56px). A ghost "Back"
returns to the intro. Pick calls `pickAccount`; a reconnect leaves for Home, a
created vault moves to the phrase state. Errors stay in a banner.

- [ ] **Step 3: Ceremony**

Render the existing components in the same screen:

- Phrase: `<PhraseCeremony headingLevel="h2" ... />` under the screen h1.
- Quiz: `<BackupQuiz ... />`; change its heading to `h1` when `inline` is false
  and keep `h2` for the Settings use.
- Passphrase: `<h1>Lock your vault</h1>` plus `PassphraseField`; errors in a
  banner; `loading` note while encrypting.
- Ready (returning from Privacy): `<h1>Your vault is ready</h1>`, one sentence,
  coral `Continue` to `/privacy`.

The 24 words, the 4-word quiz, the passphrase rule and the local encryption are
unchanged.

- [ ] **Step 4: Test and capture**

`onboarding.test.ts` pins the step 1 wiring: `step={1}`, the numbered steps,
"Savborne can/cannot", `PhraseCeremony`, `BackupQuiz`, `PassphraseField`, the
ready state and no phrase storage. Run the source check that the phrase is only
held in provider state.

Capture `connect-intro`, `connect-picker`, `connect-phrase`, `connect-quiz`,
`connect-lock`, `connect-ready` at 360/390/430 and run the audit.

- [ ] **Step 5: Verify and commit**

```bash
git add "src/app/(onboarding)/connect" src/components/vault/PhraseCeremony.tsx src/components/vault/BackupQuiz.tsx src/lib/onboarding.test.ts docs/superpowers/renders/onboarding/after docs/superpowers/renders/onboarding/audit
git commit -m "feat: rebuild the vault step on the Connect layout"
```

---

## Task 4: Privacy notice (step 2 of 3)

**Files:**
- Create: `src/lib/privacy.ts`
- Modify: `src/components/PrivacyNotice.tsx`
- Create: `src/app/(onboarding)/privacy/page.tsx`
- Modify: `src/lib/settings.test.ts`
- Create: `src/lib/privacy-notice.test.ts`
- Modify: `src/lib/onboarding.test.ts`

**Interfaces:**

```ts
// src/lib/privacy.ts
export const PRIVACY_NOTICE_VERSION = '2026-11-09'
export const PRIVACY_SHORT_VERSION: string
export const PRIVACY_CARDS: { key: string; title: string; tone: 'mint' | 'coral' | 'muted'; body: string }[]
export const PRIVACY_CONSENT_LINE: string

// PrivacyNotice
export function PrivacyNotice({ variant = 'compact' }: { variant?: 'full' | 'compact' })
```

- [ ] **Step 1: Write the shared copy**

Vault-specific copy:

- Short: never holds/moves/controls money; reads the vault balance for
  check-ins and streaks; losing the 24 words and the device makes the NIM
  unrecoverable.
- Collect: wallet address, vault address, balance snapshots, game data, display
  name.
- Don't: 24 words, passphrase, other balances, anything that can move or lock
  funds.
- Public: display name, rank, score; never the balance.
- Stored: Supabase (US-East) and Vercel; delete the account at any time.

- [ ] **Step 2: Two variants**

`full` renders the handoff layout: mint short-version panel, 2-column
collect/don't pair, then public and stored cards with muted labels.
`compact` keeps the Settings list and adds a 12px "Privacy notice version
2026-11-09" line. Both read `src/lib/privacy.ts`; no copy in the pages. The
compact "Where it is stored" line replaces the current mojibake arrow with
"Settings > Help" in plain text.

- [ ] **Step 3: Build the privacy screen**

`OnboardingScreen step={2} backHref="/connect"`:

- `<h1 className="sv-heading-lg">Privacy notice</h1>`.
- `<PrivacyNotice variant="full" />`.
- Footer with a 2px cream top border: the 12px consent line and a coral
  `Button` "Continue" that calls `acceptPrivacy(PRIVACY_NOTICE_VERSION)` then
  `router.push('/name')`.

- [ ] **Step 4: Test and capture**

`privacy-notice.test.ts` pins the version, both variants, the four card
headings, the consent line and the single copy source.
Restore the `settings.test.ts` invariant against
`../app/(onboarding)/privacy/page.tsx` (`<PrivacyNotice />`).
`onboarding.test.ts` pins `step={2}`, `acceptPrivacy`, `/name` and the consent
line.

Capture `privacy@360/390/430` and run the audit. Check the footer is reachable
at 360x844.

- [ ] **Step 5: Verify and commit**

```bash
git add src/lib/privacy.ts src/components/PrivacyNotice.tsx "src/app/(onboarding)/privacy" src/lib/settings.test.ts src/lib/privacy-notice.test.ts src/lib/onboarding.test.ts docs/superpowers/renders/onboarding/after docs/superpowers/renders/onboarding/audit
git commit -m "feat: rebuild the privacy notice"
```

---

## Task 5: Store privacy consent

**Files:**
- Modify: `supabase/FINAL-SCHEMA.sql`
- Modify: `src/lib/database.types.ts`
- Modify: `src/app/api/players/route.ts`
- Create: `src/lib/privacy-consent.test.ts`

- [ ] **Step 1: Schema**

In the `players` create-table block add:

```sql
privacy_consent_at      timestamptz,
privacy_notice_version  text,
```

With the other additive columns add:

```sql
alter table players add column if not exists privacy_consent_at     timestamptz;
alter table players add column if not exists privacy_notice_version text;
```

Before the function, add:

```sql
drop function if exists create_player_with_vault(text,text,text,text,text,boolean);
```

Extend the function with `p_privacy_notice_version text`, write both columns in
the insert, and update the revoke/grant lines to the 7-argument signature.

- [ ] **Step 2: Types and route**

Add the two nullable fields to `PlayerRow`.

`POST /api/players`:

```ts
const { privacyNoticeVersion } = body
if (
  privacyNoticeVersion !== undefined &&
  (typeof privacyNoticeVersion !== 'string' ||
    privacyNoticeVersion.trim().length < 1 ||
    privacyNoticeVersion.trim().length > 32)
) {
  return NextResponse.json({ error: 'Invalid privacy notice version' }, { status: 400 })
}
```

Pass `p_privacy_notice_version: privacyNoticeVersion?.trim() ?? null` to the
RPC. The response is unchanged.

- [ ] **Step 3: Test**

`privacy-consent.test.ts` pins the two columns, the `drop function`, the 7-arg
signature, the updated grant, the RPC argument, the optional validation and the
types. No UI renders in this task; note that in the commit.

- [ ] **Step 4: Verify and commit**

```bash
git add supabase/FINAL-SCHEMA.sql src/lib/database.types.ts src/app/api/players/route.ts src/lib/privacy-consent.test.ts
git commit -m "feat: store privacy consent with the player"
```

---

## Task 6: Name your character (step 3 of 3)

**Files:**
- Create: `src/lib/display-name.ts`
- Create: `src/lib/display-name.test.ts`
- Modify: `src/app/api/players/route.ts`
- Create: `src/app/(onboarding)/name/page.tsx`
- Modify: `src/lib/onboarding.test.ts`

**Interfaces:**

```ts
export const DISPLAY_NAME_MAX = 16
export function normaliseDisplayName(raw: string): string
export function validateDisplayName(raw: string):
  | { ok: true; value: string }
  | { ok: false; error: string }
```

- [ ] **Step 1: Validation**

`normaliseDisplayName` trims and collapses nothing else. `validateDisplayName`
rejects empty and over-16 after trim with a short message.

`POST /api/players` replaces the 1-32 check with
`validateDisplayName(displayName)`; the error becomes "Display name must be
1-16 characters". The DB check stays 1-32.

- [ ] **Step 2: Build the screen**

`OnboardingScreen step={3} backHref="/privacy"`:

- `<h1 className="sv-heading-lg">Name your character</h1>` and the handoff body.
- 250px `PixelPanel`, 190x214 well, `CharacterArt size={128}`.
- Label, `.sv-input` with `maxLength={16}`, `autoComplete="off"`,
  `aria-describedby`, `aria-invalid`, `autoFocus`.
- Hint "Up to 16 characters." and a right-aligned `N/16` counter in one row.
- `Banner tone="error"` below the field for an empty submit or a server error.
- Coral `Button` "Start playing" (disabled while empty or loading) calling
  `finish(displayName)`.
- If `acceptedNoticeVersion` is null, redirect to `/privacy`; if the vault is
  not locked, redirect to `/connect`.

- [ ] **Step 3: Test and capture**

`display-name.test.ts` covers trim, 1-16, 17 and 32 rejected, whitespace.
`onboarding.test.ts` pins `step={3}`, `maxLength={16}`, the counter, the error
banner, `Start playing`, the guards and the API limit.

Capture `name`, `name-16` and `name-error` at 360/390/430; run the audit. The
error render uses a mocked `POST /api/players` 409.

- [ ] **Step 4: Verify and commit**

```bash
git add src/lib/display-name.ts src/lib/display-name.test.ts src/app/api/players/route.ts "src/app/(onboarding)/name" src/lib/onboarding.test.ts docs/superpowers/renders/onboarding/after docs/superpowers/renders/onboarding/audit
git commit -m "feat: add the 16-character name step"
```

---

## Task 7: Balance error and retry

**Files:**
- Create: `src/lib/balance-retry.ts`
- Create: `src/lib/balance-retry.test.ts`
- Create: `src/app/balance-error/page.tsx`
- Modify: `src/app/(tabs)/page.tsx`
- Create: `src/lib/balance-error.test.ts`

**Interfaces:**

```ts
export function writeBalanceRetry(): boolean
export function takeBalanceRetry(): boolean
```

- [ ] **Step 1: One-shot retry**

The module writes `savborne.balance-retry.v1` to `sessionStorage`, caches the
flag in memory and removes it on `take`. Storage failures return `false` and
never throw. `take` returns true once per write.

- [ ] **Step 2: Home trigger**

In `onCheckIn`, when `res.status === 503`:

```ts
const body = (await res.json().catch(() => ({}))) as { error?: string }
if (body.error === 'rpc_unreachable') {
  router.push('/balance-error')
  return
}
```

Every other failure keeps the existing inline `Banner`.

After the player loads, Home consumes `takeBalanceRetry()` once behind a ref
guard and calls the existing check-in. A `false` leaves Home normal.

- [ ] **Step 3: Build `/balance-error`**

`ScreenShell variant="pushed"` with no header:

- Top title "Couldn't read balance" in `.sv-number-m`.
- Centered 132px coral `PixelPanel` with `Glyph name="alert"` at 72px,
  `sv-shake` once, and the handoff headline/body.
- Coral `Button` "Try again" -> `writeBalanceRetry()` then `replace('/')`.
- Secondary `ButtonLink href="/"` "Go back to Home".

- [ ] **Step 4: Test and capture**

`balance-retry.test.ts` covers write/take, one-shot and storage failure.
`balance-error.test.ts` pins the copy, the 503/rpc_unreachable branch, the
retry consumption and that other failures stay inline.

Capture `balance-error@360/390/430` and run the audit.

- [ ] **Step 5: Verify and commit**

```bash
git add src/lib/balance-retry.ts src/lib/balance-retry.test.ts src/app/balance-error "src/app/(tabs)/page.tsx" src/lib/balance-error.test.ts docs/superpowers/renders/onboarding/after docs/superpowers/renders/onboarding/audit
git commit -m "feat: add the balance error screen and retry"
```

---

## Task 8: Nimiq Pay gate states

**Files:**
- Modify: `src/components/VersionGate.tsx`
- Create: `src/lib/version-gate.test.ts`

- [ ] **Step 1: Preparing**

Centered `BrandMark` + "Preparing Savborne..." in 16px muted. No spinner, no
action, full viewport, 22px gutters.

- [ ] **Step 2: Outside Nimiq Pay**

Top title "Open inside Nimiq Pay" in `.sv-number-m`. Centered 132px
`PixelPanel`, `Glyph name="phone"` at 72px, `<h2 class="sv-subheading-lg">` and
the handoff body. No CTA.

- [ ] **Step 3: Update Nimiq Pay**

Top title "Update Nimiq Pay". Centered 132px panel with the `update` glyph at
72px mint, the handoff headline/body, then:

```tsx
<ButtonLink href="https://nimiq.com" target="_blank" rel="noreferrer" variant="primary">
  Update Nimiq Pay
</ButtonLink>
<Button variant="secondary" onClick={retry}>I've updated, try again</Button>
```

`retry` increments an attempt counter consumed by the existing effect, which
sets `checking` while it runs. A wallet error reason renders as a small muted
line under the body. The `/card/*` exemption stays first.

- [ ] **Step 4: Test and capture**

`version-gate.test.ts` pins the three states, no spinner in Preparing, no CTA
outside, the site link plus retry in Update, and the card exemption.

Capture `gate-preparing`, `gate-outside`, `gate-update` at 360/390/430. The
harness holds Preparing by leaving `window.nimiq` undefined (the SDK polls for
10s), uses no `window.nimiqPay` for outside, and a `window.nimiq` without
`getBalance` for update. Run the audit.

- [ ] **Step 5: Verify and commit**

```bash
git add src/components/VersionGate.tsx src/lib/version-gate.test.ts docs/superpowers/renders/onboarding/after docs/superpowers/renders/onboarding/audit
git commit -m "feat: rebuild the Nimiq Pay gate states"
```

---

## Task 9: Full render sweep, review page and audit

**Files:**
- Create: `docs/superpowers/renders/onboarding/after/*.png` (full sweep)
- Create: `docs/superpowers/renders/onboarding/audit/final-audit.jsonl`
- Create: `docs/superpowers/renders/onboarding/review/{index.html,NOTES.md,current/}`
- Modify: `docs/superpowers/audits/2026-11-05-ui-gap-audit.md`

- [ ] **Step 1: Full sweep**

Capture at 360/390/430: welcome; connect-intro, connect-picker,
connect-phrase, connect-quiz, connect-lock, connect-ready; privacy; name,
name-16, name-error; balance-error; gate-preparing, gate-outside, gate-update.
Inspect every PNG. No gate, blank, spinner-only or harness-error screen is
acceptable evidence.

- [ ] **Step 2: Audit**

Run the CDP audit over every state at every width. Record `overflowX`, wide
elements, targets under 44x44, minimum font, tab order, in-view and covered
stops, and the focus outline. Confirm:

- no 10/11px text outside `.sv-state`;
- the 24-word grid and the picker wrap at 360;
- the privacy footer is reachable;
- the Name counter and error do not shift the CTA off-screen.

- [ ] **Step 3: Review page**

Build `review/index.html` with sections and 360/390/430 images, and
`review/NOTES.md` with sign-off checkboxes:

- [ ] Welcome
- [ ] Create your vault - intro
- [ ] Create your vault - account picker
- [ ] Create your vault - 24 words
- [ ] Create your vault - quiz
- [ ] Create your vault - lock
- [ ] Create your vault - ready
- [ ] Privacy notice
- [ ] Name
- [ ] Name error
- [ ] Balance error
- [ ] Gate - Preparing
- [ ] Gate - Open inside Nimiq Pay
- [ ] Gate - Update Nimiq Pay

Add a "Known deliberate choices" section from the spec's rulings.

- [ ] **Step 4: Audit section**

Append `## 14. Onboarding UI status - 2026-11-09` with what landed, the
verification table, 360 behaviour, rulings, renders and remaining steps
(apply `FINAL-SCHEMA.sql` before deploying; real-device pass is the user's).

- [ ] **Step 5: Final verification and commit**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
git status --short   # no .env.local, AGENTS.md or tooling
git add docs/superpowers/renders/onboarding docs/superpowers/audits/2026-11-05-ui-gap-audit.md
git commit -m "chore: onboarding render sweep, review page and audit"
```

---

## Definition of done

1. `/welcome`, `/connect`, `/privacy`, `/name` use `ScreenShell`, `PixelPanel`,
   `Button`, `ButtonLink`, `Banner`, `StepBars` and `BrandMark`; no ad-hoc
   panels or buttons.
2. `/setup` redirects to `/welcome`; `/setup/vault` still works.
3. The 24-word ceremony is intact and the phrase never touches storage.
4. Privacy consent and notice version are stored with the player; Name is
   1-16 characters for new players.
5. `/balance-error` handles `rpc_unreachable` and retries a check-in once.
6. The gate's Preparing, outside and update states match the handoff.
7. 12px floor, 44px targets, 360px no truncation, one h1 per screen.
8. `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all green.
9. Renders and audit at 360/390/430, review page ready for the user's
   corrections.
10. `FINAL-SCHEMA.sql` is the only SQL file changed; it is applied manually.

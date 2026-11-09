# Onboarding UI redesign - design

**Date:** 2026-11-09
**Branch:** `onboarding-ui-redesign` (from `main` at `f055a35`)
**Depends on:** Foundation 2 primitives, the Home batch and the check-in release gate.
**Reference:** `Savborne-handoff.html` figures `A_Welcome`, `A_Connect`, `A_Privacy`, `A_Name`, `A_Gate`, `A_Preparing`, `A_UpdatePay`, `A_BalanceError`.
**Audit:** `docs/superpowers/audits/2026-11-05-ui-gap-audit.md` sections 3.1 and 6.

## 1. Goal

Rebuild onboarding as the handoff's four screens, using the Foundation 2 shell,
type scale, stepped panels and coral primary actions, while keeping the app's
non-custodial 24-word vault ceremony.

Success means:

- `/welcome`, `/connect`, `/privacy` and `/name` match the handoff's structure,
  step bars, copy intent and CTA colour at 360/390/430.
- The 24-word ceremony is unchanged in behaviour and now lives in step 1 of 3.
- Privacy consent is recorded on the player with a notice version.
- New display names are limited to 16 characters and the Name step previews the
  character, counts characters and shows an error banner.
- The Nimiq Pay gate's Preparing, Open inside Nimiq Pay and Update states are the
  handoff's screens, not generic cards.
- A failed balance read routes to `/balance-error` with a working retry.
- No vault material is written to browser storage.
- Every route is 12px+, 44px targets, no horizontal overflow, no truncated
  actions.

## 2. Scope

**In:**

- Four onboarding routes, a shared in-memory draft, and `/setup` redirecting to
  `/welcome`.
- Welcome, Create your vault (Connect layout), Privacy and Name screens.
- Three 8px step bars on steps 1-3; Welcome has none.
- Brand mark and wordmark ported from the handoff.
- The existing vault ceremony (phrase grid, backup quiz, passphrase, local
  encryption) rendered inside step 1.
- Privacy notice short version, four cards, consent line and stored consent.
- 16-character limit and server validation for new display names.
- `/balance-error`, the Home trigger and a one-shot retry.
- VersionGate restyle for checking, outside and update states.
- Renders, audit and review page for the batch.

**Out:**

- The First check-in screen and its trigger. Already shipped; onboarding still
  ends on Home.
- Home, Economy and Battle redesign. The only Home edit is the balance-error
  trigger and retry.
- `/setup/vault` behaviour. It keeps its route and ceremony; it shares the new
  wallet-error helper.
- Display-name uniqueness. The handoff caption asks for it; the app has no
  unique constraint and adding one could invalidate existing names.
- Settings consent status. The compact notice stays; consent is stored, not
  displayed there yet.
- A real app-store deep link. None exists in the repo; the update CTA opens the
  Nimiq site.
- A real-device Nimiq Pay pass. That is the user's sign-off step; this sandbox
  has no `.env.local`.

## 3. Decisions

| Decision | Choice |
|---|---|
| Route shape | Split routes `/welcome`, `/connect`, `/privacy`, `/name` behind one `(onboarding)` layout; `/setup` server-redirects to `/welcome` |
| Draft | React context in the onboarding layout; the phrase exists only in memory; no sessionStorage or localStorage draft |
| Vault step name | "Create your vault" with the handoff's Connect layout, numbered explainer, can/cannot cards and 3 step bars |
| Ceremony | Kept, including the 24-word grid, 4-word quiz, passphrase and local encryption; it is step 1 of 3 |
| Privacy consent | Stored on `players` as `privacy_consent_at` + `privacy_notice_version`; notice version `2026-11-09` |
| Privacy API | Additive `privacyNoticeVersion` field on `POST /api/players`; atomic through the extended RPC |
| Balance error | New `/balance-error` for `503 { error: 'rpc_unreachable' }`; all other check-in failures stay inline on Home |
| Balance retry | One-shot `sessionStorage` flag consumed by Home; `/balance-error` itself records nothing |
| Display name | 16 characters for new names (client + API); the DB check stays 1-32 so legacy names remain valid |
| Gate states | Restyled in place in `VersionGate`; update CTA opens `https://nimiq.com`; secondary retry re-runs the check; `/card/*` stays exempt |
| Brand | Handoff logo mark (24x24 at 36px) and pixel wordmark (82x7 at 164px), ported as `BrandMark` |
| Welcome art | `CharacterArt` at 144px (9x) in the handoff's 220x260 well |
| Name art | `CharacterArt` at 128px (8x) in the handoff's 190x214 well |
| Type roles | Add `.sv-display-sm` (Silkscreen 36), `.sv-heading-lg` (Silkscreen 32) and `.sv-subheading-lg` (Jakarta 800 32) |
| Step semantics | The visible "Step N of 3" label carries `aria-current="step"`; the bars are decorative |
| Step 1 phases | intro -> account picker -> phrase -> quiz -> passphrase -> ready; the header step stays 1 of 3 throughout |
| Session guard | If a stored session probes `200` on `/api/players/me`, onboarding leaves for Home; a `404` clears the stale session |
| Reload | A reload loses the draft and restarts at `/welcome` or `/connect`; direct `/privacy` or `/name` visits without a locked vault redirect to `/connect` |

## 4. Routes and state

```
src/app/(onboarding)/layout.tsx          OnboardingProvider
src/app/(onboarding)/welcome/page.tsx    Welcome
src/app/(onboarding)/connect/page.tsx    step 1: Create your vault + ceremony
src/app/(onboarding)/privacy/page.tsx    step 2: Privacy notice
src/app/(onboarding)/name/page.tsx       step 3: Name your character
src/app/setup/page.tsx                   redirect('/welcome')
src/app/setup/vault/page.tsx             unchanged route, shared helper only
```

`OnboardingProvider` holds:

```ts
type Draft = {
  accounts: string[]
  picked: string | null
  vaultAddress: string | null
  phrase: string[] | null   // memory only, cleared after lock
  vaultLocked: boolean
  displayName: string
  acceptedNoticeVersion: string | null
}
```

Methods:

- `startConnect()` - calls `listAccounts()`, stores the list and returns it.
- `pickAccount(address)` - probes `GET /api/players/me` through
  `reconnectDecision`; a `200` writes the session and replaces to `/`; a `404`
  generates the phrase and vault address on device; anything else throws.
- `lockVault(passphrase)` - encrypts, writes the local vault, clears the phrase,
  sets `vaultLocked` and pushes `/privacy`.
- `acceptPrivacy(version)` - stores the accepted notice version in the draft.
- `resetVault()` - drops an unregistered phrase and returns to step 1's account
  picker.
- `finish(displayName)` - validates 1-16, posts `POST /api/players` with
  `privacyNoticeVersion`, writes the session and replaces to `/`.

Guards:

- The provider probes once on mount when a stored session exists. `200` -> `/`;
  `404` -> clear the session; 5xx/network -> continue.
- `/privacy` and `/name` redirect to `/connect` when `vaultLocked` is false.
  The guard runs in an effect and renders null while redirecting, so the lock
  state commits before the guard can fire.
- `/name`'s submit redirects to `/privacy` if no notice version was accepted.
- `/connect` shows the ready state when `vaultLocked` is true.

Transition map:

```
/welcome  Get started            -> /connect
/connect  Create your vault      -> account picker -> phrase -> quiz -> passphrase
/connect  Lock my vault          -> /privacy
/privacy  Continue               -> /name   (records the accepted version)
/name     Start playing          -> /         (creates player + vault row, session)
```

## 5. Screen anatomy

### 5.1 Welcome - `/welcome`

`ScreenShell variant="pushed"` with no header and `bodyClassName="pt-0 gap-5"`.
Body:

1. `BrandMark` row, 36px mark + 164x14 wordmark, 10px gap, 44px high.
2. `PixelPanel className="h-[300px] flex items-center justify-center"` with a
   220x260 `bg-sprite-well` well and `CharacterArt size={144}`.
3. `<h1 className="sv-display-sm">Save for real.<br />Level up for fun.</h1>`.
4. `p.sv-body.text-fg-muted`: "Check in on your NIM savings, earn XP and items,
   and battle other players. Savborne never holds or moves your money."
5. Bottom block with `mt-auto`:
   - `ButtonLink href="/connect" variant="primary"` "Get started".
   - `span.sv-label.text-fg-muted.text-center` "Built for Nimiq Pay".

No step bars. The CTA is the only action.

### 5.2 Create your vault - `/connect` (step 1 of 3)

`OnboardingScreen step={1} backHref="/welcome"`:

- Header back 44x44 and the label "Step 1 of 3".
- Three 8px bars, first mint.
- Intro state:
  - `<h1 className="sv-heading-lg">Create your vault</h1>`
  - `p.sv-body.text-fg-muted`: "Choose the wallet account that identifies you.
    Savborne generates a vault only you control. You need at least 1 NIM in it
    to join."
  - `PixelPanel` numbered explainer, 28px mint squares:
    1. "Tap Create, then approve sharing your account address in Nimiq Pay."
    2. "Savborne generates 24 words on this device and derives a vault only you
       control."
    3. "Write the words down and lock the vault with a passphrase. Savborne
       reads its balance each time you check in."
  - Two `PixelPanel`s in a 2-column grid, 12px padding:
    - "Savborne can" (mint) / "Read the vault balance".
    - "Savborne cannot" (coral-text) / "Move, lock or spend your NIM".
  - `Button variant="primary"` "Create your vault" (calls `startConnect`).
- Account picker state: the same heading, a `Panel` with a short instruction and
  one full-width secondary button per address (mono, `sv-break`), plus a ghost
  "Back" to the intro.
- Phrase state: `PhraseCeremony` with the existing 24-word grid, acknowledgement
  and Continue; its heading is the screen h1.
- Quiz state: `BackupQuiz`; its heading becomes h1 when not inline.
- Passphrase state: `<h1 className="sv-heading-lg">Lock your vault</h1>` plus
  `PassphraseField`; errors in `Banner tone="error"`.
- Ready state (returning from Privacy via Back): `<h1>Your vault is ready</h1>`,
  a sentence that the words are backed up and the vault is locked on this
  device, and a coral `Continue` to `/privacy`.
- No accounts: an info `Banner` ("Connect a wallet in Nimiq Pay, then try
  again.") and the CTA remains available.
- Errors: `Banner tone="error"` below the relevant control; the CTA is not
  removed.

### 5.3 Privacy notice - `/privacy` (step 2 of 3)

`OnboardingScreen step={2} backHref="/connect"`:

- `<h1 className="sv-heading-lg">Privacy notice</h1>`.
- Short version `PixelPanel tone="mint"`: label "The short version" (mint) and
  "Savborne never holds, moves, or controls your money. We read the balance of
  the vault you choose, so we can track your check-ins and streaks. If you lose
  your 24 words and this device, the NIM in your vault is unrecoverable."
- Four cards:
  - 2-column pair: "What we collect" (mint) and "What we don't" (coral-text).
  - Full-width "What's public" and "Where it's stored" with muted labels.
  - Copy is vault-specific: wallet address, vault address, balance snapshots,
    game data, display name; never words, passphrase or anything that can move
    funds; public name/bracket/score but never balance; Supabase (US-East) and
    Vercel; delete the account at any time.
- Footer block with a 2px cream top border:
  - `p.sv-label.text-fg-muted` consent line: "By tapping Continue, you agree to
    this notice and to Savborne storing your vault address, balance snapshots
    and game data as described."
  - `Button variant="primary"` "Continue" (calls `acceptPrivacy`, pushes
    `/name`).
- `PrivacyNotice` gains `variant="full" | "compact"`; the full variant renders
  this card layout, the compact variant stays the Settings list and shows the
  notice version. Both read one copy module.

### 5.4 Name your character - `/name` (step 3 of 3)

`OnboardingScreen step={3} backHref="/privacy"`:

- `<h1 className="sv-heading-lg">Name your character</h1>`.
- `p.sv-body.text-fg-muted`: "Your display name is your character's name. It
  appears on the leaderboard. Your address stays hidden."
- `PixelPanel className="h-[250px] flex items-center justify-center"` with a
  190x214 well and `CharacterArt size={128}`.
- `<label htmlFor="display-name" className="sv-body font-bold">Display name</label>`
- `<input id="display-name" className="sv-input" maxLength={16} autoComplete="off" aria-describedby="name-hint name-count name-error" aria-invalid={...} />`
- Hint "Up to 16 characters." and a right-aligned counter `N/16` in one row.
- `Banner tone="error"` when the trimmed value is empty on submit or the server
  rejects the name.
- `Button variant="primary"` "Start playing"; disabled while empty or loading.
- On success the player and vault rows are created, the session is written and
  the route replaces to `/`. First check-in remains a Home action.

## 6. Gate and balance error

### 6.1 VersionGate

One component, four phases, no new routes. Public `/card/*` stays exempt.

- `checking`: centered `BrandMark` + "Preparing Savborne..." 16px muted; no
  spinner and no action.
- `outside_nimiq`: top title "Open inside Nimiq Pay" in `.sv-number-m`, then a
  centered 132px `PixelPanel` with a 72px `phone` glyph, `<h2 class="sv-subheading-lg">Savborne lives inside Nimiq Pay</h2>`
  and the handoff body. No CTA.
- `update_required`: top title "Update Nimiq Pay", centered 132px panel with the
  `update` glyph at 72px mint, "Update Nimiq Pay to continue" and the handoff
  body, then two actions:
  - `ButtonLink href="https://nimiq.com" target="_blank" rel="noreferrer"` coral
    "Update Nimiq Pay".
  - `Button variant="secondary"` "I've updated, try again" that re-runs the
    check and returns to Preparing while it runs.
  - If a wallet error reason exists, show it as a small muted diagnostic line,
    not as the headline.
- All gate screens use the handoff's 24px gutter and 22px side padding; the
  Preparing state is vertically centered.

### 6.2 Balance error - `/balance-error`

`ScreenShell variant="pushed"`, no header, top title "Couldn't read balance" in
`.sv-number-m`, then a centered 132px coral `PixelPanel` with a 72px coral
`alert` glyph and the copy:

> Couldn't read your balance.
> This check-in wasn't recorded, and your balance wasn't counted as zero. Your
> streak and XP are safe. Check your connection and try again.

Actions: coral `Try again`, secondary `Go back to Home`.

- Home routes here only when `POST /api/check-ins` returns `503` with
  `error: 'rpc_unreachable'`. Every other failure keeps the inline Home banner.
- Try again writes a one-shot `sessionStorage` flag and replaces to `/`; Home
  consumes it after the player loads and starts one check-in. If storage is
  blocked, Home opens normally and the player taps Check in.
- The warning panel plays `sv-shake` once on enter; reduced-motion collapses it.

## 7. Data and API

### 7.1 Privacy consent

`supabase/FINAL-SCHEMA.sql` only:

- Add `privacy_consent_at timestamptz` and `privacy_notice_version text` to the
  `players` table inline and via `alter table ... add column if not exists`.
- Drop the 6-argument `create_player_with_vault` and recreate it with
  `p_privacy_notice_version text`; the insert writes
  `privacy_notice_version = p_privacy_notice_version` and
  `privacy_consent_at = case when p_privacy_notice_version is null then null else now() end`.
- Update the revoke/grant lines to the 7-argument signature.

`src/lib/database.types.ts` gains the two nullable fields.

Deployment order: apply `FINAL-SCHEMA.sql` before deploying this build, because
the new API route calls the 7-argument RPC.

### 7.2 POST /api/players

Body gains an optional `privacyNoticeVersion: string` (1-32 chars). Absent or
null leaves both columns null for any other caller. Present passes it to the
RPC. The response shape is unchanged.

### 7.3 Display name

`src/lib/display-name.ts`:

```ts
export const DISPLAY_NAME_MAX = 16
export function normaliseDisplayName(raw: string): string
export function validateDisplayName(raw: string):
  | { ok: true; value: string }
  | { ok: false; error: string }
```

`POST /api/players` uses it. The DB check stays 1-32. No rename path exists, so
existing longer names are untouched.

### 7.4 Other contracts

- `POST /api/check-ins`, `/api/vaults`, `/api/players/me` and the vault write
  path are unchanged.
- `/setup/vault` keeps its endpoint and ceremony.

## 8. Accessibility, type and responsive rules

- Minimum 12px type; the only 10px text remains `.sv-state` in Battle.
- Every interactive target is 44px or larger (back 44, ghost 44, primary 64,
  secondary 56, input 56, account rows 56).
- Focus is the global 2px mint outline at 2px offset; inputs keep it.
- One h1 per screen. The step label carries `aria-current="step"`; step bars are
  decorative.
- The Name input has a real label, `aria-describedby` for hint, counter and
  error, and `aria-invalid`.
- Banners speak as alerts; loading notes are polite status.
- 360px: no truncation. The Welcome headline may take three lines, the step
  titles two; addresses wrap with `sv-break`; the privacy page scrolls if it
  exceeds 844px; the account picker buttons wrap.
- The header wordmark and brand mark fit one 44px row at 360.

## 9. Test plan

Pure and source-contract tests, matching the existing node:test style:

- `display-name.test.ts`: trim, 1-16, 17 and 32 rejected, whitespace rejected.
- `privacy-notice.test.ts`: notice version, full/compact variants, the four
  card headings, the consent line, one shared copy source.
- `privacy-consent.test.ts`: SQL columns, RPC 7-arg signature and grant, API
  argument, optional body validation, types.
- `onboarding.test.ts`: `/setup` redirects, four routes exist, Welcome brand and
  footer, step 1/2/3 wiring, Connect can/cannot and ceremony, Privacy consent
  call, Name maxLength/counter/error, guard redirects.
- `balance-error.test.ts`: route copy, Home 503 branch, one-shot retry stores
  and consumes once, storage failure is safe.
- `version-gate.test.ts`: Preparing has no spinner, outside has no CTA, update has the
  site link and retry, `/card` exemption stays.
- Update `settings.test.ts` to read the new privacy page for `<PrivacyNotice />`.
- Keep `type-floor.test.ts` at an empty PENDING set.

Suite target: 296 existing + about 20 new.

## 10. Renders and audit

- Before: copy `foundation-2/after/setup@{360,390,430}.png` to
  `docs/superpowers/renders/onboarding/before/`.
- After: 11 states at 360/390/430:
  welcome; connect-intro; connect-picker; connect-phrase; connect-quiz;
  connect-lock; privacy; name; name-error; balance-error;
  gate-preparing; gate-outside; gate-update.
- Audit every state for `overflowX`, wide elements, targets under 44px, minimum
  font, tab order, visibility, coverage and focus outline.
- The harness is throwaway outside the repo; it drives the ceremony with a
  mocked wallet and APIs, then writes PNGs and a JSONL audit.
- Review page `docs/superpowers/renders/onboarding/review/index.html` with
  `NOTES.md` sign-off checkboxes and a "Known deliberate choices" section.

## 11. Risks and rulings

- **Reload restarts onboarding.** The phrase must never be stored, so the draft
  is memory-only. A reload on `/privacy` or `/name` redirects to `/connect`. A
  player with an existing profile is protected by the session probe, which
  takes them Home instead of creating a second vault.
- **Unregistered local vault on reload.** If a player reloads after locking but
  before creating the player, a new vault replaces the unregistered local one.
  No funds exist in it; this matches today's wizard behaviour. The backup
  ceremony is the same protection either way.
- **Consent time.** The timestamp is server time at player creation, a few
  seconds after the Continue tap. The accepted notice version travels with the
  request, so the record is exact even though the time is not the tap time.
- **Update link.** The repo has no app-store deep link. The CTA opens the
  canonical Nimiq site; the secondary retry is the path that actually recovers
  inside Nimiq Pay.
- **No name uniqueness.** The handoff asks for it; the app has no constraint and
  adding one would be a separate migration with legacy collisions. Out of scope.
- **Gate diagnostics.** A wallet error reason is shown as a muted line so it
  helps support without replacing the designed copy.
- **First check-in.** Already implemented; this batch does not route into it.

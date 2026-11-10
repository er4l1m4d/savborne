# App-specific routes polish - design

**Date:** 2026-11-10
**Status:** awaiting approval
**Branch:** `app-routes-polish` (from `main` at `a41f704`)
**Depends on:** Foundation 2 primitives, `ScreenShell`, `PixelPanel`, `Row`,
`Button`, `Banner`, `LoadingState`, `.sv-input`, the panel side-outline fix, the
loading-state batch and the Ranks batch.
**Reference:** `docs/superpowers/audits/2026-11-05-ui-gap-audit.md` sections
3.8, 6, 7, 17, 18, 20 and 21, plus
`docs/superpowers/specs/2026-11-09-ranks-ui-design.md` for the last batch's
structure.

---

## 1. Goal

Restyle the three app-specific routes to the Foundation 2 system:

- `/vault` (`src/app/(tabs)/vault/page.tsx`)
- `/receipts` (`src/app/receipts/page.tsx`)
- `/card/[token]` (`src/app/card/[token]/page.tsx`)

These routes have no handoff figure, so this is a restyle, not a redesign. The
money rules, the receipt timeline rules and the public card contract do not
change. No API, SQL, route or data change.

The only legacy visuals left are `.vpx` on the Vault amount/passphrase inputs
and `.vpx-soft` on the Vault movement items, the Receipts snapshot rows and the
Card's inner vault box. All three pages already use `ScreenShell` where they
should, the 12px type floor is met, and there is no `text-[10px]` or
`text-[11px]` left.

---

## 2. Scope

### In

- Vault: balance card, shield strip, network/backup banners, deposit and
  withdraw flows, passphrase unlock, movements, Receipts and Share links.
- Vault: `.sv-input` on both amount fields and the passphrase; grouped movement
  panel; `sv-subheading` section headings; one `h1`; reduced-motion skeleton.
- Receipts: transfer anatomy and snapshot rows; friendly load error with a
  secondary `Try again`; 401 redirect to `/setup`.
- Card: replace the inner `.vpx-soft` box with a nested off-tone panel, keeping
  the public, read-only contract.
- A source-contract test file for the three routes.
- Before/after renders at 360/390/430, an audit, a review page and audit
  section 22.

### Out

- Any change to `useVault`, money handlers, polling or the receipt timeline
  shape.
- Any change to `getFlexCard`'s explicit columns, the card token rule or the
  404 path.
- Any API, SQL, route or data change.
- Any change to shared CSS, the type scale, the shell, the panel geometry or
  the button treatments.
- New primitives, filters, tabs or motion vocabulary.
- Redesigning any of the three screens beyond the system restyle.

---

## 3. Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Vault section headings | `h2` + `.sv-subheading` (20px Jakarta 800, default text). The 12px uppercase mint headings go away. Mint stays for success/progress/you. The balance card's tiny `Vault balance` eyebrow stays `.sv-section-label text-fg-faint` because it is a field label, not a section heading. |
| 2 | Vault movements | One grouped `PixelPanel` (`px-3.5 py-0.5`) of `Row` items at 56px with track dividers. Direction and status share the flexible title column; the amount is the trailing `sv-figure`. No per-item cards. |
| 3 | Vault inputs | The existing `.sv-input` exactly: 56px high, 18px/600 text, 2px bevel, mint focus. Used for both amount fields and the passphrase. No compact variant. |
| 4 | Vault shell | Keep `ScreenShell variant="tab" title="Vault" backHref="/"`. It is a route in the `(tabs)` group, so it keeps the tab shell, the Home back link and the bottom nav. |
| 5 | Receipts error | Friendly `Couldn't load receipts.` copy, no HTTP status. A secondary `Try again` (`size="sm"`, `fullWidth={false}`, `self-start`) refetches. A 401 calls `router.replace('/setup')` and renders no error. |
| 6 | Receipts snapshots | `PixelPanel tone="off"`, one panel per snapshot, with label, amount and time wrapping at 360. No hash is possible on this row type. |
| 7 | Card inner box | A nested `PixelPanel tone="off"` inside the outer `tone="off"` card. The inner stepped outline and its darker shadow separate it from the card surface. |
| 8 | Card render | A temporary, uncommitted local fixture for `getFlexCard` produces the valid-card captures, then is reverted before the commit. The committed tree keeps Supabase only. |
| 9 | Before renders | Capture before images for Vault, Receipts and Card at 360/390/430, as the previous batches did. |
| 10 | Shared CSS | No changes. Every treatment already exists: `.sv-input`, `.sv-subheading`, `.sv-caption`, `Row`, `PixelPanel tone="off"`, `Banner`, `Button`. If implementation finds a real gap, it stops and proposes the shared change before editing `globals.css`. |
| 11 | Reduced-motion skeleton | Keep `animate-pulse` but add Tailwind's `motion-reduce:animate-none`, so no shared CSS is touched and the skeleton is static when the OS asks for reduced motion. |
| 12 | No-vault heading | The panel heading becomes `h2.sv-subheading`; the only `h1` is the shell's `Vault` title. |
| 13 | Vault error buttons | Error banners use the system's secondary `Try again` at `size="sm"`, `fullWidth={false}`, matching Ranks, instead of a primary `Retry`. Copy keeps the useful failure text. |
| 14 | Empty movements copy | `No movements yet.` instead of `No deposits yet.`, because the list covers both directions. |
| 15 | Card shell | No `ScreenShell`. The page keeps its own `<main>` and stays public and outside the wallet gate. |

---

## 4. Screen anatomy

### 4.1 Vault

`ScreenShell variant="tab" title="Vault" backHref="/"`.

```
Vault                                            shell h1, back to Home

┌ PixelPanel p-4 ────────────────────────────────┐
│ Vault balance                   12px faint     │
│ 12.34 NIM                       36px Silkscreen│
│ NQ57 1111 … 1111                13px mono      │
└────────────────────────────────────────────────┘

Streak shields  ◈ ◈ ◈                             13px + 16px glyphs

[ network mismatch Banner, only when it applies ]
[ backup / no-local-key panel, only when it applies ]

Deposit                                          h2, 20px
Amount (NIM)                                    13px faint label
[ 1                                     ]        56px .sv-input
[ Deposit ]                                      64px coral primary

Withdraw                                         h2, 20px
Destination: …                                   body copy, broken address
Amount (NIM)
[ 0.5                                   ]        56px .sv-input
[ Vault passphrase                      ]        56px .sv-input, locked
[ Unlock vault ]                                 64px coral primary
  or
[ Withdraw ]                                     64px coral primary, unlocked
Vault unlocked for this session.                 mint success label

[ action error / notice Banner, when present ]

Recent movements                                 h2, 20px
┌ PixelPanel px-3.5 py-0.5 ───────────────────────┐
│ Deposit  Confirmed                    10.00 NIM │ 56px
│ Withdrawal  Pending                    1.00 NIM │ 56px
│ Deposit  Failed (wrong recipient)      2.00 NIM │ 56px, grows if needed
└────────────────────────────────────────────────┘
Receipts        Share card & backup               44px links
```

- The balance card, shield strip, network banner, backup panel, empty-vault
  sentence and both flows stay.
- The deposit/withdraw handlers, the `?amount=&direction=` prefill, the unlock
  call, all disabled rules and the settled/pending/expired notices are
  byte-for-byte unchanged.
- `h2.sv-subheading` for `Deposit`, `Withdraw`, `Recent movements`. No mint.
- `.sv-input` on the deposit amount, the withdraw amount and the passphrase.
  The passphrase keeps `type="password"` and its placeholder.
- Movements become one panel of `Row` items:
  - title column: a wrapping flex row with `sv-label` direction and
    `sv-caption text-fg-muted` status;
  - trailing: `sv-figure` amount, `shrink-0`;
  - `minHeight={56}` and `divider` on every row (the last divider is removed by
    `.sv-row--divider:last-child`);
  - `statusLabel` keeps Confirmed / Pending / Failed reasons.
- The balance skeleton keeps its size and `aria-hidden` and adds
  `motion-reduce:animate-none`.
- The `Receipts` and `Share card & backup` links stay `.sv-link` in a
  `flex flex-wrap` row, so both keep 44px targets and neither truncates.

#### Vault states

| State | Content |
|---|---|
| Loading | Shell + `<LoadingState />`. |
| Load error | Shell + error `Banner` with `Could not load your vault`, the message and a secondary `Try again`. |
| No vault | Shell + `PixelPanel` with `h2.sv-subheading` `No vault yet`, the existing two copy variants and `Create my vault`. One `h1` in the document (the shell's). |
| Default | Balance card, shields, deposit and withdraw with passphrase locked. |
| Unlocked | Same, with the unlocked success label and the `Withdraw` action. |
| Empty movements | Panel replaced by `No movements yet.` caption. |
| Balance error | Balance card shows the existing `Balance unavailable` banner and secondary `Try again`. |
| Action error / notice | Banners below the flows. |

### 4.2 Receipts

`ScreenShell variant="pushed" title="Receipts" backHref="/vault"`.

- Intro body copy stays.
- Transfer rows keep the existing anatomy: direction, signed amount, hash with
  `sv-break`, time, status line, block/fee/explorer only when included,
  `Check again` while pending and `Try again` while expired.
- A hash and explorer link appear only for `included`; pending and expired keep
  their current lines and actions.
- Snapshot rows become `PixelPanel tone="off"` with a wrapping baseline row:
  `Balance check-in` (`sv-label text-fg-muted`), the amount (`sv-figure
  text-fg-soft`) and the time (`sv-caption text-fg-faint`). No hash, no link.
- Load error: `const LOAD_ERROR = "Couldn't load receipts."`; a 401 redirects
  to `/setup`; any other failure shows `Banner tone="error"` with `LOAD_ERROR`
  and a secondary `Try again`. The raw status is never printed.
- Loading keeps `<LoadingState />`; empty keeps the first-deposit copy.

#### Receipts states

| State | Content |
|---|---|
| Mixed | Included, pending and expired transfers plus one snapshot. |
| Empty | The existing first-deposit sentence. |
| Error | Friendly banner + secondary `Try again`, no status number. |
| Loading | `<LoadingState />`. |
| 401 | Source-tested only: `router.replace('/setup')`, no error render. |

### 4.3 Card

The page stays a public server component with its own `<main>` and no
`ScreenShell`.

```
┌ PixelPanel tone="off" max-w-90 ──────────────────┐
│ Savborne saver                    12px eyebrow   │
│ Adaeze                            28px Silkscreen│
│ Level 14    Streak 6d    Shields 3               │
│ Bracket  Silver                                  │
│ ┌ PixelPanel tone="off" p-3 ───────────────────┐ │
│ │ Verified saver ⟡                             │ │
│ │ NQ57 2F6C…ELRL                               │ │
│ │ Funds held in this player's own vault.       │ │
│ └──────────────────────────────────────────────┘ │
│ Balances are never public. …                     │
└──────────────────────────────────────────────────┘
```

- The outer `PixelPanel tone="off"` stays.
- The inner `.vpx-soft` box becomes a nested `PixelPanel tone="off"` with
  `p-3 flex flex-col gap-1`.
- Name, level, streak, shields, bracket, short vault address, backup status,
  the vault promise and the balances promise are unchanged.
- Still no wallet address, no balance, no session and no wallet control.
- `getFlexCard`, its explicit column list, the token regex and the `notFound()`
  path are untouched in the committed diff.
- No `ScreenShell` on this route.

---

## 5. Shared changes

**None.** This batch is deliberately a consumer of the existing system:

- `.sv-input` already provides the 56px field.
- `.sv-subheading` already provides the 20px sub-heading.
- `Row` already provides 56px, dividers and a flexible title column.
- `PixelPanel tone="off"` already provides the quiet sub-panel.
- `Banner` and `Button` already provide the error/recovery pattern.
- `motion-reduce:animate-none` is Tailwind's existing variant, not new CSS.

If a real gap appears during implementation, stop and propose the shared edit
before changing `globals.css`.

---

## 6. Data and invariants

### 6.1 Vault money semantics (unchanged)

- A deposit is "received" only after the server has settled it on chain; the
  notice strings and the `settled.status` checks do not change.
- An expired hash is terminal.
- Receipts' `Try again` links back to `/vault` with a prefilled amount and
  direction and starts a fresh transaction; it never re-submits the old hash.
- `useVault`, `submitTransfer`, `pollTransfer` and the RPC modules are not
  touched.

### 6.2 Receipts (unchanged)

- A transfer shows its hash, and its explorer link only when the server marked
  it `included`.
- A snapshot has no hash and no explorer URL in its type or its render.
- Pending and expired actions and copy stay.

### 6.3 Card (unchanged)

- Public, read-only, no wallet, no session, no balance, no player wallet
  address.
- `getFlexCard` keeps its explicit column list and the 404 decision.
- The card render is produced from a temporary local fixture and the fixture is
  reverted before the commit.

---

## 7. Source-contract tests

New `src/lib/app-routes.test.ts` (node:test + `readFileSync`) pins:

1. **No legacy panels:** none of the three page sources contains `.vpx` or
   `.vpx-soft`.
2. **Vault inputs:** the Vault source contains exactly two `.sv-input` class
   uses (one shared `AmountField`, one passphrase) and no `border`-only input.
3. **Vault headings:** `Deposit`, `Withdraw` and `Recent movements` render as
   `h2` with `sv-subheading`; no section heading uses `text-mint`.
4. **Vault movements:** the page imports `Row` and renders the movements inside
   one `PixelPanel`; no movement `<li>` carries its own panel class.
5. **Vault h1:** the Vault page source contains no `<h1`; `ScreenShell` owns the
   only `h1`. The no-vault panel uses `h2`.
6. **Vault skeleton:** the balance placeholder carries `animate-pulse` and
   `motion-reduce:animate-none`.
7. **Shells:** Vault and Receipts import and render `ScreenShell`; Card does
   not.
8. **Receipts error:** `LOAD_ERROR` is `Couldn't load receipts.`; the page
   checks `res.status === 401` and calls `router.replace('/setup')`; the error
   action is a secondary `Try again`; no interpolated HTTP status reaches the
   banner.
9. **Receipts snapshots:** `SnapshotRow` renders `PixelPanel tone="off"` and
   contains neither `txHash` nor `explorerUrl`.
10. **Receipts transfer anatomy:** `Check again`, `Try again`, `explorerUrl`
    and `included` checks remain.
11. **Card contract:** the page is a server component with `notFound()`, uses
    `PixelPanel tone="off"` for the outer card and a nested `tone="off"` box,
    and the source contains no balance or player-wallet field. The page does
    not import `ScreenShell`.
12. **No API change:** the three route files and `src/lib/vault/cards.ts` are
    source-only UI changes; the test records that `cards.ts` still selects
    `address, player_address, backup_verified_at` and the player columns
    explicitly (a regression guard for the public contract).

The tests are source contracts, so they run without `.env.local`, Supabase or
Nimiq.

---

## 8. Renders, audit and review

Output root: `docs/superpowers/renders/app-routes/`.

```
before/   vault-before@{360,390,430}.png
          receipts-before@{360,390,430}.png
          card-before@{360,390,430}.png
after/    vault-default, vault-no-vault, vault-locked, vault-empty,
          vault-error, vault-loading
          receipts-mixed, receipts-empty, receipts-error, receipts-loading
          card-valid
          (each @360, @390, @430)
audit/    final-audit.jsonl
review/   index.html, NOTES.md
```

33 after PNGs (11 states x 3 widths) and 9 before PNGs.

Harness: `/data/tmp/opencode/capture-app-routes.mjs`, copied from
`capture-ranks.mjs` and not committed. It keeps the CDP connection, readiness
loop, screenshot and audit blocks, and changes the fixture:

- intercepts `GET /api/vaults`, `GET /api/transfers`, `GET /api/players/me`,
  `GET /api/receipts` and `GET /api/transfers/:hash`;
- stubs the Nimiq RPC POST used by `getAccount` with a balance;
- seeds `savborne.session.v1` and (for the unlocked states) a real encrypted
  vault blob created with the app's `encryptPhrase`, then clicks `Unlock vault`
  with the fixture passphrase;
- returns `vault: null` for `no-vault`, a 500 for `error`, and a 2500ms delay
  for `loading`;
- for Card, temporarily replaces `getFlexCard` with a fixture returning a valid
  card, captures, then reverts the file with `git checkout --`.

Every state is audited at all three widths for:

- `overflowX === 0`;
- no element wider than the viewport;
- no interactive target below 44x44;
- minimum rendered font size >= 12;
- every Tab stop in view and uncovered, with the 2px mint focus outline.

---

## 9. Verification

| Check | Target |
|---|---|
| `npm test` | 396 existing + ~12 new pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0, warnings at or below 49, 0 errors |
| `npm run build` | exit 0; `/vault`, `/receipts` and `/card/[token]` compile |
| Legacy classes | `grep -R "vpx" src/app/(tabs)/vault src/app/receipts "src/app/card/[token]"` returns nothing |
| Renders | 33 after + 9 before PNGs under `docs/superpowers/renders/app-routes/` |
| Audit | 33 JSONL rows, all four measurements clean at 360/390/430 |
| Review | `review/index.html` + `NOTES.md` with sign-off boxes |
| Audit doc | `## 22. App-specific routes polish - 2026-11-10` |

The temporary card fixture is reverted before the final test/build and before
the commit. `.env.local`, `AGENTS.md` and InstaBox tooling are never staged.
No merge or push until sign-off.

---

## 10. Risks

1. **Card fixture leakage.** The temporary `getFlexCard` change must not be
   committed. The plan reverts it, re-runs the full suite and greps the staged
   diff before the final commit.
2. **Unlocking in the harness.** The unlocked Vault state needs a real
   encrypted blob. If PBKDF2 in the harness cannot produce one, the default
   state stays locked and the plan records that limitation instead of faking an
   unlocked UI. The locked state itself is always capturable.
3. **Nested off tones.** The Card's inner and outer panels share the off tone,
   so the inner edge is carried by its 2px outline and darker 4px shadow. The
   renders are checked for a visible sub-box at 360.
4. **Long movement status at 360.** `Failed (wrong sender)` can wrap; the title
   column wraps and the row grows past 56px rather than truncating or shrinking
   type.
5. **Receipts status line at 360.** Included receipts carry block, fee and an
   explorer link in a wrapping flex row; the audit confirms no wide element and
   no target below 44px.
6. **No live data checks.** `.env.local` is absent, so Supabase and Nimiq are
   not exercised; tests, build and fixture renders are. The real-device pass
   remains the user's sign-off step.

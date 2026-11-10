# App-specific routes review notes

Open `index.html` in a browser. Write corrections under the screen they belong
to, naming the width and the element where possible.

## Sign-off

- [ ] Vault - default (unlocked)
- [ ] Vault - no vault
- [ ] Vault - locked
- [ ] Vault - empty movements
- [ ] Vault - error
- [ ] Vault - loading
- [ ] Receipts - mixed
- [ ] Receipts - empty
- [ ] Receipts - error
- [ ] Receipts - loading
- [ ] Card - valid
- [ ] Card - 404 (source-tested; the app has no designed not-found screen)

## Vault - default

Corrections:

-

## Vault - no vault

Corrections:

-

## Vault - locked

Corrections:

-

## Vault - empty movements

Corrections:

-

## Vault - error

Corrections:

-

## Vault - loading

Corrections:

-

## Receipts - mixed

Corrections:

-

## Receipts - empty

Corrections:

-

## Receipts - error

Corrections:

-

## Receipts - loading

Corrections:

-

## Card - valid

Corrections:

-

## Known deliberate choices (not bugs)

- Vault keeps the tab shell with the Home back link because it is a route in
  the `(tabs)` group. It is not converted to a pushed screen.
- Vault section headings use `h2.sv-subheading` at 20px default text. Mint is
  reserved for the unlocked success line, progress and the You row. The tiny
  `Vault balance` eyebrow stays a 12px field label.
- The two amount fields and the passphrase all use the existing `.sv-input`
  at 56px. The passphrase also has a visible `Vault passphrase` label; the
  placeholder stays.
- Recent movements are one grouped `PixelPanel` of 56px `Row`s with track
  dividers. Long status text wraps and the row grows; nothing truncates.
- The empty list copy is `No movements yet.` because the list covers deposits
  and withdrawals. The old `No deposits yet.` only named one direction.
- The balance skeleton keeps `animate-pulse` but adds
  `motion-reduce:animate-none`, so it is static under reduced motion without a
  shared CSS change.
- The Vault load error is friendly (`Couldn't load your vault.` / `Try again in
  a moment.`) and never prints a raw HTTP status. The balance banner keeps its
  network diagnostic because it explains a real chain failure.
- Money semantics are unchanged: a deposit is received only after the server
  settles it on chain, an expired hash is terminal, and Try again on a receipt
  links back to Vault with a prefilled amount to start a new transaction.
- A movement's failure reason still renders its server token in Vault
  (`Failed (wrong_recipient)`); Receipts keeps its humanised sentence. This
  batch is a restyle, and the failure labels were not in scope.
- Receipts keeps the full transfer anatomy. A hash and explorer link appear
  only when the transfer is included; pending and expired keep their actions
  and copy.
- A snapshot is `PixelPanel tone="off"` with no hash and no explorer link. The
  row wraps at 360 (time drops to its own line) instead of shrinking type.
- Receipts load failures show `Couldn't load receipts.` with a secondary Try
  again. A 401 redirects to `/setup`; that path is source-tested because it
  never renders an error.
- The Card stays public and outside the tab shell: no `ScreenShell`, no
  wallet, no session, no balance and no player wallet address. The outer and
  inner panels are both `tone="off"`; the inner stepped outline and darker
  shadow separate the vault proof.
- The Card render used a temporary local `getFlexCard` fixture because Supabase
  is unavailable in this sandbox. The fixture was reverted before the final
  test/build and is not in the committed tree. The 404 path is source-tested.
- `getFlexCard` still selects only the explicit columns the card needs.
- No shared CSS changed. The batch consumes `.sv-input`, `.sv-subheading`,
  `Row`, `PixelPanel tone="off"`, `Banner`, `Button` and `LoadingState` as they
  already exist.

## Audit

33 rows (11 states x 360/390/430): `overflowX` 0, no element wider than the
viewport, no interactive target below 44x44, minimum font 12px, and 199
keyboard stops all in view, uncovered and outlined in 2px mint.

The first audit pass flagged the bottom-nav outlines as the wrong colour. That
was the harness sampling 30ms into `transition-colors`, which includes
`outline-color`; waiting 200ms fixed the measurement, not the UI.

## Deployment before sign-off

1. Apply `supabase/FINAL-SCHEMA.sql` if the target database is behind.
2. Real-device Nimiq Pay pass at 360-430 is the user's step; `.env.local` is not
   configured in this sandbox.
3. Do not merge or push until the user signs off.

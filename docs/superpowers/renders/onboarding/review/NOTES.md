# Onboarding UI review notes

Open `index.html` in a browser. Write corrections under the screen they belong
to, naming the width and the element where possible.

## Sign-off

- [ ] Welcome
- [ ] Create your vault - intro
- [ ] Create your vault - account picker
- [ ] Create your vault - 24 words
- [ ] Create your vault - quiz
- [ ] Create your vault - lock
- [ ] Create your vault - ready
- [ ] Privacy notice
- [ ] Name
- [ ] Name at 16 characters
- [ ] Name error
- [ ] Balance error
- [ ] Gate - Preparing
- [ ] Gate - Open inside Nimiq Pay
- [ ] Gate - Update Nimiq Pay

## Welcome - `/welcome`

Corrections:

-

## Create your vault - `/connect`

Corrections:

-

## Privacy notice - `/privacy`

Corrections:

-

## Name your character - `/name`

Corrections:

-

## Balance error - `/balance-error`

Corrections:

-

## Nimiq Pay gate

Corrections:

-

## Known deliberate choices (not bugs)

- The app uses four routes (`/welcome`, `/connect`, `/privacy`, `/name`) behind
  one layout, and `/setup` redirects to `/welcome`. The draft lives in React
  context; the 24-word phrase is never written to browser storage. A reload
  restarts onboarding, and a stored session is probed first so an existing
  player goes Home instead of creating a second vault.
- The vault step is titled "Create your vault", not the handoff's "Connect your
  savings account", because the app generates a vault instead of reading an
  existing savings account.
- The 24-word grid, the four-word quiz, the passphrase rule and the local
  encryption are the existing ceremony. The batch wraps it in the handoff shell
  and changes the quiz heading to an h1; it does not change the ceremony logic.
- The name limit is 16 for new names. The database check stays 1-32 so names
  created before this batch remain valid. There is no rename path. Display-name
  uniqueness is not implemented; the handoff asks for it, but there is no
  constraint and the migration could collide with existing names.
- Privacy consent is recorded as server time at player creation, not at the
  Continue tap. The accepted notice version (`2026-11-09`) travels with the
  request, so the record is exact even though the timestamp is a few seconds
  later.
- The privacy page scrolls. The consent line and CTA are at the end, not pinned
  like the handoff's fixed footer. At 390 the CTA begins just below the fold.
  This avoids covering the card text in a short viewport; say if you want the
  footer pinned.
- The Welcome headline is 36px Silkscreen. It wraps to three or four lines at
  360-430; the handoff drew two lines at 390. The size is kept for fidelity.
- "Update Nimiq Pay" opens https://nimiq.com in a new tab. The repo has no
  app-store deep link; the secondary "I've updated, try again" is the recovery
  that works inside Nimiq Pay.
- Preparing has no spinner and no action, matching the handoff. The SDK polls
  for the provider; the state resolves in one round trip.
- Balance Error is shown only for `503 { error: "rpc_unreachable" }`. Rate
  limits, vault errors and network failures keep the inline Home banner. Try
  again leaves a one-shot `sessionStorage` flag; Home consumes it and runs one
  check-in. A blocked storage API leaves Home normal.
- The gate remains one component with states, not routes. `/card/*` stays
  public. The Open and Update screens have no top Silkscreen header; the
  centred headline is the screen heading.
- The Settings privacy sheet now uses the same copy source and shows the notice
  version; its previous mojibake arrow is gone.
- The real-device Nimiq Pay pass at 360-430 is still yours. `.env.local` is not
  configured in this sandbox, so the live Supabase and balance checks are
  blocked here.

## Deployment before this build

1. Apply `supabase/FINAL-SCHEMA.sql`. The new API route calls the 7-argument
   `create_player_with_vault`, so apply the SQL before deploying.
2. Run the check-in acceptance checks from
   `docs/superpowers/backlog/2026-11-09-check-in-integrity.md`.
3. Confirm onboarding creates a player with `privacy_consent_at` and
   `privacy_notice_version` set.

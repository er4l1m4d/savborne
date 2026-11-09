# Onboarding UI review notes

Open `index.html` in a browser. Write corrections under the screen they belong
to, naming the width and the element where possible.

## Sign-off

- [ ] Welcome - step 1 of 5
- [ ] Create your vault - step 2 of 5
- [ ] Create your vault - vault disclosure open
- [ ] Create your vault - account picker
- [ ] Backup - 24 words - step 3 of 5
- [ ] Backup - quiz
- [ ] Backup - lock
- [ ] Backup - ready
- [ ] Privacy notice - step 4 of 5
- [ ] Privacy - public and storage open
- [ ] Name - step 5 of 5
- [ ] Name at 16 characters
- [ ] Name error
- [ ] How Savborne works - Settings
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

## Backup - `/connect`

Corrections:

-

## Privacy notice - `/privacy`

Corrections:

-

## Name your character - `/name`

Corrections:

-

## How Savborne works - `/settings/how-it-works`

Corrections:

-

## Balance error and the Nimiq Pay gate

Corrections:

-

## Known deliberate choices (not bugs)

- Five steps: Welcome 1/5, Vault 2/5 (intro and account picker), Backup 3/5
  (words, quiz, passphrase, ready), Privacy 4/5, Name 5/5. The label switches
  from 2 to 3 inside `/connect` when the phrase exists; no new route, so the
  draft never crosses a route and the phrase stays in memory.
- Welcome shows the indicator even though it is a landing screen: the count has
  to be honest from the first screen.
- The vault intro is a short paragraph, the can/cannot cards and a closed "How
  your vault works" disclosure. The three-step explainer is not visible by
  default; it is one tap away and also lives in Settings.
- The 24-word warning is two sentences. The full backup explanation, including
  the quiz and passphrase reset, is in Settings > How Savborne works.
- Privacy shows the short version and two cards. Public visibility and storage
  are behind one closed disclosure; the full four-card notice is in Settings >
  How Savborne works and the compact sheet stays in Settings.
- The 24-word risk is visible on Backup and in Settings; it is no longer in the
  privacy short version. The no-custody promise is visible on the vault cards
  and in the privacy short version.
- The Settings Help section gained "How Savborne works"; the reference uses the
  same copy module as onboarding, so the two cannot drift.
- The privacy page fits the consent line and CTA at 360 when the disclosure is
  closed; opening the disclosure scrolls.
- The Welcome headline remains 36px Silkscreen and wraps to three or four lines
  at 360-430. The size is kept for fidelity.
- The name limit remains 16 for new names; the database check stays 1-32 for
  legacy names. Display-name uniqueness is still out of scope.
- The Nimiq Pay gate and Balance error copy were not the overloaded screens and
  are unchanged apart from the removed duplicate top header.
- The real-device Nimiq Pay pass at 360-430 is still yours. `.env.local` is not
  configured in this sandbox.

## Deployment before this build

1. Apply `supabase/FINAL-SCHEMA.sql`. The new API route calls the 7-argument
   `create_player_with_vault`, so apply the SQL before deploying.
2. Run the check-in acceptance checks from
   `docs/superpowers/backlog/2026-11-09-check-in-integrity.md`.
3. Confirm onboarding creates a player with `privacy_consent_at` and
   `privacy_notice_version` set.

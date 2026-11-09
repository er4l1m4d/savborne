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
- [ ] Name your character - Hero
- [ ] Name your character - Heroine
- [ ] Name at 16 characters
- [ ] Name error
- [ ] Settings - Character
- [ ] How Savborne works - Settings
- [ ] Loading state
- [ ] Items - paired card heights
- [ ] First check-in - paired tile heights
- [ ] Balance error
- [ ] Gate - Preparing
- [ ] Gate - Open inside Nimiq Pay
- [ ] Gate - Update Nimiq Pay
- [ ] Home - side outlines
- [ ] Profile - side outlines

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

## Settings - Character

Corrections:

-

## How Savborne works - `/settings/how-it-works`

Corrections:

-

## Balance error and the Nimiq Pay gate

Corrections:

-

## Known deliberate choices (not bugs)

- **Five steps:** Welcome 1/5, Vault 2/5 (intro and account picker), Backup 3/5
  (words, quiz, passphrase, ready), Privacy 4/5, Name 5/5. The label switches
  from 2 to 3 inside `/connect`; the character picker lives in Name, so the
  count does not change to six.
- **Character, not gender:** the screen says "Character" with Hero and Heroine.
  The profile stores an art choice (`avatar`), not a gender identity, and the
  privacy collect card names the chosen character as game data.
- **Default Hero:** both options are visible and switching is one tap; no extra
  required field. The preview updates immediately. The picker uses 32px art in
  56px cards, so the sprite has 12px above and below.
- **Changeable:** Settings > Account > Character uses the same picker and saves
  through `PATCH /api/players/me`. The name remains fixed; appearance does not.
- **Player sprites only:** Home, Profile, Name, the ranked queue me-card, the
  friend challenge me-card, the arena me sprite and the result me sprite use the
  chosen avatar. Opponents keep the current default art in this pass.
- **The vault intro** is a short paragraph, the can/cannot cards and a closed
  "How your vault works" disclosure. The three-step explainer is one tap away
  and also lives in Settings.
- **The 24-word warning** is two sentences; the full backup explanation,
  including the quiz and passphrase reset, is in Settings > How Savborne works.
- **Privacy** shows the short version and two cards. Public visibility and
  storage are behind one closed disclosure; the full four-card notice is in
  Settings > How Savborne works and the compact sheet stays in Settings.
- **The Settings reference** uses the same copy module as onboarding, so the
  short and long versions cannot drift.
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

1. Apply `supabase/FINAL-SCHEMA.sql`. The API route calls the 8-argument
   `create_player_with_vault` (privacy notice version and avatar), so apply the
   SQL before deploying.
2. Run the check-in acceptance checks from
   `docs/superpowers/backlog/2026-11-09-check-in-integrity.md`.
3. Confirm onboarding creates a player with `privacy_consent_at`,
   `privacy_notice_version` and `avatar` set.

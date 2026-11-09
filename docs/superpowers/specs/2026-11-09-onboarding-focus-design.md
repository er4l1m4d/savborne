# Onboarding focus pass - design

**Date:** 2026-11-09
**Branch:** `onboarding-ui-redesign`
**Extends:** `2026-11-09-onboarding-ui-design.md`
**Trigger:** review feedback: too much visible copy and a step count that did not match the screens.

## 1. Goal

Keep the onboarding screens short and scannable, make the progress indicator
honest across five steps, and move the longer explanations into a reference the
player can read later at their own pace.

Success means:

- Welcome, Vault, Backup, Privacy and Name each show the right step of five.
- The vault intro is a short paragraph, the can/cannot cards and a closed
  "How your vault works" disclosure. The three-step explainer is not visible by
  default.
- The 24-word warning is two sentences; the passphrase explanation is two.
- Privacy shows the short version and two cards; public and storage are behind
  one closed disclosure.
- Settings gains "How Savborne works", a calm reference for the vault, backup,
  privacy and Nimiq Pay behaviour. The existing compact privacy sheet stays.
- Every trimmed detail is still reachable after onboarding.
- 12px floor, 44px targets, 360px no truncation.

## 2. Decisions

| Decision | Choice |
|---|---|
| Step count | Five: Welcome, Vault, Backup, Privacy, Name |
| Step shape | Dynamic label inside `/connect`; no new route |
| Step 2 | Vault: intro + account picker |
| Step 3 | Backup: 24 words + quiz + passphrase + ready |
| Welcome indicator | Visible: "Step 1 of 5" in the brand row, five bars |
| Step label | "Step N of 5" with `aria-current="step"`; bars decorative |
| Vault explainer | Closed disclosure under the cards; the full section is in Settings |
| Backup warning | Two sentences: only key + unrecoverable |
| Passphrase copy | Two sentences: locks this device + reset with the words |
| Privacy visible | Short version + What we collect / What we don't |
| Privacy hidden | What's public / Where it's stored in one closed disclosure |
| Privacy short version | Two sentences; the 24-word risk lives on Backup and in Settings |
| Details home | New `/settings/how-it-works`, linked from Settings Help |
| Compact privacy sheet | Stays as the quick Settings version |
| Details source | `src/lib/onboarding-copy.ts` + `src/lib/privacy.ts` |

## 3. Step and route map

```
/welcome    Step 1 of 5   brand row, character, headline, CTA
/connect    Step 2 of 5   intro + account picker
/connect    Step 3 of 5   words, quiz, passphrase, ready
/privacy    Step 4 of 5   short version, two cards, disclosure
/name       Step 5 of 5   preview, field, counter, CTA
```

The route stays `/connect`; the step label and bars switch from 2 to 3 when the
phrase exists. The draft never crosses a route, so the phrase stays in memory.
The `/connect` ready state (returning from Privacy) is step 3.

## 4. Copy rules

- One headline and at most one short paragraph per screen.
- Safety facts that stay visible without opening anything:
  - Savborne cannot move, lock or spend NIM (vault cards, privacy short version).
  - Losing the 24 words and device loses the NIM (backup screen, two sentences).
  - The check-in balance is read, not supplied by the client (privacy collect card).
- Public visibility and storage move into the privacy disclosure and Settings.
- Everything else moves into `/settings/how-it-works`.

## 5. How Savborne works

`src/app/settings/how-it-works/page.tsx`, linked from Settings > Help.

Sections:

1. **Your vault** - the short intro, the three steps and the can/cannot cards.
2. **Backup and recovery** - the two-sentence risk, the quiz is a speed bump,
   the passphrase cannot be reset by Savborne but can be reset with the words.
3. **Privacy and data** - `PrivacyNotice variant="full"` (four cards, notice
   version).
4. **Nimiq Pay** - too-old app asks for an update; a failed balance read records
   nothing and keeps the streak and XP.

The page uses the same copy module as onboarding, so the two cannot drift.

## 6. Tests and renders

- Step label/bars at 1-5; Welcome 1, Vault 2, Backup 3, Privacy 4, Name 5.
- The vault disclosure is closed by default and contains the three steps.
- The backup warning is two sentences and imported from the copy module.
- Privacy onboarding variant renders two cards + disclosure; the full variant
  still renders four.
- Settings Help links to `/settings/how-it-works`; the page renders all four
  sections and uses the shared copy.
- Renders: welcome, connect-intro, connect-open, connect-picker,
  connect-phrase, connect-quiz, connect-lock, connect-ready, privacy,
  privacy-open, name, name-16, name-error, how-it-works, balance-error,
  gate x3 at 360/390/430 (18 states).
- Audit every state; no overflow, no target under 44px, min font 12, clean
  focus.

## 7. Rulings

- Welcome gets the indicator even though it is a landing screen: the count must
  be honest from the first screen.
- The vault disclosure is native `<details>`; no new primitive and no JS.
- The compact privacy sheet is not removed; the new screen is the long-form
  reference, not a replacement.
- The Nimiq Pay gate and Balance error copy are unchanged; they were not the
  overloaded screens in review.

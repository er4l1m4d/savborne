# Economy — Settings and account deletion

**Date:** 2026-11-06
**Status:** design approved in chat; written spec for review
**Batch:** Economy (first slice)
**Depends on:** Foundation 2 (`feat/foundation-2-primitives`, signed off 2026-11-06)

## 1. Goal

Give Savborne a real Settings screen and move account deletion out of the bottom
of Profile. Settings becomes the home for account facts, vault backup, help,
about and the two destructive actions. Delete becomes its own pushed route that
reuses the existing security logic unchanged. Disconnect gets a landing that
does not dead-end.

Success means:

- A 44×44 settings icon on Profile opens `/settings`.
- `/settings` contains Account, Backup, Help, About and Danger zone, using the
  Foundation 2 primitives only.
- Delete account opens `/settings/delete`, walks the existing proof gate, and
  confirms in a `BottomSheet`.
- Disconnect clears the local session and vault key, then Setup reconnects the
  existing profile instead of trying to create a second vault.
- Every route works at 360, 390 and 430px with no truncation, no sub-44px
  target, and the 12px type floor.

## 2. Scope

**In:**

- `/settings` and `/settings/delete` routes.
- Profile settings icon and the header change needed to host it.
- Settings sections: Account, Backup, Help, About, Danger zone.
- Disconnect confirmation and its local-only behaviour.
- Setup reconnect detection for an existing profile.
- Shared `PrivacyNotice` extraction.
- Tests and 360/390/430 renders for the new routes.

**Out:**

- Items, Bracket Climb, Withdrawal, and the Profile character-card/XP rebuild.
  Those stay in the Economy batch after this slice.
- Sound-effects or reduce-motion preferences. There is nothing real to wire, so
  no dead toggles ship.
- Any change to delete semantics, the signed `DELETE /api/players/me` contract,
  the database schema, or the vault crypto.
- Editing the display name. Settings shows it read-only in v1.

## 3. Decisions

| Decision | Choice |
|---|---|
| Settings entry | 44×44 icon on Profile, `Glyph name="flag"` (the handoff's own asset) |
| Settings shell | `pushed`, back to `/profile`; no bottom nav |
| Delete shell | `pushed`, back to `/settings`; auto-starts, no closed phase |
| Settings content | Account, Backup, Help, About, Danger zone |
| Destructive treatment | `variant="destructive"` rows and final buttons (coral-tint warn fill) |
| Final confirmations | `BottomSheet` for both Disconnect and Delete |
| Disconnect scope | Local only: clear session + local vault key; keep profile and server vault mapping |
| Disconnect landing | `/setup`, where the account picker reconnects an existing profile |
| Delete proof | Unchanged: passphrase → reveal → quiz, or type 24 words, or skip if no vault |
| Profile header | `title="Profile"` + settings icon; display name/level/bracket move into the body |

## 4. Routes and navigation

### 4.1 `/settings`

- `src/app/settings/page.tsx`, outside the `(tabs)` group.
- `<ScreenShell variant="pushed" title="Settings" backHref="/profile">`.
- On mount, `readSession()` is checked. No session → `router.replace('/setup')`.
- A 401 from `/api/profile` also redirects to `/setup`.
- The pushed shell owns the full viewport height and the 32px + safe-area
  bottom gutter; the tabs nav is not rendered.

### 4.2 `/settings/delete`

- `src/app/settings/delete/page.tsx`, outside `(tabs)`.
- `<ScreenShell variant="pushed" title="Delete account" backHref="/settings">`.
- Same session guard.
- The route starts in `checking` on mount. There is no `closed` phase and no
  inline entry button.

### 4.3 Profile entry

- `ScreenShell` title becomes `"Profile"`; `actions` becomes the settings
  `ButtonLink` (`variant="icon"`, `aria-label="Settings"`, `Glyph name="flag"`).
- The display name, level and bracket chip move to the first body block:
  `.sv-heading sv-break` for the name, then a `.sv-label` line with
  `Level N · <Bracket>`; the bracket chip keeps its colour.
- This is the only Profile layout change in this slice. Character card, XP,
  items shortcut and the rest of the Profile restructure stay deferred.

## 5. Settings anatomy

All sections use `PixelPanel` + `Row`; headings use `.sv-section-label`. The
screen body uses the standard 14px gap.

### 5.1 Account

`PixelPanel` with three rows:

1. **Display name** — value on the right, `.sv-label font-bold`, wraps. Read from
   `/api/profile`.
2. **Vault address** — shortened mono value (`.sv-figure font-mono sv-break`).
   When no vault exists: `Not created`. Read from `/api/vaults`.
3. **Backup** — `Verified` in mint when `backupVerifiedAt` is non-null, otherwise
   `Not backed up` in coral-text. Read from `/api/vaults`. This is a status row,
   not a button; the actions live in the Backup section below.

### 5.2 Backup

The existing `<BackupSettings />` moves here unchanged. It already renders its
own “Backup” heading and stepped panels, so it sits directly after Account.
Its `playerAddress` comes from the session.

### 5.3 Help

Two rows/actions:

- **Show tour again** — clears `TOUR_FLAG_KEY` and pushes `/vault` (same
  behaviour as today).
- **Contact** — `mailto:` link to the existing `CONTACT_EMAIL`.

### 5.4 About

- **Version** — read-only row, `v{version}` imported from `package.json`.
- **Your address** — shortened mono player address, `.sv-figure font-mono sv-break`.
- **Privacy notice** — row that opens a `BottomSheet` titled “Privacy notice”.
  The sheet renders the shared `PrivacyNotice` copy and a “Close” ghost button.
- The custody line from the old Profile footer moves here as
  `.sv-label text-fg-faint`: “Savborne never holds your NIM. A 24-word phrase
  generated on your device controls your vault. Balances are read from the
  chain, never stored by us.”

### 5.5 Danger zone

Heading `.sv-section-label text-coral-text`. Two full-width destructive rows:

- **Disconnect savings account** — opens the Disconnect sheet (§7).
- **Delete account** — `ButtonLink` to `/settings/delete`.

## 6. Delete flow

### 6.1 Gate

`deletionGate(readVault(playerAddress) !== null, serverVault !== null)` decides
the path, exactly as today:

| Local vault | Server vault | Steps |
|---|---|---|
| yes | yes | Proof (passphrase) → Reveal → Quiz → Review |
| no | yes | Type 24 words → Review |
| no | no | Review |

The server vault is read with `GET /api/vaults` using the session headers.

### 6.2 Progress

A four-dot indicator plus one label (same pattern as Setup) shows
`Step N of M · <label>`. M is 4 for the local-vault path, 2 for the typed-words
path and 1 for no vault. Only the active label renders, so 360px never
truncates.

### 6.3 Review

The review panel states:

- what is removed: profile, level, XP, streak, items, badges, check-ins and
  battle history;
- what stays: the NIM in the vault and the 24 words that control it;
- that onboarding again creates a new vault.

`Delete everything` (`variant="destructive"`) opens the confirmation sheet. The
sheet repeats the irreversible line and holds the real `Delete everything`
button plus `Cancel`. The signed delete call only runs from the sheet button.

### 6.4 Success and failure

- Success: `clearVault(playerAddress)`, `writeSession(null)`, remove
  `TOUR_FLAG_KEY`, then `window.location.replace('/setup')`. `busy` stays true
  so the unmounting screen cannot be tapped again.
- Failure: `Banner tone="error"` with the existing message mapping; the sheet
  closes, `busy` resets, and the player can retry.
- A cancelled sheet changes nothing.

### 6.5 No behaviour change

The flow keeps the existing:

- `deletionGate`, `decryptPhrase`, `phraseMatchesVault`, `deleteMessage`,
  `signMessage`, `deleteAuthHeaders`;
- 24-word validation and address matching;
- idempotent `DELETE /api/players/me`;
- copy-to-clipboard requirement before the quiz.

This slice is a UI port and route move, not a security rewrite.

## 7. Disconnect

### 7.1 Sheet copy

> **Disconnect this device?**
>
> This removes the vault key and your session from this device. Your profile,
> level, streak and vault stay on the server. The NIM in the vault is untouched,
> and your 24 words still control it.
>
> To use the vault again, reconnect this wallet in Setup, then restore the key
> from your 24 words in Settings → Backup.

If the device has no local vault key, the first line becomes “This device has
no vault key; this only signs you out.”

### 7.2 Confirm

- Button: `Disconnect` (`variant="destructive"`), full width.
- Action: `clearVault(playerAddress)` if a key exists, `writeSession(null)`,
  then `window.location.replace('/setup')`.
- The tour flag is kept, so a reconnect does not replay the vault tour.
- Cancel/backdrop/Escape close the sheet and change nothing.

### 7.3 Why Setup must reconnect

Clearing the session sends the player to `/setup`. Without reconnect detection,
Setup would generate a new vault and `POST /api/players` would return
`vault_exists`, leaving the player stuck. §8 fixes that.

## 8. Setup reconnect

### 8.1 Picker change

`StepCreateVault`’s account button currently calls `createVault(address)`
directly. It becomes `chooseAccount(address)`:

1. `setLoading(true)`, clear the error.
2. `GET /api/players/me` with `X-Player-Address: address` (explicit header; no
   session exists yet).
3. `200` → build a session from `player.address`, `player.savingsAddress` and
   `player.displayName`; `writeSession(...)`; `router.replace('/')`.
4. `404` → continue into the existing `createVault(address)`.
5. Any other status → `Banner tone="error"`; do not create a vault.

Copy under the picker: “Already have a profile with this wallet? We reconnect
it instead of creating a second vault.”

### 8.2 Helper

Add `src/lib/reconnect.ts`:

```ts
export function sessionFromProfile(profile: {
  address: string
  displayName: string
  savingsAddress: string
}): Session
```

Pure, testable, and the only place that maps a profile into a session. The page
keeps the fetch and routing.

### 8.3 Edge cases

- The picked wallet has a profile and a local vault key: reconnect; Home works
  and Vault shows the balance.
- The picked wallet has a profile but no local key: reconnect; Vault shows the
  existing “restore from your 24 words” guidance, now reachable because
  Settings → Backup needs a session.
- The picked wallet has no profile: unchanged onboarding.
- `/api/players/me` 401/500: error banner, no vault created.

## 9. Components and files

**New**

- `src/app/settings/page.tsx` — Settings screen.
- `src/app/settings/delete/page.tsx` — delete route.
- `src/components/settings/DeleteAccountFlow.tsx` — the phase machine moved out
  of `DeleteAccount.tsx`; owns the sheet and the delete call.
- `src/components/PrivacyNotice.tsx` — shared five-paragraph notice.
- `src/lib/reconnect.ts` — `sessionFromProfile`.
- `src/lib/settings.test.ts` — source contracts and the reconnect helper.

**Modified**

- `src/app/(tabs)/profile/page.tsx` — settings icon, header/name move, remove
  `DeleteAccount`, `BackupSettings`, Help and footer (they move to Settings).
- `src/app/setup/page.tsx` — `chooseAccount`, reconnect copy, `PrivacyNotice`.
- `src/components/DeleteAccount.tsx` — deleted; its logic moves to
  `DeleteAccountFlow`.
- `src/app/globals.css` — only if a missing utility is genuinely needed; reuse
  existing `.sv-*`, `.pxw`/`.px`, `sv-btn--destructive`, `sv-sheet`.
- `C:\Users\hp\AppData\Local\Temp\opencode\capture-ui.mjs` — add `/settings`
  and `/settings/delete` routes (throwaway harness, not committed).

## 10. Data flow and APIs

No new API routes and no schema changes.

| Call | Used by | Change |
|---|---|---|
| `GET /api/profile` | Settings (account values) | none |
| `GET /api/vaults` | Settings (backup status), delete gate | none |
| `GET /api/players/me` | Setup reconnect | called with an explicit address header before a session exists |
| `DELETE /api/players/me` | Delete route | none |
| `GET /api/players/me` | Delete proof (`createdAt`) | none |

The session shape is unchanged. Disconnect removes it; Setup reconnect writes
it from the profile.

## 11. Errors and edge cases

- Settings load failure: `Banner tone="error"` with a retry button; the shell
  and back link stay usable.
- No vault: Account shows `Not created`; Disconnect still signs out; Delete
  goes straight to Review.
- No local key but server vault: Disconnect copy says it only signs out; Delete
  uses the typed-words path.
- Sheet open while a request is in flight: the confirm button is disabled and
  shows the busy label.
- Delete API failure: banner in the route; the sheet closes so the message is
  visible and the retry is reachable.
- 401 anywhere: `/setup`.
- Double-tap on Disconnect/Delete: `busy` guards the second call.

## 12. Accessibility and responsive

- Settings icon is 44×44 with `aria-label="Settings"`.
- Rows are at least 58px; destructive buttons at least 56px.
- The sheet is the existing focus-trapped `BottomSheet`: initial focus, Escape,
  Tab loop, focus restored to the trigger, body scroll locked.
- Every new text style is 12px or larger; no `text-[10px]`/`text-[11px]`.
- At 360px: addresses and long names wrap (`.sv-break`); row values may stack
  under their labels rather than truncate.
- No horizontal scroll at 360/390/430.
- Reduced motion is inherited from the Foundation 2 CSS; the sheet animation
  collapses.

## 13. Testing

- `src/lib/settings.test.ts`:
  - `sessionFromProfile` maps address/displayName/savingsAddress and nothing
    else.
  - Settings source uses `ScreenShell` with `variant="pushed"` and both
    destructive actions.
  - Delete route source uses `deletionGate` and the signed delete headers; it
    does not call `DELETE` without the proof.
  - Setup source calls the reconnect check before `createVault`.
- `src/lib/type-floor.test.ts` covers all new files automatically (`PENDING`
  stays empty).
- Full suite: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Harness renders `/settings` and `/settings/delete` at 360/390/430; Profile
  before/after for the entry point.
- Keyboard/touch audit: `overflowX: 0`, no sub-44px target, min font 12px,
  reading-order focus, visible outline, sheet trap.
- 360px check: no truncated action label, balance, XP value or row title.

## 14. Evidence and sign-off

- Before: current Profile at 360/390/430, plus the delete flow screenshots
  already in `docs/superpowers/delete-account-*.png`.
- After: Profile, Settings, Delete (each phase that can be reached with a
  fixture), 360/390/430.
- The real-device pass in Nimiq Pay remains the user's final step.

## 15. Deviations and deliberate choices

1. **Profile header changes** to `"Profile"` + settings icon, with the name and
   level moved into the body. Keeping the name in the header would collide with
   a 44px icon at 360px.
2. **`PrivacyNotice` is extracted** from Setup so Settings and onboarding share
   one copy; the alternative is duplicated legal text.
3. **Setup gains a reconnect check.** Without it, Disconnect dead-ends at
   `vault_exists`. The check is read-only and only writes a session for a 200.
4. **No preferences section.** Sound and reduce-motion toggles would be dead
   controls; reduce motion already follows the OS setting.
5. **Version is imported from `package.json`.** The alternative is a build-time
   env var for a value that already exists.
6. **New routes have no meaningful before render.** Evidence is the Profile
   before/after pair plus the new screens.
7. **The delete flow keeps its security logic exactly.** The UI and route move;
   the signature, phrase matching and idempotency do not change.

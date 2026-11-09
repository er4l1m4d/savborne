# Home UI redesign - design

**Date:** 2026-11-09
**Branch:** `home-ui-redesign` (from `main` at `24836e0`)
**Depends on:** Foundation 2 primitives and the completed Economy batch.
**Reference:** `Savborne-handoff.html` figures `A_Home`, `A_HomeDone`, `A_FirstCheckin`.

## 1. Goal

Rebuild Home around the handoff: a wordmark header with bracket and level chips, a character card with the XP bar, a savings card that owns the check-in action, the two daily missions, and a Battle card. Add the checked-in state and the First check-in celebration as a real screen.

Success means:

- Home at 360/390/430 matches the handoff's structure and rhythm.
- The check-in action sits in the savings card and becomes a disabled "Checked in today" state after a successful check-in.
- The delta since the previous reading appears after a check-in.
- A first check-in routes to `/first-checkin` with First Steps, +20 XP, the recorded balance and the Entry items.
- Every route is 12px+, 44px targets, no horizontal overflow, no truncated actions.

## 2. Scope

**In:**

- Home page restructure: header, character card, savings card, mission list, Battle card.
- Checked-in state and delta chip.
- `/first-checkin` route and its check-in handoff.
- `checkInDestination` gains a first-check-in result, before withdrawal and bracket climb.
- `checkedInToday(lastCheckInAt, now)` UTC helper and tests.
- Renders and audit for Home and First check-in.

**Out:**

- Missions screen tabs/grouped rows.
- Battle screens (ranked locked, queue, timeout, friend, arena, results).
- A new logo asset or wordmark drawing. The handoff's logo glyph is not in `assets/glyphs.json`; the shell title is the wordmark.
- Changes to check-in API semantics, XP values or mission rules.
- The Vault, Receipts and Card redesign.

## 3. Decisions

| Decision | Choice |
|---|---|
| Header | `ScreenShell title="Savborne"` (Silkscreen wordmark), actions = bracket chip + mint `Lv N` chip |
| Character card | 132x176 sprite well, `CharacterArt` at 96px, name, level/bracket, 14px XP bar, "N XP to Level N+1" |
| Check-in action | Inside the savings card; coral primary; disabled "Checked in today" with check glyph |
| Checked-in detection | UTC date of `player.lastCheckInAt` versus now |
| Delta chip | `balanceLuna - previousBalanceLuna` from the check-in response; mint for positive, coral for negative; hidden on reload |
| Balance precision | 2dp on Home, matching the handoff's `12.40` |
| Streak chip | Savings card balance row; `N-day streak`; hidden at 0 |
| Shields / check-ins | Removed from Home to keep the Battle card on the handoff's one-screen height; check-ins remain on Profile, shields remain in the game model |
| Missions | Two 58px rows (Daily Check-in, Quick Duel), 24px checkbox, +XP trailing; no progress bar |
| Battle card | Cream `PixelPanel`, battles left from `BATTLE.dailyLimit - battlesToday`, coral "Choose opponent" |
| First check-in | New `/first-checkin` route; precedence over withdrawal and bracket climb |
| Open vault | Keep a small ghost link in the savings card; the handoff has no vault route, but Vault has no other entry |
| Header name | The display name moves to the character card; the header is the product wordmark |

## 4. Home anatomy

`ScreenShell variant="tab" title="Savborne"`, actions:

```tsx
<Chip variant="outline" color={BRACKETS[bracket].color}>{BRACKETS[bracket].label}</Chip>
<Chip variant="fill">Lv {player.level}</Chip>
```

Body, in order:

### 4.1 Character card

`PixelPanel className="p-4 flex gap-4 items-center"`.

- Left: `w-[132px] h-[176px]` well with `background: var(--sprite-well)`, `CharacterArt bracket={bracket} size={96}`.
- Right:
  - `<h2 className="sv-heading sv-break">{player.displayName}</h2>`
  - `.sv-label text-fg-muted` `Level {level} · {Bracket}`.
  - XP bar: 14px high, 2px cream border, shell fill, mint fill at `inLevel/toNext`.
  - `.sv-label text-fg-faint` `{toNext - inLevel} XP to Level {level + 1}`.

Use `xpProgress(level, xp)` from `constants.ts`; never divide cumulative XP.

### 4.2 Savings card

`PixelPanel className="p-4 flex flex-col gap-3.5"`.

- Header row: `Savings account` (`.sv-label text-fg-muted`) and status:
  - checked in today: `Checked in just now` in mint
  - otherwise: `Last check-in {relative}` in muted
- Balance row:
  - `.sv-number-xl` balance, 2dp, `NIM` at 12px muted
  - right: delta chip if `deltaLuna !== 0`, else streak chip if `streakCurrent > 0`
- Check-in `Button`:
  - default: `variant="primary"`, 64px, `Check in now`
  - busy: `Reading balance…`
  - checked in: disabled, `Checked in today`, leading `Glyph name="check"`; off colors
- `ButtonLink href="/vault" variant="ghost" className="self-start"` `Open vault`.

### 4.3 Daily missions

`PixelPanel className="px-4 py-0"` with two `Row`s (58px, divider).

Each row:

- Leading 24px square:
  - not done: 2px mint border
  - done: mint fill with `<Glyph name="check" size={16} />`
- Label 15px; done rows muted.
- Trailing:
  - not done: `+{xp} XP` mint
  - done: `+{xp} XP earned` muted

No heading and no progress bar; the Missions tab owns the full list.

### 4.4 Battle card

`PixelPanel tone="cream" className="p-3.5 flex items-center gap-3.5"`.

- Left column: `Battle` at 22px, `{battlesLeft} battles left today` at 13px in `text-background/70`.
- Right: `ButtonLink href="/battle" variant="primary"` `Choose opponent`.
- `battlesLeft = Math.max(0, BATTLE.dailyLimit - player.battlesToday)`.

### 4.5 Awards panel

Keep the existing `AwardsPanel` when the player stays on Home after an ordinary check-in. The full awards summary stored by celebration routes is read on mount, so returning from First check-in, Bracket Climb or Balance dropped still shows the awards.

## 5. Checked-in state

- `checkedInToday(player.lastCheckInAt)` compares UTC year/month/day.
- The button is disabled; no second POST.
- The status line is mint.
- The Daily Check-in mission row comes from `/api/missions` after `refresh()`; the API marks it completed. If the fetch is slow, the row may lag one tick; the button state is authoritative.
- The delta chip uses the check-in response:
  - `previousBalanceLuna` is the server's prior reading (the API now returns it).
  - `delta = balanceLuna - previousBalanceLuna`.
  - Positive: mint `+0.15 since last`; negative: coral `-0.15 since last`; zero/null: hidden.
  - Stored in component state, so a reload hides it rather than inventing a delta.

## 6. First check-in

### 6.1 Trigger and precedence

`checkInDestination` gains `firstCheckIn` and returns in this order:

1. `first-checkin`
2. `withdrawal`
3. `bracket-climb` (rank rise only)
4. `home`

Home computes `firstCheckIn = json.awarded.some((a) => a.key === 'first_steps')` and passes it.

### 6.2 Handoff

New `FirstCheckInHandoff` and sessionStorage key `savborne.first-checkin.v1`:

```ts
type FirstCheckInHandoff = {
  xp: number
  balanceLuna: number
  bracket: Bracket | null
  items: ItemKey[]
}
```

Home writes it and the full awards summary, then routes. The screen consumes the handoff once behind a ref; a direct visit goes Home.

### 6.3 Screen

`ScreenShell variant="pushed"`, no header:

- Centered 112x112 `PixelPanel` with `BadgeArt badge="first_steps" state="earned" size={72}`.
- `sv-number-xl` `First Steps`.
- Body: "Your savings account is connected and your first check-in is recorded."
- Two `PixelPanel` tiles: `+{xp} XP` mint / `{balance 2dp} NIM`.
- `PixelPanel` "Entry bracket unlocked" (or "Entry items unlock at 1 NIM" when `bracket === null`):
  - right label `1 NIM`
  - item rows from `ITEMS` matching `items`, `ItemArt` 32px + name in a 2-col grid.
- `ButtonLink href="/" variant="primary"` `Go to Home`.

## 7. Data and APIs

No new API routes or schema changes. The existing check-in response already has `awarded`, `balanceLuna`, `previousBalanceLuna`, `bracket`, `unlockedItems`, `badgeActions`.

Home still uses `usePlayerSession` for `level`, `xp`, `bracket`, `balanceLuna`, `streakCurrent`, `shields`, `checkInCount`, `battlesToday`, `lastCheckInAt`.

## 8. Errors and edge cases

- Check-in failure: `Banner` under the savings card; button re-enabled.
- `/api/missions` failure: rows omitted; Home still usable.
- No bracket: hide the bracket chip; character uses the Entry sprite; first-check-in panel says items unlock at 1 NIM.
- No last check-in: status "Not checked in yet"; button enabled.
- Checked in at 23:59 UTC and viewing at 00:01: button enabled again; the helper uses UTC.
- Storage write failure for a celebration: stay on Home and show the awards panel.
- Direct visit to `/first-checkin`: redirect Home.
- First check-in that is also a withdrawal or bracket rise: First check-in wins; the awards panel on Home carries the rest.

## 9. Accessibility and responsive

- Header chips are non-interactive; check-in button 64px; battle CTA 64px.
- 24px mission checkboxes sit inside 58px rows; the row is not interactive (display only).
- 12px floor; no `text-[10px]`/`text-[11px]`.
- 360px: character name wraps inside the card; balance and chips wrap; battle card stacks if needed; no truncation.
- The savings card's button is the only check-in control.
- `BadgeArt`, `ItemArt` and `CharacterArt` are decorative; adjacent text names them.
- No animation beyond existing mint fill transitions; reduced motion inherited.

## 10. Testing and evidence

- `checkInDestination` first-check-in precedence test.
- `checkedInToday` UTC tests: same day true, previous UTC day false, null false.
- First-check-in handoff storage one-shot test.
- Source contracts: Home has the character card, savings check-in button, mission rows, battle card; `/first-checkin` uses `BadgeArt`/`ItemArt`.
- Full suite, `tsc`, lint, build.
- Renders: Home default and checked-in, First check-in, at 360/390/430; before/after Home pair.
- Audit: `overflowX: 0`, no wide elements, 44px targets, min font 12, focus order, mint outline.

## 11. Deviations

1. **No new logo asset.** The handoff's header logo glyph is not in `assets/glyphs.json`; the Silkscreen shell title is the wordmark. Adding art is a separate art task.
2. **Open vault stays.** The handoff has no Vault entry; the app's Vault has no tab, so Home keeps a ghost link.
3. **Shields and check-ins stay.** App-specific features; expressed as one compact line, not handoff screens.
4. **Battle CTA is coral.** The handoff draws a dark button inside the cream card; the design rule makes the advancing CTA coral.
5. **First check-in wins over bracket climb.** The first check-in usually crosses the Entry threshold; the celebration screen shows the Entry items and Home carries the bracket awards.
6. **Delta hidden on reload.** It is a post-check-in affordance, not persisted state.
7. **Balance is 2dp on Home.** The handoff shows `12.40`; the 5dp value remains available on Vault/receipts where precision matters.
8. **Shields/check-ins are not on Home.** The handoff Home has no support line; keeping it pushed the Battle card below the fold. Check-ins remain on Profile and shields remain in the streak model.

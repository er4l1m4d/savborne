# Missions API gaps review notes

Open `index.html` in a browser. Write corrections under the screen they belong
to, naming the width and the element where possible.

## Sign-off

- [ ] Weekly Strategist — 0 wins
- [ ] Weekly Strategist — 1 win
- [ ] Weekly Strategist — 2 wins

## Weekly Strategist — 0 wins

Corrections:

-

## Weekly Strategist — 1 win

Corrections:

-

## Weekly Strategist — 2 wins

Corrections:

-

## Audit

- 9 rows: 3 states x 360/390/430.
- `overflowX: 0`; no element wider than the viewport.
- No interactive target below 44x44. Rows and the meter are not interactive;
  the tabs are 44px and the nav items 56px.
- Minimum rendered font is 12px.
- Every focus stop is in view, uncovered, with the 2px mint outline. The meter
  is a `progressbar` but not a focus stop.
- The Weekly Strategist row is 58px at all three widths.
- The meter is 90x14 with `aria-valuenow` 0, 1 and 2 of 2.

## Known deliberate choices (not bugs)

- The progress line replaces the Weekly Strategist description, as the handoff
  draws it, so the row keeps its 58px rhythm. Other open rows keep their
  descriptions; other done rows stay title + muted XP.
- The meter is the existing Foundation 2 `Meter` at the handoff's 14px height
  and 90px width. No new primitive and no shared CSS change.
- Completed rows keep the meter and `2 of 2 wins`; the label and the +40 XP are
  muted, the meter is full mint, and the visually hidden `(completed)` stays.
- AI wins never count. The API counts `mode in ('ranked','unranked')`, and
  settlement uses the same helper.
- Weekly XP is now the exact sum of the week's weekly mission rewards, not a
  check-in count and not an average. The same helper feeds `/api/missions`,
  `/api/players/me`, `settleMissions` and the check-in cap headroom.
- The fixture leaves Steady Saver open, so the Weekly counter reads 25 of 100 XP
  at 0/1 wins and 65 of 100 XP at 2 wins. That is the sum of Weekly Check-in
  (25) and Weekly Strategist (40) at 2 wins, not a hardcoded figure.
- The progress text uses the 12px `.sv-caption` role; the title stays 15px.
- The all-done state's strategist row is the 2-win render. No other Missions
  state is affected by this row change.
- The 2-win fixture sets `completed: true`, matching what the server returns
  once settlement credits the mission.

## Deployment before sign-off

1. No schema or SQL change is needed for this batch.
2. The real-device Nimiq Pay pass at 360-430 is the user's step; `.env.local`
   is not configured in this sandbox.
3. Do not merge or push until the user signs off.

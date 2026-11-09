# Missions UI review notes

Open `index.html` in a browser. Write corrections under the screen they belong
to, naming the width and the element where possible.

## Sign-off

- [ ] Repeating
- [ ] One-time
- [ ] All done
- [ ] Empty
- [ ] Error
- [ ] Loading

## Repeating — `/missions`

Corrections:

-

## One-time — `/missions`

Corrections:

-

## All done

Corrections:

-

## Empty

Corrections:

-

## Error

Corrections:

-

## Loading

Corrections:

-

## Known deliberate choices (not bugs)

- The Weekly caption is the handoff copy, `Resets Monday 00:00 UTC · 25 of
  100 XP`; at 360 it still fits on one line beside `Weekly`. If a future copy
  change pushes it over, the header wraps rather than shrinking or truncating.
- Rows are status only. Missions are credited by check-in and battle on the
  server; there is no client write, so the 24px box is not a control and the
  row is not a 44px target.
- Row type follows the handoff: a 15px/1.35 title and a 12px/500/1.35
  description. The body column carries 8px vertical padding, so a two-line
  description row grows to about 71px and its last line clears the divider by
  8px. Done and one-line rows stay 58px.
- Groups are separated by 24px (Daily panel to Weekly header). The tabs keep
  14px to the first group, and a header keeps 8px to its own panel.
- Done rows are exactly 58px with no description. Open rows grow when the
  description wraps (`Balance held or grew at every check-in this week` is two
  lines at 360/390); nothing is clipped.
- The group counter's earned figure is derived from the completed rows and
  clamped to the API cap. `counters.weeklyXpEarned` in `/api/missions` is a
  check-in count, not weekly XP, so it is not displayed. The API field is the
  follow-up, not a UI change.
- One-time shows no XP counter: the API has no one-time counter and inventing a
  total would invite cap confusion.
- Weekly Strategist has no `1 of 2 wins` meter. The handoff draws one, but the
  API returns only `completed`; adding progress needs a new payload field.
- Group titles are default text, not mint. Mint is reserved for success,
  progress and the XP figures, matching the handoff.
- The empty state is per tab: Repeating says `Check back after the next reset.`,
  One-time says `One-time missions appear as you play.`
- The error state adds a secondary `Try again` that re-runs the fetch. The
  handoff has no error screen for Missions; this follows the shared Banner and
  Button pattern.
- Loading keeps the tabs visible and uses the branded three-dot LoadingState.
- Home's `xpReward` field fix is its own commit in this branch; it is not a
  Missions layout change.

## Deployment before sign-off

1. Apply `supabase/FINAL-SCHEMA.sql` if the target database is behind.
2. Real-device Nimiq Pay pass at 360–430 is the user's step; `.env.local` is not
   configured in this sandbox.
3. Do not merge or push until the user signs off.

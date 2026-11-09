# Battle UI review notes

Open `index.html` in a browser. Write corrections under the screen they belong
to, naming the width and the element where possible.

## Sign-off

- [ ] Battle menu
- [ ] Ranked locked
- [ ] Daily limit
- [ ] Ranked queue
- [ ] Queue timeout
- [ ] Friend challenge sent
- [ ] Challenge expired
- [ ] Battle arena
- [ ] In-battle wait
- [ ] Use an item
- [ ] Connection lost
- [ ] Result win
- [ ] Result loss
- [ ] Result tie

## Battle menu — `/battle`

Corrections:

-

## Ranked locked

Corrections:

-

## Daily limit

Corrections:

-

## Ranked queue — `/battle/queue`

Corrections:

-

## Queue timeout

Corrections:

-

## Friend challenge sent — `/battle/friend/[id]`

Corrections:

-

## Challenge expired

Corrections:

-

## Battle arena — `/battle/[id]`

Corrections:

-

## In-battle wait

Corrections:

-

## Use an item

Corrections:

-

## Connection lost

Corrections:

-

## Results — `/battle/[id]/result`

Corrections:

-

## Known deliberate choices (not bugs)

- Mode titles use `.sv-subheading` (20px). Foundation 2 has no 24px Jakarta role.
- Ranked Locked is the menu card, not a separate `/battle/ranked` route; the
  handoff figure is the menu with a locked card.
- Friend wait lives at `/battle/friend/[id]` so refresh and direct entry work.
  A pending creator on `/battle/[id]` is redirected there.
- The result shows the current rating from `/api/profile`, not a delta. The
  pre-battle rating is not persisted. Unranked and AI results show the W-L-T
  record instead.
- Result sprites follow the winner: 112px winner, 80px loser and 96px each on
  a tie. The pair is centred with a fixed 16px gap and a shared bottom edge.
  The handoff drew them near-equal; this is a deliberate readability change
  and applies to the result screen only.
- The Daily Limit panel adds a `Go to Missions` link; the handoff caption asks
  for one but the figure does not draw it.
- The AI card uses the existing rival art because the handoff's robot glyph is
  not in `assets/glyphs.json`.
- Connection Lost is an in-page state, not a route. The poll keeps retrying.
- Queue polling is 10s and battle polling is 3s; there is no realtime channel.
- The check-in release gate migration is applied manually. The sandbox has no
  `.env.local`, so the live five-POST/concurrency/rate-limit checks are the
  deployment step.

## Deployment before ranked is public

1. Apply `supabase/FINAL-SCHEMA.sql` (the only SQL file).
2. Run the acceptance checks in
   `docs/superpowers/backlog/2026-11-09-check-in-integrity.md`:
   five POSTs in one UTC day leave `check_in_count` at 1; two concurrent POSTs
   create one reading and one reward set; the 11th request in a minute is 429.
3. Confirm `/api/queue/join` still rejects a player with four distinct days.

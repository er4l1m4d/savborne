# Ranks UI review notes

Open `index.html` in a browser. Write corrections under the screen they belong
to, naming the width and the element where possible.

## Sign-off

- [ ] Ranked (your row in the top 50)
- [ ] Your rank pinned (outside the top 50)
- [ ] Unranked
- [ ] Friends
- [ ] Friends empty
- [ ] Empty
- [ ] Error
- [ ] Loading

## Ranked — `/leaderboard`

Corrections:

-

## Your rank pinned

Corrections:

-

## Unranked

Corrections:

-

## Friends

Corrections:

-

## Friends empty

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

- The rank-1 crown is the handoff's 24px drawing and is positional. It is not
  the 16px Golden Crown item and not the Gold-bracket badge; that badge still
  lives on Profile. The crown is decorative to assistive technology because the
  rank cell already announces `Rank 1`.
- Both boards show the crown on rank 1, because both handoff figures draw it.
- Unranked keeps the app's combined savings score and ordering. The handoff's
  level ordering and `Lv N` figure are a recorded divergence, not a bug.
- Ranks rows are single-line by design: rank, name, bracket and figure. Level,
  wins and streak are not shown here; they remain on Home and Profile.
- The Everyone/Friends control is one right-aligned segmented bar, not two
  chips: a 32px beveled track with a 2px internal divider, 28px segments and
  44px button targets. It is visibly smaller than the 44px tabs. The selected
  segment is cream with ground text.
- The You row is 60px with a 14px inline bleed through the panel padding. The
  row directly above it loses its grey divider and the top gap is closed, so
  the mint top border sits where the divider was; the 4px bottom gap stays.
  The panel uses `px-3.5`; changing it requires updating `.sv-row--you`.
- The You tag is the existing 24px Chip at 12px, 4px taller than the handoff's
  20px/11px tag, to meet the type floor.
- The pinned row is a mint-outlined panel under a `Your rank` caption when the
  caller is outside the top 50. The row inside is plain: no tint, no mint rank,
  no `You` tag. It never reads as rank 51 or as part of the contiguous list.
- Friends-empty is distinct from Everyone-empty because the API always includes
  the caller. The Everyone segment stays one tap away.
- The verified-saver legend appears only when a verified marker is on screen.
- A long name wraps inside the 56px row instead of truncating; a fourth line
  would grow the row.
- Ranks 1-3 use default text and 4+ use muted text, as the handoff draws them.
  The old gold/silver/bronze rank numbers are gone from this screen.
- Filter segment selection is cream fill with ground text. Mint stays for the
  tabs, progress/success and the You row.
- Tab and filter state are local React state; there is no query parameter.
- A 401 redirects to `/setup`, matching the other data screens.

## Deployment before sign-off

1. Apply `supabase/FINAL-SCHEMA.sql` if the target database is behind.
2. Real-device Nimiq Pay pass at 360–430 is the user's step; `.env.local` is not
   configured in this sandbox.
3. Do not merge or push until the user signs off.

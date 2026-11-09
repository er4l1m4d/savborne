# Economy — Settings and delete review notes

**How to use:** open `index.html` in a browser. Write corrections under the
screen they belong to. A correction is easiest to act on when it names the width
and the element, e.g. “360 — Settings: the Danger zone buttons sit too close to
the custody line”.

## Sign-off

- [ ] Profile
- [ ] Settings
- [ ] Settings — Disconnect sheet
- [ ] Settings — Privacy sheet
- [ ] Delete — proof
- [ ] Delete — review
- [ ] Delete — confirmation sheet

## Profile — `/profile`

Corrections:

-

## Settings — `/settings`

Corrections:

-

## Settings — Disconnect sheet

Corrections:

-

## Settings — Privacy sheet

Corrections:

-

## Delete — proof — `/settings/delete`

Corrections:

-

## Delete — review

Corrections:

-

## Delete — confirmation sheet

Corrections:

-

## Cross-screen

Corrections that apply everywhere (type, spacing, colour, motion, focus):

-

## Known deliberate choices (not bugs)

- Settings and Delete are pushed screens: they have a back button and no bottom nav.
- Profile's header is `Profile` + the flag settings icon; the display name, level and bracket moved into the body so a 44px icon cannot collide at 360px.
- Delete is its own route. The review panel's `Delete everything` only opens the sheet; the signed request runs from `Yes, delete everything`.
- Disconnect is local only. It clears the session and the device vault key, then Setup reconnects the wallet before Backup can restore the key from the 24 words.
- There are no sound or reduce-motion toggles: there is nothing real to wire, so no dead controls ship.
- `/settings/delete` wraps its title to two lines at 360px. That is the type floor doing its job; nothing is truncated.
- The privacy sheet scrolls inside `max-height: 80dvh` at 360px.
- The privacy-sheet PNG predates a final copy correction: the code now says “emailing the contact in Settings → Help”, not “the app footer”; the layout is unchanged.
- The real-device pass in Nimiq Pay is still yours to do; these are headless renders.

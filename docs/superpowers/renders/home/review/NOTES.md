# Home UI review notes

Open `index.html` in a browser. Write corrections under the screen they belong
to, naming the width and the element where possible.

## Sign-off

- [ ] Home default
- [ ] Home checked in
- [ ] First check-in

## Home — `/`

Corrections:

-

## Home checked in

Corrections:

-

## First check-in — `/first-checkin`

Corrections:

-

## Known deliberate choices (not bugs)

- The header is the Silkscreen `Savborne` wordmark; the handoff's logo glyph is not in `assets/glyphs.json`.
- The display name lives in the character card; the header carries bracket and level chips.
- Home shows 2dp for the balance (`12.40`), matching the handoff; Vault and receipts keep full precision.
- Shields and check-in count are not on Home; the support line pushed the Battle card below the fold. Check-ins remain on Profile.
- The Battle CTA is coral, not the handoff's dark button, following the primary-CTA rule.
- The First check-in wins over Bracket Climb; the rest of that check-in's awards appear on Home afterwards.
- The delta chip only appears immediately after a check-in; a reload shows the streak chip instead.
- The real-device pass in Nimiq Pay is still yours; `.env.local` is not configured in this sandbox.

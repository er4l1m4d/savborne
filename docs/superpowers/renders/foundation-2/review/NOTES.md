# Foundation 2 — review notes

**How to use:** open `index.html` in a browser (it loads the images next to it).
Write corrections under the screen they belong to. A correction is easiest to act
on when it names the width and the element, e.g. “390 — Home: the XP bar sits too
close to the level chip”.

## Sign-off

- [ ] Home
- [ ] Missions
- [ ] Battle menu
- [ ] Ranks
- [ ] Profile
- [ ] Vault
- [ ] Receipts
- [ ] Setup
- [ ] Setup vault
- [ ] Battle detail
- [ ] Card

## Home — `/`

_Widths:_ 360 / 390 / 430

Corrections:

-

## Missions — `/missions`

Corrections:

-

## Battle menu — `/battle`

Corrections:

-

## Ranks — `/leaderboard`

Corrections:

-

## Profile — `/profile`

Corrections:

-

## Vault — `/vault`

Corrections:

-

## Receipts — `/receipts`

Corrections:

-

## Setup — `/setup`

Corrections:

-

## Setup vault — `/setup/vault`

Corrections:

-

## Battle detail — `/battle/[id]`

Corrections:

-

## Card — `/card/[token]`

Corrections:

-

## Cross-screen

Corrections that apply everywhere (type, spacing, colour, motion, focus):

-

## Known deliberate choices (not bugs)

- 10px type is used only for battle state labels (`.sv-state`); everything else is 12px or larger.
- Receipts wraps its snapshot metadata row at 360px instead of truncating.
- Setup shows five dots and one active step label at 360px, not five labels.
- Stepped panels (3px corners + 4px hard shadow) are intentional; square `.vpx` is no longer used for new panels.
- The real-device pass in Nimiq Pay is still yours to do; these are headless renders.

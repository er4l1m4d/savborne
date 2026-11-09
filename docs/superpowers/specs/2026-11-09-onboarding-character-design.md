# Onboarding character picker - design

**Date:** 2026-11-09
**Branch:** `onboarding-ui-redesign`
**Extends:** the Onboarding batch and the focus pass.

## 1. Goal

Let the player choose the Hero or Heroine art during onboarding, keep the flow
at five steps, show the choice on their own sprites, and let them change it
later in Settings.

## 2. Decisions

| Decision | Choice |
|---|---|
| Placement | Inside the Name step, under the preview |
| Wording | "Character"; options Hero and Heroine |
| Default | Hero selected; the player can switch |
| Data field | `players.avatar` (`hero` or `heroine`), default `hero` |
| Persistence | Player row; returned by the profile and battle APIs |
| Change later | Settings > Account > Character, PATCH `/api/players/me` |
| Visible on | Home, Profile, Name preview, and the player's own art in queue, friend, arena and result |
| Opponents | Keep the current default art; no opponent avatar in this pass |
| Privacy | The collect card names the chosen character as game data |
| Steps | Five; Name stays step 5 of 5 |

## 3. Data and API

`supabase/FINAL-SCHEMA.sql` only:

- Add `avatar text not null default 'hero' check (avatar in ('hero','heroine'))`
  inline and via `alter table ... add column if not exists`, plus an idempotent
  check constraint for old databases.
- Drop the 6- and 7-argument `create_player_with_vault` and create the
  8-argument version with `p_avatar text`; insert
  `avatar = coalesce(p_avatar, 'hero')`; update the grants.

API:

- `POST /api/players` accepts optional `avatar`; invalid values are 400.
- `GET /api/players/me` and `GET /api/profile` return `avatar`.
- `PATCH /api/players/me` accepts `{ avatar }`, validates it, updates the row
  and returns `{ avatar }`; 401 without the player header, 404 without a row.
- `GET /api/battles/[id]` adds `viewer.avatar`; opponents are unchanged.

Types:

```ts
export const AVATARS = ['hero', 'heroine'] as const
export type Avatar = (typeof AVATARS)[number]
export const DEFAULT_AVATAR: Avatar = 'hero'
export function isAvatar(value: unknown): value is Avatar
```

## 4. UI

`CharacterArt` gains `character?: Avatar` (default `hero`) and maps both keys
for all four brackets.

`CharacterPicker`:

- Two 56px buttons in a 2-column grid, `aria-pressed`, mint border and label on
  the selected one.
- Each shows the 32px character art for the current bracket and the label Hero
  or Heroine. The 56px card leaves 12px above and below the art.
- Used in the Name step and Settings.

Name step, under the 128px preview:

```
Character
[ Hero ] [ Heroine ]
Display name
[ input ]
Up to 16 characters.   0/16
```

The preview updates immediately. The name validation and CTA are unchanged.

Settings, Account section: a Character row with the same picker. A successful
PATCH updates the local selection; Profile and Home fetch the new value on their
next mount. A failed PATCH shows a local banner and keeps the previous choice.

Player sprites to update: Home, Profile, Name, queue me-card, friend challenge
me-card, arena me sprite, result me sprite. Opponent sprites keep the default.

## 5. Tests and renders

- `avatar.test.ts`: valid values, default, invalid.
- `character.test.ts`: CharacterArt maps both; Name preview and picker; Home,
  Profile, queue, arena, result player art; Settings picker and PATCH.
- `privacy-consent.test.ts`: 8-argument RPC, avatar column, `p_avatar`.
- `onboarding.test.ts`: Name stays step 5 and sends `avatar`.
- Renders: Name default Hero, Name with Heroine selected, Settings Account with
  the Character control; all other states re-audited at 360/390/430.
- Audit: no overflow, 44px targets, min font 12, mint focus.

## 6. Rulings

- The UI says "Character", not "Gender": it is an art choice, and the profile
  does not store a gender identity.
- The picker lives in the Name step so the five-step count does not change.
- Default Hero keeps the flow to one required field; switching is one tap.
- The choice is changeable because it is appearance, not identity; the name
  remains fixed.
- Opponent avatars are out of scope; their art stays the current default.

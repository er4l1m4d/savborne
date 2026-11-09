# Onboarding character picker - plan

**Spec:** `docs/superpowers/specs/2026-11-09-onboarding-character-design.md`

## Global constraints

- Same branch; additive API and `FINAL-SCHEMA.sql` only.
- Foundation 2 primitives only; the picker uses `Button` and `CharacterArt`.
- 12px floor, 44px targets, 360px no truncation.
- Five onboarding steps; Name stays 5 of 5.
- After every task: `npm test`, `npx tsc --noEmit`, `npm run lint`,
  `npm run build`.

---

## Task 1: Avatar data, API and types

**Files:**
- Create: `src/lib/avatar.ts`
- Modify: `supabase/FINAL-SCHEMA.sql`
- Modify: `src/lib/database.types.ts`
- Modify: `src/app/api/players/route.ts`
- Modify: `src/app/api/players/me/route.ts`
- Modify: `src/app/api/profile/route.ts`
- Modify: `src/app/api/battles/[id]/route.ts`
- Test: `src/lib/avatar.test.ts`, `src/lib/privacy-consent.test.ts`

- [ ] Add `avatar` column inline + ALTER + idempotent check.
- [ ] Drop 6- and 7-argument RPCs; create the 8-argument version with
  `p_avatar`; grant 8 args.
- [ ] `POST /api/players` accepts and validates `avatar`.
- [ ] `GET /api/players/me` and `/api/profile` return it.
- [ ] `PATCH /api/players/me` updates it.
- [ ] Battle GET adds `viewer.avatar`.
- [ ] Tests, checks, commit.

---

## Task 2: Character art, picker and Name step

**Files:**
- Modify: `src/components/CharacterArt.tsx`
- Create: `src/components/CharacterPicker.tsx`
- Modify: `src/components/onboarding/OnboardingProvider.tsx`
- Modify: `src/app/(onboarding)/name/page.tsx`
- Test: `src/lib/character.test.ts`, `src/lib/onboarding.test.ts`

- [ ] `CharacterArt` maps Hero and Heroine for every bracket; default Hero.
- [ ] `CharacterPicker` with `aria-pressed`, 56px buttons, 48px art, selected
  mint border.
- [ ] Provider draft `avatar` + `setAvatar`; `finish` sends it.
- [ ] Name preview uses the avatar; picker under the preview; step stays 5.
- [ ] Tests, checks, Name renders, commit.

---

## Task 3: Player sprites and Settings control

**Files:**
- Modify: `src/lib/usePlayerSession.ts`
- Modify: `src/app/(tabs)/page.tsx`
- Modify: `src/app/(tabs)/profile/page.tsx`
- Modify: `src/app/battle/queue/page.tsx`
- Modify: `src/app/battle/[id]/page.tsx`
- Modify: `src/app/battle/[id]/result/page.tsx`
- Modify: `src/app/battle/friend/[id]/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Test: `src/lib/character.test.ts`, `src/lib/settings.test.ts`

- [ ] PlayerMe/ProfileData/Queue/battle viewer types gain `avatar`.
- [ ] Home, Profile, queue, friend, arena and result pass it to the player's
  own art; opponents stay default.
- [ ] Settings Account gets a Character row and PATCH; local error banner.
- [ ] Tests, checks, Settings render, commit.

---

## Task 4: Sweep, review and audit

- [ ] Full sweep: existing 18 states + Name Heroine + Settings character.
- [ ] Audit every state at 360/390/430.
- [ ] Update the review page, NOTES and the audit section.
- [ ] Final four checks; commit.

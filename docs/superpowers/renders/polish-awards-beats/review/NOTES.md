# polish-awards-beats review notes

Open `index.html` in a browser. Write corrections under the screen they
belong to, naming the width and the element where possible.

Fixture data throughout: player Kemi, 12.40 NIM, silver bracket, rival Mint
Wraith. Every `/api` call was intercepted in a headless browser; no production
system was touched and no `.env.local` was needed for these renders.

## Sign-off

- [ ] Home - check-in awards art (before/after)
- [ ] Home - final-hours streak cue (new)
- [ ] Withdrawal - removed-badge art (before/after)
- [ ] Battle - item sheet "No battle effect" rows (before/after)
- [ ] Battle - defend/item-use glow rim (new)
- [ ] Home - default unchanged (before/after)

## Corrections

-

## Deliberate choices

- **Awards rows.** Each badge renders `BadgeArt` at 32px in its true state
  (earned mint, removed coral) with the name and the state word beside it.
  Item tiles reuse the `/first-checkin` treatment (sprite well, 2px line
  border, 32px art). The raw `uppercase tracking-widest` labels became
  `.sv-section-label`, the role class every other screen already uses. The
  "+XP earned" number list above them is unchanged.
- **Streak cue window.** `STREAK_RISK_WINDOW_MS` is six hours. The cue is a
  single coral sentence above the check-in button ("3h 30m left to check in
  and keep your streak"), no period, and it ticks every 30 seconds. Shield
  holders still see it: a missed day is bridged by spending a shield, so the
  day is only safe once it is claimed. Checked-in players and streak-less
  players never see it.
- **Withdrawal.** The removed panel lists each revoked badge with its
  removed-state art; the Steady Saver reset sentence moved under the rows so
  the names no longer have to share a sentence with it.
- **Item sheet.** "No battle effect" is derived from `modsForItems`, not a
  hand-kept list, so the sheet and the engine cannot disagree. Passive rows
  are disabled with the default border and their blurb (what the item DOES
  outside battle) is untouched. They still appear under available items, not
  hidden: they are owned gear.
- **Glow rim.** `assets/character-glows.json` was already shipped but had zero
  consumers. The rim renders over the sprite on the same 16x16 grid and fades
  in three quantised steps over the new `--t-glow: 240ms` token. The beat
  fires only on a turn transition observed between two polls; the first poll
  after load only records, so a reload never replays an old beat. Under
  `prefers-reduced-motion` the beat is skipped entirely. A timeout
  auto-defend still reads as an ordinary defend - that distinction needs the
  `move_source` API flag and is unchanged scope.
- **Iron Saver.** Description now matches the code: any four-week streak
  earns it, no date gate. `supabase/FINAL-SCHEMA.sql` re-paste updates the
  production row (its seed is `on conflict do update`).

## What is NOT in this branch

The growth/analytics work that shares the working tree (analytics route,
growth checklist, health `analyticsTable` check, schema version
`2026-11-26.1`) belongs to the parallel `growth-analytics` branch and is
untouched here. `docs/growth-checklist.md`, `README.md` and the analytics
schema hunks in `FINAL-SCHEMA.sql` visible in the shared working tree are
that session's uncommitted work, not part of these commits.

## Verification

| Check | Result |
|---|---|
| `npm test` (branch worktree) | 590 pass, 0 fail |
| `npx tsc --noEmit` | clean |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0, all routes compiled |
| Gate context | every check ran in a worktree of this branch only |

Render harness: system Chromium via `playwright-core`, production build of
this branch served with all `/api` routes mocked. 18 after PNGs and 12 before
PNGs at 360/390/430.

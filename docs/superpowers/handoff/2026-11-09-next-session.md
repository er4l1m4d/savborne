# Next session handoff - Battle UI redesign

**Date:** 2026-11-09
**Repo:** `/data/home/work/savborne`
**Branch to start from:** `main` at `aab4a42`
**Status:** Foundation 2, Economy and Home are signed off and merged. Battle is the next UI batch. The check-in integrity release gate is outstanding.

## 1. Current repo state

- `main` is pushed to `origin/main` at `aab4a42`.
- Working tree is clean.
- `npm test`: 236 pass, 0 fail.
- `npx tsc --noEmit`: clean.
- `npm run lint`: 49 warnings, 0 errors.
- `npm run build`: exit 0.
- `home-ui-redesign` is merged and deleted. No active stacks.
- `.env.local` is missing in this sandbox; the real Supabase backend and the Nimiq Pay live test are blocked. The suite, typecheck, build and fixture renders do not need it.
- The dev server is stopped. OpenChamber is on port 3000.

### What is already done

- **Foundation 2:** handoff type scale with a 12px floor, stepped `.pxw`/`.px` panels, coral primary/destructive buttons, 2px mint focus, nine primitives.
- **Economy:** `/settings`, `/settings/delete`, Items, Bracket Climb, Balance dropped, Profile character/XP restructure.
- **Home:** wordmark header, character card, savings card with check-in and checked-in state, missions, Battle card, `/first-checkin`.
- **Backlog:** `docs/superpowers/backlog/2026-11-09-check-in-integrity.md`.

## 2. Immediate priority before ranked exposure

Do **not** expose ranked battles to players until the release gate in the backlog is fixed:

- `check_in_count` currently increments on every POST, even on the same UTC day.
- Ranked requires 5 check-ins, so a script can unlock it in a minute.
- The `check_ins` table has no unique `(player_address, utc_date)`.
- The check-in route is not atomic and has no idempotency key.
- Check-in has no wallet signature or rate limit.

Minimum release gate: unique UTC day, count distinct days, one transaction for record + rewards, rate limit. The full plan is in the backlog document.

The Battle UI can be built in parallel, but ranked must not ship before that gate.

## 3. Battle batch scope

Handoff figures in `Savborne-handoff.html`:

- `A_BattleMenu` - three mode cards; battles left and reset time
- `A_RankedLocked` - Level 1 of 3, check-ins 2 of 5 progress bars
- `A_Queue` - timer, widening rating range, VS cards, cancel
- `A_QueueTimeout` - Battle the AI / Challenge a friend / Leave queue
- `A_FriendWait` - challenge pending, expiry countdown, share/cancel
- `A_Battle` - 5-turn arena, HP bars, 2x2 move grid, Use item
- `A_ItemSheet` - bottom sheet of items, used/locked states
- `A_InBattleWait` - waiting for opponent, timer
- `A_Win`, `A_Loss`, `A_Tie` - result screens
- `A_ConnLost` - connection-lost overlay
- `A_DailyLimit` - 0 battles left, reset countdown, Missions CTA

### Current state

- `/battle` is one menu page with inline AI, friend challenge, ranked queue and daily-limit footnote.
- `/battle/[id]` is one duel page with inline item picker, waiting text and a simple completed panel.
- Existing APIs: `/api/battles/ai`, `/api/battles/friend`, `/api/battles/[id]` (GET/join/move), `/api/queue/join`, `/api/queue/leave`, `/api/queue/poll`.
- No result route, no ranked-locked screen, no queue-timeout screen, no connection-lost overlay, no item sheet, no battle sprites.

### Expected work

- A Battle spec and plan first, then implementation.
- Restructure `/battle` around Ranked / Friend / AI cards.
- Add Ranked Locked, Queue, Queue Timeout and Daily Limit states.
- Add Friend Challenge Sent state.
- Add the battle arena, item `BottomSheet`, in-battle wait, result screens and connection-lost overlay.
- Use `ResultPanel` and `BottomSheet`, which exist but have few consumers.
- Render rival sprites from `assets/characters.json` (`Rival · Mint Wraith`, etc.); extend or reuse the art components.
- Keep every existing API contract; no schema change.
- 360/390/430 renders, keyboard/touch audit, type floor, 44px targets.

## 4. Process for the new session

1. Read this file, the audit sections 3.5 and 12, and the check-in backlog.
2. Read the battle figures in `Savborne-handoff.html`.
3. Read `src/app/(tabs)/battle/page.tsx`, `src/app/battle/[id]/page.tsx`, `src/lib/game/battle.ts`, `src/lib/game/battleServer.ts`, the queue/battle API routes and the Foundation 2 primitives.
4. Create the branch:

   ```bash
   git switch main
   git switch -c battle-ui-redesign
   ```

5. Write the Battle spec and implementation plan. Do not implement before the user approves them.
6. Execute task by task with TDD. Run `npm test`, `tsc`, lint and build after each task.
7. Capture before/after renders with fixture data and run the audit at 360/390/430.
8. Commit granularly; do not merge until the user signs off.
9. Before ranked is exposed, land the check-in release gate from the backlog.

## 5. Environment and live preview

- Do not commit `.env.local`, `AGENTS.md`, the InstaBox docs/scripts or machine tooling. They are ignored.
- Glow assets/scripts are intentionally tracked.
- To run the dev server without Supabase, the UI renders with fixtures; API routes will 500 until `.env.local` exists:

  ```bash
  npm run dev -- -p 3001 -H 0.0.0.0
  ```

- For a public tunnel, set `ALLOWED_DEV_ORIGINS=*.instabox.tech` in `.env.local` or the shell, then use `instabox-port publish 3001 --private`.
- A private static review page can be served with:

  ```bash
  instabox-port serve docs/superpowers/renders/<batch>/review --port 4174 --private
  ```

- Unpublish ports when finished.

## 6. Known decisions and deferred items

- Home balance is 2dp; Vault keeps full precision.
- Home no longer shows shields/check-ins; check-ins remain on Profile.
- First check-in wins over Bracket Climb.
- Battle CTA on Home is coral.
- Delta chip is a post-check-in transient.
- Deferred: check-in integrity release gate, 2dp withdrawal precision, Items always backing to Profile, Golden Crown badge revoke/re-award behavior.

## 7. Copy-paste prompt for the next session

```text
You are continuing the Savborne UI redesign in /data/home/work/savborne.

Start by reading:
- docs/superpowers/handoff/2026-11-09-next-session.md
- docs/superpowers/audits/2026-11-05-ui-gap-audit.md sections 3.5 and 12
- docs/superpowers/backlog/2026-11-09-check-in-integrity.md
- Savborne-handoff.html figures A_BattleMenu, A_RankedLocked, A_Queue,
  A_QueueTimeout, A_FriendWait, A_Battle, A_ItemSheet, A_InBattleWait,
  A_Win, A_Loss, A_Tie, A_ConnLost, A_DailyLimit, A_ItemSheet
- src/app/(tabs)/battle/page.tsx, src/app/battle/[id]/page.tsx,
  src/lib/game/battle.ts, src/lib/game/battleServer.ts, the queue and battle API routes,
  and the Foundation 2 primitives in src/components/ui/

Current state: main is pushed at aab4a42, clean, 236 tests pass, tsc clean,
lint 49 warnings, build green. .env.local is missing, so the live Supabase/Nimiq
Pay test is blocked; use tests and fixture renders. The dev server is stopped.

Your task is the Battle UI batch. Do not implement before writing a spec and
plan and getting the user's approval. Create the branch from main:

  git switch main
  git switch -c battle-ui-redesign

Scope: restructure /battle around Ranked, Friend and AI; add Ranked Locked,
Queue, Queue Timeout, Friend Challenge Sent, Daily Limit, the arena, item
BottomSheet, in-battle wait, Win/Loss/Tie result screens and Connection Lost.
Use only Foundation 2 primitives and the handoff's type scale, panels, coral
primary CTAs and 44px targets. Keep existing API contracts; no schema changes.

Before ranked is exposed, land the check-in release gate in the backlog:
unique UTC day, distinct-day check-in count, atomic transaction, rate limit.
Do not redo Home or Economy. Do not commit .env.local, AGENTS.md or InstaBox
tooling. Run tests, tsc, lint, build and 360/390/430 fixture renders per task.

Begin by reading the references and proposing the Battle spec and plan.
```

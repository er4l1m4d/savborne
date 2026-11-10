# Demo video session handoff

**Date:** 2026-11-10
**Repo:** `/data/home/work/savborne`
**Branch:** `main` (README and submission copy committed)
**Deadline:** Cycle III closes Wednesday 11 November, 15:00/16:00 UTC.

## 0. Hard blocker - fix before recording

The production Supabase database is behind the repo. The live app already
ships the signed check-in code, but the release-gate RPC is missing, so every
real check-in returns 500:

```text
POST /api/check-ins ->
500 {"error":"Could not find the function public.consume_rate_limit(p_key, p_limit, p_window_seconds) in the schema cache"}
```

**Do this first:** paste `supabase/FINAL-SCHEMA.sql` into the live Supabase
Dashboard SQL Editor and run it. The file is idempotent.

Smoke-test before you open the camera:

1. A signed check-in returns 200 and awards XP.
2. Five check-ins in one UTC day leave `check_in_count` at 1.
3. A fresh onboarding creates a player and a vault.
4. `select exists(select 1 from pg_proc where proname = 'commit_check_in')`
   returns true.

Do not record the check-in beat until this passes. A 500 in the video is worse
than no check-in shot at all.

## 1. What the video has to prove

The Community Council scores functionality/reliability (45), Nimiq
integration (25), real usage (15), design/UX (10), and promotion (5). The video
is the fastest way to show the first two:

- real NIM in a vault the player controls;
- a deposit signed by Nimiq Pay;
- a check-in signed by the wallet and read from chain;
- the game layer reacting to that real balance;
- a withdrawal signed by the phrase.

Target length: 2:30 to 3:00. Vertical 1080x1920.

## 2. Preconditions

- **Device pass.** Every row in `docs/HANDOFF-PROMPT.md` section "Vault build -
  device pass pending" is still pending: `sendBasicTransaction` return shape,
  `listAccounts()` approval, `getHostNetwork()`, `sendRawTransaction` CORS,
  haptics. Run it before recording so the video does not surface a surprise.
- **Network.** Testnet is preferred. If the Nimiq Pay build only exposes
  mainnet, keep the deposit small (1-2 NIM), never fake a balance, and do not
  show a large vault you do not have.
- **Testnet funds.** Faucet: `https://faucet.pos.nimiq-testnet.com/tapit`.
  Deposit about 12 NIM to cross the Silver threshold (Entry 1, Bronze 3,
  Silver 10, Gold 25 NIM) and unlock six items. That makes the first check-in
  panel much stronger than the 1 NIM Entry state.
- **Dedicated demo account.** Use one clean player/display name. Check-ins are
  one per UTC day, so a multi-day streak cannot be shown honestly on a fresh
  account. Do not seed fake days into the database.
- **Phone hygiene.** Do Not Disturb, notifications off, rotation lock, 100%
  battery, no personal notifications or addresses on screen.

## 3. Storyboard

| Time | Shot | Action | Caption |
|---|---|---|---|
| 0:00 | Title card | Savborne wordmark, tagline | Save for real. Level up for fun. |
| 0:08 | Nimiq Pay | Open the Mini App from inside Nimiq Pay | Built for Nimiq Pay |
| 0:14 | Welcome | Tap Get started | A savings RPG for your NIM |
| 0:18 | Onboarding | Pick character, name, privacy consent (speed up 2x) | Your character, your vault |
| 0:38 | Vault setup | Show the phrase screen for 2s, then cut. **Never show the full phrase** | 24 words, generated on your device |
| 0:48 | Home | Empty/new state, open Vault | Your NIM stays in a vault only you control |
| 0:54 | Vault | Deposit 12 NIM, Nimiq Pay signature sheet, confirmed | Deposits are signed by your wallet |
| 1:10 | Vault | Balance updates, recent movements list | Savborne can read it, never move it |
| 1:20 | Home | Tap Check in now, wallet signs, award panel, first-check-in screen | A real on-chain reading, not a self-report |
| 1:45 | Missions | Show Daily/Weekly progress from the check-in | Consistency earns XP |
| 1:55 | Ranks | Ranked locked (1 of 5 check-ins), leaderboard | Ranked unlocks after five days |
| 2:05 | Battle | AI opponent, arena, one attack and one item, result | Five-turn battles |
| 2:35 | Vault | Withdraw 1 NIM, sign with the phrase, receipt with explorer link | Withdrawals are signed by you |
| 2:50 | End card | Live URL, GitHub, MIT | savborne.vercel.app |

If a shot fails, cut it. A tight 2:20 beats a 4:00 video with dead ends.

## 4. Capture

- Use the Android built-in screen recorder at 1080p, or `scrcpy` if a phone is
  attached. Neither `scrcpy` nor `adb` is installed on this sandbox; install
  with `sudo apt-get install -y scrcpy adb` only if a device is connected.
- Record each segment separately: 3 seconds of stillness at the start and end,
  then do the action once.
- Keep raw clips in `/data/workspace/demo/raw/` (outside the repo).
- Show the Nimiq Pay chrome for at least 2 seconds so the context is obvious.
- Do not speed up the signature prompts; those are the integration proof.

## 5. Edit

- `ffmpeg` is not installed. Install it:
  `sudo apt-get update && sudo apt-get install -y ffmpeg`
- Assemble the segments, trim dead time, speed up only the onboarding form
  section, and add captions.
- Title and end cards: render an HTML page with the repo fonts and palette
  (`src/app/globals.css`, `src/app/fonts/`) and screenshot it, or use the
  existing renders in `docs/screenshots/` as a base.
- Music: royalty-free, quiet, under the captions. No dialogue if there is no
  voiceover, but add a voiceover if you can - it lifts the "story" score.
- Export: H.264 MP4, 1080x1920, 30fps, AAC, under 200 MB.

## 6. Publish

- Upload to YouTube as unlisted or public. Put the link in
  `docs/submission-cycle3.md` and in the submission form.
- Cut a 30-45 second vertical clip for X. Post it from your existing account
  with `@miniappscomp`, the live link, and `#Nimiq`.
- Cross-post the same clip to the Skool community.
- Do not create a new X account. Link your GitHub and X from each profile.

## 7. Copy-paste prompt for the new session

```text
You are continuing Savborne in /data/home/work/savborne. The README and Cycle
III submission copy are committed. Your task is the 2-3 minute demo
video for the Nimiq Mini Apps Competition, Cycle III (Save track). Deadline is
11 November 2026, 15:00/16:00 UTC.

Start by reading:
- docs/superpowers/handoff/2026-11-10-demo-video.md
- docs/submission-cycle3.md
- docs/HANDOFF-PROMPT.md (the device-pass table)
- docs/superpowers/backlog/2026-11-09-check-in-integrity.md

Critical context: the production Supabase schema is behind the repo, so
POST /api/check-ins returns 500 "Could not find the function
public.consume_rate_limit". The user must paste supabase/FINAL-SCHEMA.sql into
the live Supabase SQL editor before any check-in is recorded. Verify the fix
before building the storyboard around it.

The live app is https://savborne.vercel.app and the deeplink is
nimiqpay://miniapp?url=https://savborne.vercel.app. The user records the phone
screen; you prepare the shot list, capture checklist, title/end cards, captions,
and the edit (ffmpeg). Keep every claim honest: no fake balances, no seeded
check-in days, and never show the 24-word phrase.

Deliver: the final MP4, a 30-45s social cut, the YouTube link added to
docs/submission-cycle3.md, and a posting plan for X and Skool.
```

## 8. Facts

- Live: https://savborne.vercel.app
- Deeplink: `nimiqpay://miniapp?url=https://savborne.vercel.app`
- Repo: https://github.com/er4l1m4d/savborne (public, MIT)
- Tests: 472 pass, `tsc` clean, build green, lint 0 errors
- Brackets: Entry 1 NIM, Bronze 3, Silver 10, Gold 25
- Battles per day: 3; ranked needs 5 distinct check-in days
- No `.env.local` in this sandbox; the live deployment has its environment

# Savborne: Version One Specification

Handover document for building Savborne, a savings RPG for Nimiq Pay, entered in the Nimiq Mini Apps Competition, Cycle III.

**Status:** Design complete. Build not started. Gated by the `getBalance` spike (Section 13).
**Owner:** Oluwadamilare (GitHub: er4l1m4d)
**Last updated:** 15 October 2026

---

## 1. Summary

Savborne is a savings RPG that runs inside Nimiq Pay as a Mini App. Players connect one dedicated flexible NIM savings account, and their saving progress earns XP, items, missions, badges, and status. Players battle other characters using chosen moves, against other players through a ranked queue, or against an AI opponent.

**Core principle:** Savborne never holds, moves, or controls user money. It only reads the balance of the savings account the player chooses.

**Core loop:** Connect savings account → check in → earn XP and streaks → unlock items by bracket → battle → climb the leaderboard.

---

## 2. Competition context

### 2.1 Cycle III

| Item | Detail |
|---|---|
| Competition | Nimiq Mini Apps Competition, Cycle III |
| Cycle dates | 14 October 2026 to 11 November 2026 (4 weeks) |
| Theme | Pay, Save, Earn, On/Off-Ramp |
| Savborne's track | **Save** (individual savings with a game layer; not group savings jars) |
| Prize per track | $4,000 USDC for the best Mini App in each track |
| Community Council Prize | $1,000 USDC, open to all submissions including off-theme |
| Prize pool total | $17,000 USDC |
| Payout | Three equal monthly installments, each conditional on maintenance milestones |
| Submission deadline | **Not yet published.** Check official channels (see 2.4) |
| Public early access | Submissions go public at the start of Week 3 for early testing |

### 2.2 Official links

| Resource | Link |
|---|---|
| Competition home | https://miniappscompetition.com/ |
| Cycle III page | https://miniappscompetition.com/cycle3 |
| Cycles | https://miniappscompetition.com/cycles |
| Rules | https://miniappscompetition.com/rules |
| Examples | https://miniappscompetition.com/examples |
| Scoring | https://miniappscompetition.com/scoring |
| Payout | https://miniappscompetition.com/payout |
| Submissions (Cycle II examples) | https://miniappscompetition.com/submissions/cycle2 |
| FAQ | https://miniappscompetition.com/faq |
| Registration | Via the homepage: https://miniappscompetition.com/ |
| Skool community | https://www.skool.com/miniappscompetition |
| Skool "Validate Your Idea" channel | Inside the Skool community above |
| Skool Cycle 2 scoring post | https://www.skool.com/miniappscompetition/cycle-2-scoring-everything-you-need-to-know |
| Competition X account | https://x.com/miniappscomp |
| Nimiq X account | https://x.com/nimiq |
| Competition X post (user-supplied) | https://x.com/nimiq/status/2110400145028170212 |
| Competition Instagram | https://instagram.com/miniappscompetition |
| Competition TikTok | https://tiktok.com/@miniappscompetition |
| Competition YouTube | https://youtube.com/@miniappcompetition |
| Imprint | https://miniappscompetition.com/imprint |
| Competition privacy | https://miniappscompetition.com/privacy |

### 2.3 Entry requirements (from the Rules page)

- Entrants must be **18 or older**.
- Individuals or **teams of up to 5**. One designated representative per team. One submission per team per cycle. Prizes are per team.
- Open worldwide, except OFAC-sanctioned jurisdictions.
- Must have a **public GitHub repo** linked to the submission.
- Must have or create a **Nimiq wallet** to receive prize payouts.
- **Previous non-winning apps can re-enter** with significant improvements. Winning apps cannot be resubmitted.
- Winners must provide proof of citizenship of an eligible country.

### 2.4 Submission requirements (from the Rules page)

- Built on the **Nimiq Pay Mini Apps Framework**.
- All code **open-source** in a public GitHub repo under the **MIT License**.
- Follows the Framework documentation and technical standards.
- **No hardcoded private keys, API secrets, or credentials** in the repo.
- Must integrate with Nimiq Pay and support **USDT, NIM, or both**. Apps supporting NIM score under Nimiq Pay and Nimiq integration. Apps supporting neither are **disqualified**. A Nimiq logo alone does not count.
- Code must be original, or properly attributed when using open-source libraries.
- Must be **fully functional and usable on the first try**. No prototypes or mockups.
- Written description: **maximum 250 words**. Covers what it does, who it's for, and how it uses Nimiq Pay.
- Demo video or walkthrough: optional but encouraged.
- Select a Cycle III category at submission: Pay, Save, Earn, On/Off-Ramp, or Off-theme.
- Submissions are made through the **submission portal on the Registration Dashboard**. Details and deadlines will be communicated through official Nimiq social media channels.
- Submissions go public at the start of Week 3 for early access testing.

### 2.5 Prize and ownership terms

- Prizes paid in **USDC** to the Nimiq wallet address given at submission.
- Prizes are per team. Internal splits are the team's responsibility.
- Builders are responsible for their own tax obligations.
- Winners announced through official Nimiq and competition channels.
- Builders **retain ownership** of their app and IP but release code under **MIT**.

### 2.6 Off-limits (from the Rules page)

- Collecting, storing, or transmitting user data without clear disclosure, lawful basis, and informed consent
- Violating the Nimiq Pay Mini Apps Framework terms of service
- Pornographic, sexually explicit, or exploitative content
- Deceptive, scammy, or fraudulent functionality. No phishing, false claims, or misleading UX
- Content promoting violence, hate speech, harassment, or discrimination
- Malware, spyware, or hidden malicious functionality
- Functionality that enables illegal activity
- Impersonating other brands, products, or individuals
- **Gambling, betting, or games of chance** where outcomes are primarily determined by randomness. Skill-based games with clear rules and prizes are permitted.
- Third-party code, content, trademarks, or assets used without rights or attribution
- Copying or submitting substantially similar work to existing projects. Forks allowed only if significantly modified and license-compliant

### 2.7 Scoring (100 points, judged by Nimiq Community Council)

| Category | Points | Sub-criteria |
|---|---|---|
| Functionality, reliability, usefulness | 45 | Core feature, error handling, speed, stability, completeness, real need, target audience, originality, repeat value |
| Nimiq Pay and Nimiq integration | 25 | How well it works inside Nimiq Pay on mobile; whether it uses NIM or the wider Nimiq ecosystem beyond simply accepting a payment |
| Real usage | 15 | Usage during the measurement period. Cycle II counted unique Nimiq wallets opening the app. **Cycle III method not confirmed.** |
| Design and UX | 10 | Design quality and user experience |
| Builder promotion checklist | 5 | Promotion activity (see Section 12) |

Performance is rated per element on a 0 to 5 scale: Outstanding (5), Strong (4), Competent (3), Developing (2), Insufficient (1), Not demonstrated (0).

Scoring guidance from the Cycle II Skool post (to verify for Cycle III):
- A first-time user should understand and reach the app's main point within 60 seconds, without instructions.
- The Community Council evaluates the live app as a real user experiences it, not the code.
- The live app may be evaluated at any time, at random, after the deadline.

### 2.8 Payout milestones (from the Payout page)

Paid in **three equal installments over three months**. Each is conditional.

| Installment | Timing | Conditions |
|---|---|---|
| Month 1 | On winner announcement | Mini App is live and functional; builder has accepted prize terms |
| Month 2 | 30 days later | Still live and continuously accessible; critical user-reported bugs addressed; builder has responded to community feedback |
| Month 3 | 60 days later | Still live and continuously accessible; at least one meaningful update (feature, UX improvement, or performance fix); short written status summary |

A missed milestone forfeits that month's installment. Previous payouts are not clawed back.

After the 3-month period, builders can apply to the **Nimiq Community Funding Board** for continuation funding.

### 2.9 Sip & Ship sessions (Cycle III)

Weekly live sessions, 11:00 AM ET (15:00 UTC; 16:00 UTC on 4 November):
- 14 October (passed)
- 21 October
- 28 October
- 4 November

---

## 3. Nimiq technical reference

Source: https://nimiq.dev/mini-apps and https://nimiq.dev/mini-apps/api-reference/nimiq-provider

### 3.1 Architecture

- Mini Apps are **web applications** that run in a WebView inside Nimiq Pay.
- Nimiq Pay injects providers: `window.nimiq` (Nimiq) and `window.ethereum` (EVM).
- Savborne is therefore a **web app**, not a native Android app.
- Hosting is on the app's own infrastructure. Nimiq Pay supplies the wallet, payment rails, and audience.

### 3.2 SDK

- Package: `@nimiq/mini-app-sdk`
- Initialise with `init()`, which waits until Nimiq Pay injects the provider.
- Savborne needs **SDK 0.2.1 or later** for `getBalance`, and a Nimiq Pay version that exposes it.
- Use `NimiqProviderError.is(error)` to identify wallet errors. Handle types: `PERMISSION_DENIED`, `UNKNOWN_REQUEST`, `INVALID_TRANSACTION`, `NETWORK_ERROR`, `INTERNAL_ERROR`, `UNKNOWN_ERROR`.

### 3.3 Provider methods used by Savborne

| Method | Purpose in Savborne | User approval? |
|---|---|---|
| `init()` | Wait for provider | No |
| `listAccounts()` | Get the player's address for the savings account | **Yes**, first time only (cached after that) |
| `getBalance(address)` | Read the savings account balance (NIM, in Luna; 100,000 Luna = 1 NIM) | **No** |
| `isConsensusEstablished()` | Check network readiness | No |
| `getBlockNumber()` | Current block height | No |
| `sign(message)` | Optional: signed achievements (not in v1 unless time allows) | Yes |
| `disconnect()` | Clears cached accounts when the player disconnects the savings account | No |

Notes:
- `getBalance` reads any valid address. Savborne only reads the address the player registers.
- `getBalance` returns `0` for a successful zero balance. Failed lookups reject, and must not be recorded as zero.
- Contract balances (HTLC, vesting) are not necessarily spendable. Not relevant to v1.
- Savborne cannot read balances from a background job. `getBalance` runs inside Nimiq Pay, so snapshots happen only when the player opens the app.

### 3.4 Methods Savborne does not use in v1

- Send methods (`sendBasicTransaction`, staking, and similar). Savborne never moves money.
- `request()` for wallet methods. Not needed.
- `setRPCUrl()`. Not needed.

### 3.5 Other platform features

- **Localisation:** `window.nimiqPay.language` gives the player's language as an ISO 639-1 code. Use it instead of `navigator.language`.
- **Network:** `window.nimiqPay.network` gives `mainnet` or `testnet`. `getHostNetwork()` in the SDK wraps this (SDK 0.2.4 or later).
- **Device identifier:** A pseudonymous per-device ID is available via `requestDeviceIdentifier`. Optional for v1. Not a substitute for a player account.
- **Fullscreen:** `requestFullscreen()` available (SDK 0.2.3 or later). Optional for v1.
- **Sharing:** Deeplink formats `nimiqpay://miniapp?url=your-app.com` and `https://nimpay.app/miniapps/open/your-app.com`.
- **Tutorials on nimiq.dev:** Build Your First Mini App; Build a Dual-Chain Mini App; Build with AI.
- **Ideas list:** https://nimiq.dev/mini-apps/ideas (not reviewed in detail)
- **Developer Center repo:** https://github.com/nimiq/developer-center
- **FAQ:** https://nimiq.dev/mini-apps/faq

### 3.6 Protocol note: native time-locks

- The Nimiq protocol supports **vesting contracts** and **hashed time-locked contracts (HTLCs)**.
- The mini app provider has **no documented method to create** either.
- Conclusion: committed (locked) savings is **out of version one**.
- Reference: https://nimiq-network.github.io/developer-reference/chapters/accounts-and-contracts.html

---

## 4. Product decisions (locked)

### 4.1 Concept and identity

- **Name:** Savborne (no conflicting app found in search).
- **Name rejected:** Vaultborn, Vaultborne, and any name containing "vault." The word implies custody, which would be misleading for an app that never holds funds. Also rejected: Stash (implies storage), Questborne (existing Minecraft mod), Thriftborne, Pennyquest, Savehero (not selected).
- **Nimiq is not in the app name.** Use "built for Nimiq Pay" in descriptions. Avoids brand-impersonation risk.
- **Character:** The player's display name is their character name. No separate character name.
- **Character style:** Pixel-art fantasy. One class. Gentle level curve.
- **Scope:** Savings RPG with battles, missions, items, badges, leaderboards.

### 4.2 Savings tracking

- **Currency:** NIM only. USDT savings not in v1.
- **Account:** One **dedicated flexible savings account** per player. The player registers its address through a guided setup screen.
- **Custody:** Savborne never holds, moves, or locks funds.
- **Reads:** `getBalance` only. No approval dialog for reads.
- **Snapshots:** Recorded when the player opens the app (check-in). Balance, timestamp (UTC).
- **Withdrawals:** Allowed at any time. Withdrawal keeps XP and items, and removes the streak badge.
- **Committed savings:** Out of v1.

### 4.3 Entry and brackets

| Bracket | Threshold (NIM) | Items unlocked |
|---|---|---|
| Entry | 1 | Cloth Purse, Ledger Scroll |
| Bronze | 3 | Bronze Shield, Copper Compass |
| Silver | 10 | Silver Blade, Silver Charm |
| Gold | 25 | Gold Gauntlet, Golden Crown (status badge) |

- Entry minimum to join: **1 NIM**.
- Thresholds are fixed. Adjustable later without changing item design.
- History of changes: Gold was 200, then 100, then 25. Bronze was 10, then 3. Silver was 50, then 10. Each change was made by the owner.

### 4.4 Check-ins

- **Daily check-in:** Open the app and record the balance. Counts toward the Daily Check-in mission.
- **Weekly check-in:** Record at least one balance in the calendar week. Keeps the streak alive.
- **Grace day:** One missed day per calendar week is forgiven. Does not stack. Week resets Monday 00:00 UTC.
- **Streak badges:** One-week streak badge for everyone. Four-week streak badge (Iron Saver) for players who stay through 11 November.

### 4.5 Scoring of savings (leaderboards)

- **Amount score:** Balance growth between check-ins.
- **Consistency score:** Streaks, based on check-ins and on the balance not dropping between them.
- **Combined ranking:** Amount and consistency **weighted equally**, each scaled to the same range.
- **Open:** The exact scaling method and the range are not yet defined (see Section 14).

### 4.6 Withdrawals

- Withdrawals keep XP, items, and badges (except the streak badges).
- Withdrawals remove only the streak badge (Week Warrior and Iron Saver).

### 4.7 Time rules

- **All resets and deadlines run on UTC.**
- Daily reset: 00:00 UTC (1:00 AM Lagos time, UTC+1).
- Weekly reset: 00:00 UTC on Monday (1:00 AM Lagos time).
- Daily check-in, daily battle limit, and mission counts use the UTC date.
- All timestamps stored in UTC.

---

## 5. XP and levels

### 5.1 Sources of XP

| Action | XP | Notes |
|---|---|---|
| Daily Check-in mission | 10 | Repeatable, once per UTC day |
| Quick Duel mission (start one battle) | 15 | Repeatable, once per UTC day |
| Weekly Check-in mission | 25 | Repeatable, once per week |
| Steady Saver mission | 35 | Repeatable, once per week |
| Weekly Strategist mission (win two battles) | 40 | Repeatable, once per week |
| First Steps | 20 | One-time |
| Rising Tide | 30 | One-time |
| First Blood | 30 | One-time |
| Tactician | 25 | One-time |
| Bracket Climb | 50 | One-time, plus bronze item unlock |
| Battle win | 30 | Each battle |
| Battle loss | 10 | Each battle |
| Battle tie | 15 each | Each battle |

### 5.2 Caps

- **Daily missions:** Maximum 25 XP per UTC day (Daily Check-in 10 + Quick Duel 15).
- **Weekly missions:** Maximum 100 XP per week (25 + 35 + 40).

### 5.3 Level curve

- **Gentle curve:** Each level needs slightly more XP than the last. Early levels come quickly.
- **Exact XP thresholds per level:** Not yet defined (see Section 14).

### 5.4 Open XP inconsistency

- An earlier "balanced" table listed Weekly Check-in as **15 XP**. The mission update later set Weekly Check-in as a mission worth **25 XP**.
- The current value is **25 XP**. Confirm before building.
- The earlier standalone daily-bonus XP (5 XP) was **removed** and replaced by the Daily Check-in mission (10 XP).

---

## 6. Missions

### 6.1 One-time missions (5)

| Mission | Goal | Reward | Notes |
|---|---|---|---|
| First Steps | Connect your savings account and record your first check-in | 20 XP | |
| Rising Tide | Balance increases between two check-ins. Any amount counts. | 30 XP | Not a savings-amount requirement |
| First Blood | Win one battle against another player | 30 XP | |
| Tactician | Use both Defend and a Special Move in a single battle | 25 XP | |
| Bracket Climb | Reach the bronze bracket (3 NIM) | 50 XP and bronze item unlock | |

### 6.2 Daily missions (repeatable, reset at 00:00 UTC)

| Mission | Goal | Reward |
|---|---|---|
| Daily Check-in | Check in today | 10 XP |
| Quick Duel | Start one battle today | 15 XP |

### 6.3 Weekly missions (repeatable, reset Monday 00:00 UTC)

| Mission | Goal | Reward |
|---|---|---|
| Weekly Check-in | Record a check-in this week | 25 XP |
| Steady Saver | Balance held or grew at every check-in this week. Withdrawals reset this mission for the week. | 35 XP |
| Weekly Strategist | Win two battles this week | 40 XP |

### 6.4 Mission rules

- Repeatable missions reset on their timers. One-time missions do not expire.
- A one-time mission that is complete stays complete.

---

## 7. Items

Eight items, two per bracket. Items stay in the inventory after a withdrawal.

| Bracket | Item | Effect |
|---|---|---|
| Entry (1 NIM) | Cloth Purse | Defend gets +1 for the battle |
| Entry (1 NIM) | Ledger Scroll | +5% XP from check-ins |
| Bronze (3 NIM) | Bronze Shield | Defend blocks 25% more damage |
| Bronze (3 NIM) | Copper Compass | Shows your opponent's last move before you choose yours |
| Silver (10 NIM) | Silver Blade | +10% Attack damage |
| Silver (10 NIM) | Silver Charm | Special Move cooldown is one turn shorter |
| Gold (25 NIM) | Gold Gauntlet | +20% Special Move damage |
| Gold (25 NIM) | Golden Crown | Status badge on profile and leaderboard entry. **A badge, not an item.** |

**Rules:**
- Every item effect is a fixed modifier. None depends on chance.
- Each consumable item can be used once per battle.
- Item status text: "Locked: reach [bracket] to unlock." / "Active in battles." / "Still yours. Items stay after a withdrawal."

---

## 8. Badges

| Badge | Meaning | Removed on withdrawal? |
|---|---|---|
| First Steps | First check-in | No |
| Week Warrior | One-week streak (for everyone) | **Yes** |
| Iron Saver | Four-week streak (players who stay through 11 November) | **Yes** |
| Steady Hand | No withdrawals for a month | No |
| First Blade | First battle win | No |
| Golden Crown | Gold bracket status (an item-linked badge) | No |

Badge descriptions and icons are not yet written.

---

## 9. Battles

### 9.1 Basic rules

- Battles are between two characters. Players choose moves each turn.
- **5 turns** per battle. Ends earlier if one player's health reaches zero.
- Battles use **no chance**. Outcome depends only on moves and items.
- Each player picks a move secretly each turn. Both moves are revealed at the same time.
- The player with more health remaining at the end wins. Equal health is a tie.

### 9.2 Moves

| Move | Effect | Constraint |
|---|---|---|
| Attack | Deals damage | None |
| Defend | Reduces incoming damage for this turn | Pairs with Bronze Shield |
| Use item | Activates one owned item | Each item once per battle |
| Special Move | Stronger attack | Cannot be used on consecutive turns (cooldown of one turn) |

### 9.3 Opponents

- **Ranked:** Human players only, matched through the ranked queue (Section 10).
- **Unranked, friend challenge:** Challenge a friend directly. Unranked. Counts toward the daily limit.
- **Unranked, AI:** Any player can challenge the AI at any time. Unranked. Counts toward the daily limit.

### 9.4 Daily limit

- **3 battles per UTC day**, across ranked, unranked, and AI combined.

### 9.5 Timeouts and disconnects

- **Turn timeout:** If a player hasn't chosen a move, the turn passes with **Defend**.
- **Disconnect mid-battle:** The next move defaults to Defend until the player reconnects.
- **Connection lost:** Message: "Connection lost. Your move will be saved if you reconnect within 60 seconds."
- **Unanswered challenge:** Expires after **24 hours**.
- **Turn timer length:** Not yet defined (see Section 14).

### 9.6 Rewards

- Win: 30 XP
- Loss: 10 XP
- Tie: 15 XP each

### 9.7 Tie rule

- A tied battle gives both players half the XP (15 each).

### 9.8 Battle screen text

- Title: "Choose your move"
- Turn counter: "Turn 2 of 5"
- Move buttons: "Attack" / "Defend" / "Use item" / "Special Move (cooldown: 1 turn)"
- Waiting: "Waiting for your opponent to choose."
- Results: "You win!" / "You lost." / "It's a tie."
- Tie text: "Both characters held their ground. Each player gets 15 XP."

### 9.9 Battle menu text

- AI Opponent: "Battle the Savborne AI. Unranked."
- Friend: "Challenge a friend. Unranked."
- Ranked: "Find a ranked match in your bracket."

### 9.10 Battle error states

- Opponent doesn't respond: "Your challenge is still waiting. It expires in 24 hours."
- Daily limit reached: "You've started 3 battles today. New battles unlock at 00:00 UTC (1:00 AM Lagos time)."
- Connection lost: see 9.5.

### 9.11 Open battle numbers

- Starting health value
- Damage values for Attack, Defend, and Special Move
- Turn timer length

These are required before battles can be built. See Section 14.

---

## 10. Ranked play and matchmaking

### 10.1 Ranked entry

- **Level 3** or higher.
- **At least 5 check-ins.**
- Players who don't meet these can battle the AI and friends.

### 10.2 Ranked rating (Elo-style)

- **Starting rating:** 1000 for everyone entering ranked.
- **K-factor:** 32.
- **Floor:** Ratings never drop below **800**.
- **Only human ranked battles** change ratings. AI and unranked battles do not.
- **Ties:** Count as half a win for each player.

**Formula**
1. Expected score for a player = 1 / (1 + 10^((opponent rating − own rating) / 400))
2. Rating change = 32 × (actual result − expected score). Win = 1, tie = 0.5, loss = 0.
3. Round to the nearest whole point.

**Worked example**
- Player A: 1000. Player B: 1100.
- A's expected score: about 0.36. If A wins: about +20. If A loses: about −12.
- B's expected score: about 0.64. If B wins: about +12. If B loses: about −20.

**Season:** Ratings carry across all of Cycle III. No reset during the cycle.

### 10.3 Matchmaking rules

- Match within the same **bracket** first.
- Rating range widens with wait time:
  - 0 to 60 seconds: ±150 points
  - 60 to 119 seconds: ±300 points
  - 120 to 179 seconds: ±450 points
  - 180 seconds and over: ±600 points
- Players see a "searching" timer while waiting.
- If no match is found, the app offers an AI battle or a friend challenge while they wait.

### 10.4 Leaderboards

- **Ranked leaderboard:** Ranked points and wins. Main status board.
- **Unranked leaderboard:** Total wins and savings growth. Includes friend and AI battles.
- Both have a **friends filter**.
- Only **display names** are shown. Addresses are hidden.
- Everyone appears by default.

### 10.5 Ranked text

- Locked: "Reach Level 3 and complete 5 check-ins to unlock ranked battles."
- Queue: "Searching for a ranked opponent in your bracket..."
- Queue timeout: "No match yet. We'll keep searching. You can battle the AI or a friend while you wait."

---

## 11. AI opponent

### 11.1 Concept

- A **separate opponent** that any player can challenge.
- **AI never controls a real player's character.** That would deceive the other player and corrupt rankings.
- AI battles are **unranked**. They count toward the 3-battle daily limit.

### 11.2 Strategy (fixed, no randomness)

Turn priorities, checked in order:
1. If the AI's health is below 30% and the player used Attack last turn, the AI uses **Defend**.
2. If the AI has a Special Move available and it's turn 3 or turn 5, the AI uses **Special Move**.
3. If the player used Defend last turn, the AI uses **Attack**.
4. Otherwise, the AI uses **Attack**.

**Items:** The AI uses its Bronze Shield or Silver Blade at the start of the battle, if it owns them, then follows the priorities above.

### 11.3 Difficulty

- One difficulty level in v1.
- The AI loses to a player who mixes Attack, Defend, and Special Move.

### 11.4 Farming guard

- AI battles give the same XP as other unranked battles.
- They count toward the 3-battle daily limit.
- If farming becomes a problem, lower the AI battle reward first.

### 11.5 AI label

- Battle screen label: "Unranked. Opponent: Savborne AI."

---

## 12. Promotion plan (builder promotion checklist, 5 points)

- Post progress in the Skool community ("Promote your work" channel and general channels).
- Post on at least one social channel.
- Share the Skool and social posts publicly, as the checklist rewards visible promotion.

Exact checklist items and points for Cycle III are not yet confirmed. See Section 14.

---

## 13. Build plan

### 13.1 Calendar

**Dates to verify.** The Cycle III window opens on **14 October** and closes on **11 November**. The early-access checkpoint is the **start of Week 3**. Counting from 14 October, Week 3 starts **28 October**. The plan below uses 15 October as day one. Align the weeks with the official dates before relying on them.

| Week | Dates (plan) | Focus |
|---|---|---|
| Week 1 | 15 to 21 October | Prove the savings loop |
| Week 2 | 22 to 28 October | Core game and first testers |
| Week 3 | 29 October to 4 November | Battles, public launch, ranked |
| Week 4 | 5 to 11 November | Polish, promote, submit |

### 13.2 Week 1: prove the savings loop

1. **Spike `getBalance` on Nimiq Pay.** See Section 15 for steps.
   - Done when: the balance shows on a real phone inside Nimiq Pay. If it fails, stop and revisit the savings design.
2. **Set up the repo, Vercel, and Supabase** on free tiers. Create the MIT-licensed GitHub repo under your name.
   - Done when: a blank page deploys to Vercel, and Supabase accepts a test write.
3. **Build savings setup.** Connect the account, store the address, show the privacy notice with a separate "Continue" button.
   - Done when: a new user can connect and consent without any other screen in the way.
4. **Build check-ins.** Record balance, timestamp in UTC, compute daily and weekly streaks.
   - Done when: two check-ins a day apart produce the right amount and streak values, tested with real data.
5. **Add the Nimiq Pay version check.** Show the update prompt when `getBalance` is missing.
   - Done when: an older version shows the prompt and records nothing.

### 13.3 Week 2: core game and first testers

6. **Add XP, levels, and brackets.**
   - Done when: XP matches the table in Section 5, and brackets change at the right balances.
7. **Build daily and weekly missions**, including UTC resets and daily XP cap.
   - Done when: missions reset at 00:00 UTC and cap XP as specified.
8. **Build one-time missions and eight items**, with locked and unlocked states.
   - Done when: each unlock triggers at its bracket, and items persist after a withdrawal.
9. **Test with five or six real people.** Watch them complete setup and first check-in without help.
   - Done when: at least four finish setup alone. Fix blockers before Week 3.

### 13.4 Week 3: battles, public launch, ranked

10. **Build AI battles and unranked friend challenges.** 5 turns, player-chosen moves, Defend default on timeout.
    - Done when: a full battle plays out against the AI, and the daily limit blocks the fourth battle.
11. **Publish on the early-access date** (start of Week 3).
    - Done when: the live URL works inside Nimiq Pay.
12. **Build the ranked queue**, starting with bracket matching, then rating range.
    - Done when: the stress test in Section 16 passes. If not stable by 4 November, ship bracket-only matching and say so.
13. **Build leaderboards and friends filter.**
    - Done when: ranked and unranked boards show correct rankings for test accounts.

### 13.5 Week 4: polish, promote, submit

14. **Fix tester bugs.** Check the scoring categories against the build.
    - Done when: no known bug blocks the core loop.
15. **Promote the app.** Skool, social media, progress updates.
    - Done when: posted in the community and on at least one social channel.
16. **Submit before the deadline.** Deadline not yet published. Aim for 8 November.
    - Done when: submission confirmed in the portal, with the 250-word description and demo video.

### 13.6 Biggest risks

- `getBalance` fails on real phones, changing the savings design.
- Ranked queue not stable by 4 November. Fallback: bracket-only matching.
- Testers don't complete setup. The first-use test is worth 25 points.

---

## 14. Open items (decisions still needed)

| # | Item | Why it matters |
|---|---|---|
| 1 | Starting health value for battles | Battles can't be built without it |
| 2 | Damage values for Attack, Defend, Special Move, and item effects | Same |
| 3 | Turn timer length | Timeouts depend on it |
| 4 | Weekly Check-in XP (25 mission vs 15 earlier table) | Confirm the current value |
| 5 | Scaling method for amount and consistency scores | Needed for ranking |
| 6 | Exact XP thresholds per level (gentle curve) | Level progression |
| 7 | Definition of "consistency score" in numbers | Needed for ranking |
| 8 | Badge descriptions and icons | In-app text |
| 9 | Item icon designs | In-app visuals |
| 10 | Character art direction (pixel-art fantasy) | Visual build |
| 11 | Privacy notice placeholders (hosting provider, region, contact) | Required before publishing |
| 12 | Legal review of privacy notice under Nigeria's Data Protection Act 2023 | Especially deletion and retention terms |
| 13 | Verify Cycle III real-usage measurement method | Affects the 15-point usage score |
| 14 | Verify Cycle III builder promotion checklist items and points | Affects the 5-point promotion score |
| 15 | Confirm Week 3 start date against official dates | Early-access timing |
| 16 | Submission deadline | Not yet published |
| 17 | Repo name (suggested: `savborne`) | Repo setup |
| 18 | Whether to add a sign-based achievement (`sign`) in v1 | Optional, needs approval dialogs |
| 19 | Whether to use the device identifier in v1 | Optional |
| 20 | Whether to show AI battle XP reduction if farming appears | Farming guard |
| 21 | Whether Steady Hand needs its own definition beyond "no withdrawals for a month" | Badge logic |
| 22 | Confirm how a player's "current bracket" updates during a ranked queue | Matching edge case |

---

## 15. `getBalance` spike steps

### 15.1 Before you start

- A phone with Nimiq Pay installed, and a Nimiq wallet with at least 1 NIM in a savings account.
- A computer with Node.js installed, and a GitHub account.
- Use Nimiq Pay testnet if you want to avoid real money. Check which network Nimiq Pay is on.

### 15.2 Steps

1. **Create the test app.** Make a folder `savborne-spike`. Run `npm init -y`. Install with `npm install @nimiq/mini-app-sdk`. Check the version with `npm list @nimiq/mini-app-sdk` (must be 0.2.1 or later).
2. **Write `index.html`:**

```html
<!doctype html>
<html>
  <body>
    <button id="check">Check balance</button>
    <pre id="out"></pre>
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

3. **Write `main.js`:**

```javascript
import { init, NimiqProviderError } from '@nimiq/mini-app-sdk'

const out = document.getElementById('out')
const log = (msg) => (out.textContent += msg + '\n')

document.getElementById('check').addEventListener('click', async () => {
  try {
    const nimiq = await init()
    log('Provider ready.')

    if (typeof nimiq.getBalance !== 'function') {
      log('FAIL: getBalance not available. Update Nimiq Pay.')
      return
    }

    const accounts = await nimiq.listAccounts()
    log('Accounts: ' + JSON.stringify(accounts))

    const balanceLuna = await nimiq.getBalance(accounts[0])
    log('Balance: ' + balanceLuna / 100000 + ' NIM')
  } catch (error) {
    if (NimiqProviderError.is(error)) {
      log('Wallet error: ' + error.type + ' ' + (error.message || ''))
    } else {
      log('Error: ' + error)
    }
  }
})
```

4. **Deploy or expose the folder.** Deploy to Vercel, or run a local server with a tunnel such as ngrok. Confirm the page loads on your computer.
5. **Load inside Nimiq Pay.** Open Nimiq Pay on the phone and open the app by URL, or use `nimiqpay://miniapp?url=your-app-url`. Accept any unknown-URL warning for testing.
6. **Run the check.** Tap "Check balance." Approve account sharing if asked.

### 15.3 Pass conditions

- Output shows "Provider ready."
- Accounts list shows your savings address.
- Balance matches the expected amount.

### 15.4 Fail conditions

- "getBalance not available": update Nimiq Pay.
- `PERMISSION_DENIED`: approval was cancelled. Retry and approve.
- `NETWORK_ERROR`: consensus may not be established. Wait and retry.
- Balance shows 0 for an account with funds: check you're reading the savings account and the correct network.

### 15.5 Record

1. Nimiq Pay version
2. SDK version
3. Whether the balance matched
4. Error messages, word for word
5. Whether it worked first try

---

## 16. Matchmaking queue specification

### 16.1 Constraint

Vercel's Hobby plan runs cron jobs only once a day. The queue therefore cannot rely on a background worker to widen the range. Matching happens on each poll from a searching player.

### 16.2 Data model

- **`queue`:** `user_id`, `bracket`, `rating`, `entered_at`, `last_poll_at`, `status` (waiting, matched, cancelled), `battle_id`. Unique index allows one waiting row per user.
- **`battles`:** `id`, `player_a`, `player_b`, `mode` (ranked, unranked, AI), `status`, `current_turn`, `turn_deadline`, `winner`.
- **`daily_battles`:** `user_id`, `utc_date`, `count`. Enforces the 3-battle limit.
- **`profiles`:** `rating`, `level`, `check_in_count`, `current_bracket`.

### 16.3 Steps

1. **Enter the queue.** Check Level 3+ and 5+ check-ins. Check today's `daily_battles` count is below 3. Check the player isn't already waiting or in a battle. Insert the `queue` row.
   - Done when: a failing player sees the matching message, and a second join is rejected.
2. **Poll for a match.** The app calls `match_me` every 10 seconds, updating `last_poll_at`. Range widens with wait time (Section 10.3).
   - Done when: two test accounts in the same bracket match within 10 seconds.
3. **Pair atomically.** Pairing runs as a Postgres function. Selects the candidate with `FOR UPDATE SKIP LOCKED`, sets both queue rows to matched, creates the `battles` row, returns the battle ID.
   - Done when: a stress test with ten simultaneous entries produces no duplicate matches.
4. **Clean up stale entries.** A waiting entry with no poll for 30 seconds is abandoned. Ignored by matching. Deleted on next poll. Leaving the queue is always allowed.
   - Done when: closing the app removes the player within 30 seconds.
5. **Handle changes during the queue.** Re-check bracket at match time. If the player's bracket changed, update the queue row. If the daily limit is reached while waiting, remove them.
   - Done when: a player who crosses into a new bracket while waiting is matched in the new bracket.
6. **Run the battle.** Each turn has a deadline. No move means Defend. Disconnect means Defend until reconnect.
   - Done when: a battle finishes correctly when one player goes offline mid-turn.
7. **Settle the battle.** One transaction writes the winner, applies the Elo update (ranked only), adds XP, and increments `daily_battles`.
   - Done when: ratings match the worked example, and a ranked battle against AI changes no ratings.

### 16.4 Edge cases to test

- Both players hit the 3-battle limit at the same second. Only one battle should be counted.
- A player taps "find match" twice. The unique index should block the duplicate.
- A battle ends while a player is still polling. The poll should return the final result.

### 16.5 Build order

Build the queue table and `match_me` first. Test with two accounts before battle screens. Pairing is the riskiest part.

---

## 17. Privacy notice (draft, for review)

**Placeholders to fill before publishing:** `[hosting provider and region]`, `[you / the hosting provider]`, `[in-app button or email address]`, `[email address]`.

---

**Privacy notice: Savborne**

**The short version**
Savborne never holds, moves, or controls your money. We read the balance of the savings account you choose, so we can track your check-ins and streaks.

**What we collect**
- **Your Nimiq address.** You share it when you connect, so we can find your savings account.
- **Your savings account address.** The account you choose to track.
- **Balance snapshots.** Each time you check in, we record the balance and the date and time.
- **Game data.** XP, items, missions, battle results, badges, and streaks.
- **Display name.** The name you pick for the leaderboard.

**What we don't collect**
- Your private keys or recovery phrase
- Your balances in your other accounts
- Your name, phone number, email, or location, unless you choose to give us an email for account recovery
- Anything that lets us move or lock your funds

**What's public**
- Your display name, your rank, and your score appear on the leaderboard.
- Your balance is never shown to other players.
- Your savings account's balance is already public on the Nimiq blockchain. We don't add to that.

**How we use it**
- To calculate your savings amount, check-in streaks, and rankings
- To run the game features, like missions, battles, and badges

**Where it's stored**
Your data is stored in `[hosting provider and region]`, on servers managed by `[you / the hosting provider]`. We keep only what the game needs.

**How long we keep it**
We keep your data while your account is active. You can delete your account and all associated data at any time, using `[in-app button or email address]`.

**Your choices**
- You can stop tracking at any time by disconnecting your savings account.
- You can withdraw from your savings account at any time. Doing so removes only your streak badge.

**Consent**
By tapping "Continue," you agree to this notice and to Savborne storing your savings account address, balance snapshots, and game data as described above.

**Questions**
Contact `[email address]`.

---

**Notes before publishing**
- The "Continue" button must be separate from any screen that asks for a wallet connection.
- Nigeria's Data Protection Act 2023 applies to personal data. Have someone with legal knowledge review the notice, especially deletion and retention.
- Confirm that deleting an account removes the balance snapshots from the database, not only the account record.

---

## 18. Hosting, accounts, and contact

| Item | Decision |
|---|---|
| Frontend and backend hosting | Vercel, free Hobby plan |
| Database | Supabase, free tier |
| Repo | GitHub, under `er4l1m4d` (repo name suggested: `savborne`) |
| Licence | MIT, copyright under your name |
| Contact email (public) | damilareogooluwade@outlook.com |
| Rejected contact email | jigzcrypto@outlook.com (nickname-based, signals crypto) |
| Team | Solo. You are the designated lead for Nimiq comms and payouts |

**Vercel notes**
- Hobby plan is for personal, non-commercial use. Check current terms, and upgrade if the app earns money or runs commercially.
- Hobby cron jobs run once a day only. Queue design accounts for this.

**Email notes**
- The contact email is public in the privacy notice.
- A custom domain (for example, support@savborne.[tld]) would look more credible. It costs money, so it's a later upgrade.

**Nimiq Pay**
- Your Nimiq wallet receives prize payouts in USDC. Keep the wallet address safe and record it in the submission.

---

## 19. Out of version one

- Committed (locked) savings. The app cannot create a time-lock.
- USDT savings.
- Multiple character classes.
- Trading, marketplaces, or any feature that moves money.
- Paid rewards or cash prizes inside the game.
- Random drops, loot boxes, or any chance-based reward.
- Group savings (ajo or esusu).
- Freelance savings vault (parked; see Section 20).
- Native Android app (Volo-style). Mini Apps are web apps.
- Sign-based achievements, unless time allows.
- Device identifier, unless time allows.

---

## 20. Parked ideas

- **Freelance savings vault.** A USDT savings vault for freelancers with a timelock contract. Parked with return code **"freelance savings."** Notes: trustless EVM design may not score on the Nimiq integration category; NIM-based design needs a trust model; contract audit and testnet validation needed.
- **Wide net (Nimiq Pay adoption brainstorm).** Group gifts, class funds, bill splitting, event tickets, creator tips, campus marketplaces, quiz competitions, merchant ledgers, tutoring payments, and mutual aid. Parked with return code **"wide net."** Notes: mutual aid and pooled collections may raise money-transmission questions.
- **Earlier alternative: student event ticketing (Pay track).** Ticketing for your own events. Not selected.

---

## 21. Verified facts vs assumptions

**Verified from official sources**
- Cycle III dates, tracks, prizes, eligibility, and submission requirements (miniappscompetition.com)
- Scoring categories and weights (miniappscompetition.com/scoring)
- Payout milestones (miniappscompetition.com/payout)
- `getBalance` behaviour: no approval, any address, SDK 0.2.1 or later (nimiq.dev)
- Vesting and HTLC contracts exist at protocol level, but no provider method creates them (developer reference, nimiq.dev)
- Ethereum-side USDT on Polygon accessible through `window.ethereum` (nimiq.dev)

**Assumptions to verify**
- Cycle III real-usage measurement method (Cycle II used unique wallets)
- Cycle III builder promotion checklist points
- Cycle III submission deadline
- Whether Nimiq Pay on Nigerian phones already has the `getBalance` version
- Whether a Nimiq Pay testnet exists for the spike (check current docs)

---

## 22. Key discussions and reasons for decisions

- **Why savings-tracking, not custody:** The rules prohibit deceptive functionality and reward user data handling with disclosure. Custody adds regulatory and trust risk on a $0 budget.
- **Why no committed savings in v1:** Protocol supports vesting and HTLC, but the mini app provider has no create method. Shipping an unverified lock risks a deceptive feature.
- **Why no chance-based rewards:** Games of chance are prohibited. All item and battle effects are fixed.
- **Why AI never controls real players:** It would mislead opponents and corrupt rankings.
- **Why UTC:** Players across timezones need one shared reset. Lagos is UTC+1, so midnight UTC is 1:00 AM in Lagos.
- **Why Elo for ranked:** Rewards wins against stronger opponents, which discourages farming easy wins.
- **Why a rating floor of 800:** Prevents losing streaks from pushing players out of ranked entirely.
- **Why the Defend default on timeout:** Stops players winning by default when an opponent leaves, without penalising the leaver heavily.
- **Why "Savborne":** Avoids "vault," which implies custody. Avoids "Nimiq" in the name, which avoids brand-impersonation risk. Short, unique, no conflict found.

---

## 23. Revision log (key changes)

- Introduced savings RPG concept with check-ins, streaks, and withdrawal rules.
- Ruled out custody, chance-based rewards, and committed savings in v1.
- Set brackets, then lowered them twice: final 1, 3, 10, 25 NIM.
- Added daily and weekly repeatable missions with caps.
- Set UTC as the only time basis for resets and deadlines.
- Replaced open challenges with matchmaking: ranked queue, unranked, and AI.
- Added Elo-based ranked rating with a 800 floor.
- Renamed the app from Vaultborn to Savborne after conflict and custody checks.
- Privacy notice drafted. Placeholders remain.
- Build plan written. Week dates may need aligning with official dates.

---

*End of specification.*

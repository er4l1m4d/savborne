# Savborne — Non-custodial vault and the real savings loop

**Date:** 2 November 2026
**Status:** Approved. Implementation plan:
`docs/superpowers/plans/2026-11-02-vault-and-savings-loop.md`
**Deadline:** 8 November 2026 (submission), 11 November 2026 (Cycle III close)

---

## 1. Purpose

Savborne currently turns a **self-reported** balance into XP, streaks, items and rank.
`src/app/api/check-ins/route.ts` says so in its own header comment: the client posts
`balanceLuna` and the server believes it. Nothing moves, nothing is provable, and the
word "savings" rests on an honour system.

This build replaces that with a vault the player actually controls:

- money moves in and out through real Nimiq transactions;
- the server reads the vault balance from the chain instead of trusting the client;
- every movement produces a receipt with a transaction hash and a block height;
- the key exists only on the player's device, and the player is forced to back it up
  before a single luna can enter.

Success is not "all twelve items shipped". Success is: **a player can deposit, see it
prove itself on chain, check in against the real balance, and withdraw — and none of
those steps can lie to them.**

## 2. Decisions locked

| # | Decision | Rationale |
|---|---|---|
| D1 | Vault key is generated on device from a 24-word phrase | Spike-proven; true non-custodial |
| D2 | "Grow" is deposits only — no staking | Staker lockups turn a bug into stuck funds |
| D3 | Server reads vault balance over RPC at check-in | Closes the XP-farming hole |
| D4 | `vaults` is a separate table | `UNIQUE(player_address)` *is* the item-10 mapping |
| D5 | Backup gate is enforced server-side | A UI gate is a suggestion |
| D6 | No deposit cap; warning + backup + 1 NIM default | It is the player's money; Gold must stay reachable |
| D7 | Shields replace the existing weekly grace | Grace is invisible and cannot be a game object |
| D8 | Flex card is a public page plus an OG image | One build, two outputs, clickable |
| D9 | Floor: vault works end-to-end | A polished game on a fake balance is what exists today |

## 3. Scope

**In:** items 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 of the brief.

**Out, deliberately:** staking or any yield; auto-save schedules; withdraw to a third-party
address; multi-device sync of the vault key; custodial recovery of any kind; renaming a
character; deleting a vault.

## 4. Architecture

### 4.1 The vault

A plain Nimiq basic account. Its key is derived deterministically from a 24-word phrase
generated in the browser. The phrase and the private key never leave the device.

Verified in the spike (2 November 2026, Chromium, real build):

- `@nimiq/core/web` WASM initialises in **390 ms**
- one **1.06 MB** wasm chunk ships; the 7.7 MB light-client worker is tree-shaken out
- phrase → address is deterministic and restores identically
- a 139-byte transaction is built and signed with **no light client running**

### 4.2 Two signing paths

| Flow | Signer | Mechanism |
|---|---|---|
| Deposit / Grow | Nimiq Pay wallet | `sendBasicTransaction` |
| Withdraw | Vault key, in-browser | `TransactionBuilder` → `tx.sign()` → `sendRawTransaction` |

Deposit is signed by the wallet because the money starts there. Withdraw is signed in the
browser because the vault is not one of the wallet's accounts and never will be.

### 4.3 Broadcast and inclusion

RPC endpoints, chosen from `getHostNetwork()`:

- mainnet — `https://rpc.nimiqwatch.com`
- testnet — `https://rpc.testnet.nimiqwatch.com`

Both send `Access-Control-Allow-Origin: *`; both answered from a real browser origin
(testnet 453 ms, mainnet 1121 ms).

**The RPC surface, verified against the live nodes on 2 November 2026** (these are the
method names the shipping code must use — the obvious guesses are not allowed):

| Need | Method | Shape |
|---|---|---|
| Balance | `getAccountByAddress(address)` | `result.data.balance` (luna), `result.data.type` |
| Transaction | `getTransactionByHash(hash)` | `result.data.blockNumber`, `from`, `to`, `value`, `fee`, `networkId`, `executionResult` |
| Broadcast | `sendRawTransaction(hex)` | `result.data` is the transaction hash string |
| Head height | `getBlockNumber()` | `result.data` is the height |

`getBalance` is **not** available on these nodes — it returns `Method not allowed`, exactly
like `getNetworkInfo` and `getNetworkId`. Balance reads must go through
`getAccountByAddress`.

**Network ids, measured rather than assumed.** Sampling 40 mainnet transactions and 32
testnet transactions returned **24 on every mainnet transaction** and **5 on every testnet
transaction**. The earlier assumption of 42 / 1 was wrong. `TransactionBuilder.newBasic`
must be given 24 or 5 accordingly.

**Explorer format, checked against a real hash.** `https://nimiq.watch/#<hash>` renders a
mainnet transaction page and `https://test.nimiq.watch/#<hash>` renders a testnet one;
`https://nimiq.watch/tx/<hash>` returns 404. Receipts must use the network-appropriate `#`
form, so a testnet receipt never links to a mainnet explorer.

**A transaction hash is not a receipt.** The spike proved this: the node returned a hash
for nine unfunded transactions and for transactions built with the wrong network id, and
`getTransactionByHash` then reported "not found" for every one. `sendRawTransaction`
returning a hash is therefore never sufficient.

Therefore every transfer moves through an explicit state machine:

```
broadcast → pending → included
                    ↘ expired
```

- `pending`: a hash exists. Nothing is claimed, nothing is credited.
- `included`: `getTransactionByHash` returns a block height. Only now is a receipt issued
  and a balance credited.
- `expired`: no inclusion within 2 minutes of broadcast. Shown as failed with a retry.

No screen may render success from a hash.

### 4.4 Server trust model

The server keeps: intent records, chain verification, the vault→player mapping, receipts
and leaderboards. It never holds a key and never moves money.

**Transfers are credited only after the server verifies the transaction on chain itself.**
A client-supplied `{txHash, amountLuna}` is treated as a claim to be checked, not a fact:

- deposit: transaction exists, `recipient == vault`, `value == amountLuna`
- withdraw: transaction exists, `sender == vault`, `recipient == players.address`

The withdraw check compares against `players.address` — the identity account that owns the
player row — because that is the only account the server can verify. The client may hold
several wallet accounts; the server cannot enumerate them and must not pretend to.

**The timing consequence, stated honestly.** `getTransactionByHash` only returns a
transaction once it is included; a freshly broadcast transaction is "not found". So `POST
/api/transfers` cannot always verify immediately. The rule is therefore:

- a hash-shaped claim with a positive amount is recorded as `pending` — the claimed amount
  is stored but **never credited**;
- every poll re-reads the chain; on inclusion the amount, fee and counterparty are taken
  from the chain, not from the claim;
- a claim that resolves but fails a check becomes `expired` with a `failure_reason`
  (`wrong_recipient`, `wrong_sender`, `wrong_amount`, `wrong_network`);
- a claim that never resolves within two minutes becomes `expired` with `not_included`.

`422` is reserved for malformed input (bad hash shape, non-positive amount), not for a
transaction that has not landed yet.

## 5. Data model

Additive only. No destructive migration; `FINAL-SCHEMA.sql` stays idempotent.

```sql
create table if not exists vaults (
  address            text primary key,
  player_address     text not null unique
                       references players(address) on delete cascade,
  network            text not null check (network in ('mainnet','testnet')),
  card_token         text unique not null,
  backup_verified_at timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists transfers (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  vault_address  text not null references vaults(address),
  direction      text not null check (direction in ('in','out')),
  amount_luna    bigint not null check (amount_luna > 0),
  fee_luna       bigint not null default 0,
  tx_hash        text unique not null,
  status         text not null default 'pending'
                   check (status in ('pending','included','expired')),
  block_height   int,
  failure_reason text,
  created_at     timestamptz not null default now(),
  confirmed_at   timestamptz
);

create index if not exists transfers_player_idx
  on transfers (player_address, created_at desc);

alter table players
  add column if not exists shields          int  not null default 1,
  add column if not exists shields_earned   int  not null default 0;

-- One-time mission for the first vault deposit (§6.2). Additive seed; the
-- missions table is already the source of truth for names and XP values.
insert into missions (key, name, description, type, xp_reward, bracket_required)
values ('first_deposit', 'Vault Opened', 'Make your first deposit into your vault.',
        'onetime', 20, null)
on conflict (key) do nothing;
```

**What the mapping is actually for (item 10).** Three things, and no others: it makes a
foreign or duplicate vault claim impossible (`UNIQUE(player_address)`); it lets the flex card
resolve `card_token → vault → player` without exposing an address; and it lets a leaderboard
row carry a "verified saver" marker. It is not a join key for balances — those are read from
the chain.

**Why `vaults` is a table, not a column.** `UNIQUE(player_address)` makes it structurally
impossible to claim another player's vault or hold two. `backup_verified_at` gates deposits.
`card_token` is random so a shared link never contains an address.

**`players.savings_account_address` now holds the vault address.** No rename; the field
simply starts pointing at something real.

**`players.grace_used_this_week` is deprecated.** The column stays (destructive migrations
are avoidable) but nothing reads or writes it after this build. It is recorded here so a
future reader does not assume it is live.

**`tx_hash` is unique** so a retried POST records a transfer exactly once.

## 6. Flows

### 6.1 Onboarding — five steps

1. **Welcome** — the non-custodial claim in one sentence.
2. **Create vault** — generate the phrase, derive the address, mint a `card_token`. **Nothing
   is persisted yet**; the vault exists only in component state.
3. **Backup gate** — display the 24 words, require an explicit "I have written these down",
   then quiz **4 random positions**.
4. **Privacy notice** — existing text, corrected for the vault.
5. **Character name** — one request creates the player row **and** the vault row together,
   with `backup_verified_at` set.

**Why the vault is not written in step 2.** `vaults.player_address` references
`players(address)`, and the player row does not exist until step 5. Persisting earlier would
either violate the foreign key or force a placeholder player. Creating both in one request
keeps the constraint honest and makes onboarding atomic: either the player and their vault
both exist, or neither does.

**What "server-side enforcement" honestly means here.** `/api/transfers` refuses a deposit
when `backup_verified_at` is null, so the gate cannot be skipped by *not* doing the quiz in
the UI. It cannot stop a hand-crafted request that lies about having passed — but a player
who does that only endangers their own funds, so this is the correct place to stop.

The quiz proves the player wrote *something* down. It is a speed bump against clicking
through, not cryptographic proof. Re-typing all 24 words on a phone is not acceptable UX,
so this trade is made knowingly and must not be described as verification.

**Phrase re-display** lives in settings, behind the passphrase. Without it, clearing browser
data is unrecoverable, and that is the most likely way a real user gets hurt.

### 6.2 Deposit

1. Amount, pre-filled at **1 NIM**.
2. First deposit shows a one-time screen: if you lose the phrase and the phone, the NIM in
   this vault is gone and Savborne cannot recover it.
3. `sendBasicTransaction({ recipient: vault, value })`.
4. `POST /api/transfers` → server verifies on chain → row at `pending`.
5. Poll until `included`; then credit balance, recompute bracket, unlock items.
6. First-ever deposit awards the one-time `first_deposit` mission (20 XP).

### 6.3 Grow

Same transfer, different entry point: a top-up field, a growth chart from `transfers`, and
the current bracket progress. No second mechanism. Deposits do not award XP directly after
the first; growth is rewarded through the existing `rising_tide` and `bracket_climb`
missions at check-in.

### 6.4 Withdraw

1. Amount, destination **fixed to the player's identity account** (`players.address`) in v1.
   A typo'd NQ address is unrecoverable and there is no name-based confirmation to catch it.
   The server can only verify a recipient it knows, and this is the one it knows.
2. Unlock the vault with the passphrase (measured 562 ms at 210k PBKDF2 iterations on this
   machine; expect 1–2 s on a mid-range Android).
3. Build, sign, broadcast. Poll for inclusion.
4. On `included`: set `withdrawal_in_progress`, revoke the streak badge, restart
   `steady_hand_started_at` — the existing withdrawal rules, unchanged.

### 6.5 Check-in

`POST /api/check-ins` **stops accepting `balanceLuna` from the client.** It reads the vault
balance itself over RPC. A client that still sends the field has it ignored.

This removes the documented trust hole and makes the leaderboard amount score real. Cost:
check-in now depends on RPC reachability, and an RPC outage is a check-in outage. That is
an honest dependency, surfaced as a fail state (§10), not hidden behind a stale balance.

### 6.6 Existing players

Every player who onboarded before this build has a `players` row and **no `vaults` row**.
They must not be silently broken, and they must not be silently trusted either.

- On open, a player with no vault is sent to the vault-creation flow (§6.1 steps 2–3), which
  ends by writing a `vaults` row against their existing player row. Name and history are kept.
- Until they create one, `/api/check-ins` returns `409 vault_required` rather than falling
  back to a client-reported balance. A fallback would reintroduce the exact hole this build
  exists to close.
- Their previous `savings_account_address` is left untouched in the row for audit; it stops
  being read. No data is deleted.

## 7. Streak shields

`computeStreak` is rewritten. The invisible weekly grace is deleted; shields replace it.

- A player starts with **1** shield.
- **+1 shield per 7 consecutive days**, capped at **3**.
- Shields are shown as a count on Home, next to the streak.
- `shields_earned` tracks lifetime earns so the UI can distinguish "never earned" from
  "spent".

**Consumption, precisely.** Shields are evaluated only at check-in, inside the streak walk:

1. Walk the check-in days backwards from today, as `computeStreak` does now.
2. For each gap of *n* missed days between consecutive check-ins, spend `min(n, shields)`
   shields to bridge it.
3. If the gap exceeds the shields available, the streak resets at that point — the same
   place the current implementation breaks.
4. A bridge may cross a week boundary; the old "grace only applies inside the current week"
   restriction disappears with the grace rule it belonged to.
5. Earnings are then recomputed from the resulting streak. `shields_earned` stores how many
   7-day blocks have ever been awarded, so earning is idempotent:

   ```
   blocks   = floor(streak / 7)
   newBlocks = blocks - shields_earned
   if newBlocks > 0:
       shields        = min(3, shields + newBlocks)
       shields_earned = blocks
   ```

   Spending only decrements `shields`. There is no `spent` column, and spent is **not**
   derivable once the cap has been hit — a player at the cap can earn blocks that award
   nothing. That is intentional: the cap is a ceiling, not an accounting ledger.

This is deliberately a pure function of (check-in days, `shields`, `shields_earned`, now), so
it can be unit-tested without a database.

Consequence, stated plainly: streaks become **harder** than today for a player who misses a
day in their first week, because the free weekly grace is gone. The starting shield of 1 is
the compensation, and it is visible, which the grace never was.

## 8. Receipts

`/receipts` renders a merged timeline with two visually distinct row types:

| Row | Tx hash | Block height | Source |
|---|---|---|---|
| Deposit / withdraw | yes → explorer link | yes | `transfers`, `status = 'included'` |
| Balance snapshot | no | no | `check_ins` |

A snapshot is a read, not a transaction. Rendering them identically would be a quiet lie.
Pending transfers show the hash, say "pending", and carry **no** receipt link. Expired ones
show as failed with a retry.

The explorer URL format will be verified against a real hash before it is written into the
component, not recalled from memory.

## 9. Flex card

- Public route `/card/[token]`, token random and stored on `vaults.card_token`.
- `opengraph-image` route so the link unfurls in chat.
- Shows: display name, level, streak, bracket, and the shortened vault address as a
  "verified saver" marker.
- **Never shows the balance.** The privacy notice promises this.
- No authentication, no enumeration: an unknown token is a 404.

## 10. Fail states

| State | Trigger | Behaviour |
|---|---|---|
| Empty vault | balance 0, no transfers | First-deposit CTA, not a broken screen |
| No connection | RPC unreachable | Retry with the reason shown. Never a cached "success" |
| Wrong network | host network ≠ vault network | Testnet badge; mainnet and testnet data never mix |
| Broadcast, not included | no inclusion within 2 min | "Pending, not yet confirmed", hash shown, retry offered |
| Backup not verified | `backup_verified_at` null | Deposit refused server-side, with the reason |

## 11. Sound and haptics

- Level-up plays a short ascending chiptune arpeggio synthesised with WebAudio. No asset
  files, no licensing, a few KB, and it matches the pixel aesthetic.
- `navigator.vibrate` fires alongside it where supported, and is silently skipped where not.
- Nothing else in the app makes noise.

## 12. Guided tour

Custom 5-step overlay. No library: a dependency would not match the design system and the
build window is six days.

1. Your vault
2. Your streak and shields
3. Check in
4. XP, level, bracket
5. **Ends on the deposit button**, highlighting it rather than describing it

Skippable at every step, shown once via a localStorage flag, and re-openable from settings.

## 13. README and repo

- **Item 12 needs no work.** `Savborne-handoff.html.bak` was added in `64a9485` and removed
  in `4f701f1`. Nothing is tracked and nothing is on disk. This is recorded in the commit
  message rather than "fixed".
- **Checkpoint date** updated to reflect actual state rather than the 28 October plan.
- **Non-custodial disclosure rewritten.** The current text says Savborne "only reads the
  balance" — false the moment deposits exist.
- **Contact** `damilareogooluwade@outlook.com`, kept, and **rendered in an in-app footer** on
  the profile screen. The privacy notice already promises an address "in the app footer";
  today no such footer exists, so the promise is currently unkept.

## 14. Build order and the cut line

The floor (D9) is that the vault works end-to-end. Everything below the line is cut first.

1. Schema (written as a file; the user applies it)
2. Server: vault creation inside `/api/players`, `/api/transfers` with chain verification,
   `/api/check-ins` reading the balance itself, the `409 vault_required` path for existing players
3. `src/lib/vault/` — phrase ceremony, RPC, inclusion polling, encryption
4. Onboarding, the backup gate, and the existing-player vault path
5. Deposit, grow, withdraw UI
6. Receipts
   ——— **floor: vault works end-to-end** ———
7. "Verified saver" marker on leaderboard rows, resolved through the vaults mapping
8. Shields
9. Flex card and OG image
10. Tour
11. Sound and haptics
12. README, in-app footer, cleanup

## 15. Verification

Existing gates stay: `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the art
scripts in `docs/HANDOFF-PROMPT.md`.

New, because pure logic is now load-bearing and there is no test framework in the repo:

- `node --test` (built into Node 20+) for `computeStreak` with shields, the shield earn/spend
  rules, and the transfer state machine (`broadcast → pending → included | expired`).
  `tsx` is added as a dev dependency so the runner can follow the app's extensionless
  TypeScript imports; there is no other test framework.
- One integration check against testnet RPC for inclusion polling. **This has now been run
  end to end without a phone** (§17): a throwaway key was funded from
  `https://faucet.pos.nimiq-testnet.com/tapit`, a 139-byte transaction was built with network
  id 5, signed, broadcast with `sendRawTransaction`, and appeared in block 15698237 with
  `confirmations: 1` on the first poll.
- Manual, on the phone: check 4 of the spike — a real deposit into the vault, then a real
  withdrawal out. **This is the only gate that still needs the device**, and it blocks
  shipping the wallet-signed deposit path, not building it.

## 16. Known risks

| Risk | Severity | Mitigation |
|---|---|---|
| Network id | **Resolved** | Measured from live chain data: mainnet 24, testnet 5. Was wrongly assumed to be 42 / 1. |
| Lost phrase = lost funds | High | Backup gate, re-display in settings, one-time warning, 1 NIM default |
| Six days for twelve items | High | Explicit cut line (§14) with the vault as the floor |
| RPC outage blocks check-in | Medium | Surfaced as a fail state with retry; no stale-balance fallback |
| Vault key in a WebView | Medium | AES-GCM-256 + PBKDF2 (spike-proven), key never transmitted |
| `sendBasicTransaction` return type | Low | It is documented as "the serialized transaction" but observed as a hash; the client normalises both (64-hex = hash, longer hex = deserialize and hash) |

## 17. Spike artefacts and proof

Kept in the tree only until check 4 runs:

- `src/app/vault-spike/page.tsx` — throwaway page, untracked
- `src/components/VersionGate.tsx` — 8-line pathname-gated bypass for `/vault-spike` only.
  Product routes unaffected. **Must be removed before shipping.**

Both are deleted once the real flows exist.

**What was proven on 2 November 2026, from this machine, with no phone:**

| Check | Result |
|---|---|
| Testnet faucet funds an arbitrary address | `POST https://faucet.pos.nimiq-testnet.com/tapit` → `{"success":true}`; balance read 11,000,000,000 luna |
| Local key generation in Node | 24-word phrase → address, deterministic |
| Build + sign offline | 139-byte transaction, network id 5 |
| Broadcast | `sendRawTransaction` returned the same hash the local transaction computed |
| Inclusion | Block 15698237, `confirmations: 1` on the first poll |
| Balance read | `getAccountByAddress` returned the funded balance |
| Network ids | 40/40 mainnet txs = 24; 32/32 testnet txs = 5 |
| Explorer link | `https://nimiq.watch/#<hash>` rendered the transaction page |

The only remaining unknown is the wallet-signed deposit path inside Nimiq Pay itself.

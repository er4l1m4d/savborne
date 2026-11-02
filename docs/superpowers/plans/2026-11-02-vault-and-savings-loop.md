# Savborne — Non-custodial vault and the real savings loop

**Spec:** `docs/superpowers/specs/2026-11-02-vault-and-savings-loop-design.md`
**Date:** 2 November 2026
**Deadline:** 8 November 2026 (submission), 11 November 2026 (Cycle III close)

This plan turns all twelve items of the brief into ordered, individually-committable
tasks. It is written for an engineer who has not read this codebase: every file path,
signature and expected value is given. Where a decision was made in conversation, the
decision is recorded here rather than left open.

---

## 0. How to use this plan

- Tasks are ordered. Each one leaves `npm test`, `npx tsc --noEmit`, `npm run lint` and
  `npm run build` green. Do not start task *n+1* until task *n* is green.
- **Every task ends in a commit.** Commit messages are given; use them.
- Pure logic gets a test **before** the implementation (tasks 3, 4, 6, 9, 11).
  Route handlers and UI are verified by types, lint, build, and the task's own `Done when`
  checklist. A route handler is not unit-tested through a fake Supabase client — that
  tests the fake, not the handler.
- Anything marked **DEVICE** cannot be verified on this machine. Collect those into the
  single device pass in §5. Do not mark a DEVICE item done because the code compiles.
- **Never run SQL.** The user applies migrations by hand. Write files only.
- **Never edit or commit `src/app/(tabs)/page.tsx`.** It contains the user's own
  uncommitted work. §7 contains an optional snippet for them to paste after they commit.

---

## 1. Ground rules

1. **Server never holds a key and never signs.** The vault phrase exists only in the
   browser, encrypted at rest. No server module may import `@nimiq/core/web`.
2. **A transaction hash is not a receipt.** Only `getTransactionByHash` returning a
   `blockNumber` may produce a settled transfer. Every other state is `pending` or
   `expired`.
3. **The client's balance is never trusted.** `/api/check-ins` stops accepting
   `balanceLuna`; it reads the vault over RPC.
4. **Additive schema only.** No column is dropped. `grace_used_this_week` is deprecated,
   not removed; `savings_account_address` keeps its name and starts holding the vault
   address.
5. **Network ids are 24 (mainnet) and 5 (testnet).** Measured from live chain data, not
   recalled. Do not use 42/1.
6. **Explorer links use `#`, not `/tx/`.** `https://nimiq.watch/#<hash>` and
   `https://test.nimiq.watch/#<hash>`.
7. **Money is integer Luna.** `bigint` on the wire and in SQL, `number` in TypeScript,
   and every conversion goes through `Math.floor`. Total supply is 2.1×10¹² Luna, far
   below `Number.MAX_SAFE_INTEGER` (9×10¹⁵), so JSON numbers are safe — say so in a
   comment, because it looks wrong otherwise.
8. **Nothing else makes noise.** The level-up chiptune is the only sound in the app.

---

## 2. Shared contracts

These types are defined once and imported everywhere. If a later task needs a different
shape, change it here first.

### 2.1 Files and their environments

| File | Runs in | Purpose |
|---|---|---|
| `src/lib/vault/network.ts` | both | RPC URLs, network ids, explorer URLs |
| `src/lib/vault/address.ts` | both | Normalise and compare NQ addresses |
| `src/lib/vault/rpc.ts` | both | JSON-RPC calls: account, tx, head, broadcast |
| `src/lib/vault/verify.ts` | both | Pure: does this chain tx satisfy this claim? |
| `src/lib/vault/settle.ts` | server only | DB writes after inclusion |
| `src/lib/vault/phrase.ts` | browser only | WASM, phrase → address, sign a transfer |
| `src/lib/vault/crypto.ts` | both | AES-GCM + PBKDF2 encrypt/decrypt |
| `src/lib/vault/storage.ts` | browser only | localStorage record for the encrypted phrase |
| `src/lib/vault/transfers.ts` | browser only | POST → poll → settle loop for one transfer |
| `src/lib/vault/useVault.ts` | browser only | React hook wrapping the above |
| `src/lib/vault/errors.ts` | both | Error kinds shared by client and API |

`network.ts`, `address.ts`, `rpc.ts`, `verify.ts` and `crypto.ts` must not import
`@nimiq/core/web` or React. They are imported by Node test runs and by route handlers.

**Two facade rules that are easy to get wrong**

1. `src/lib/nimiq.ts` exports `hostNetwork()`, **not** `getHostNetwork`. The SDK's
   `getHostNetwork` is imported there and never re-exported. Importing the wrong name is a
   compile error; grep for the name before using it.
2. `TransactionBuilder.newBasic` requires an **`Address` instance**, not a string. Calling
   it with a user-friendly string throws `expected instance of Address` at runtime even
   though it may type-check through `any`. Always
   `Address.fromUserFriendlyAddress(recipient)` first.

**`TransferRow`** (the DB row, referenced by `settle.ts` and the routes):

```ts
export type TransferRow = {
  id: number
  player_address: string
  vault_address: string
  direction: TransferDirection
  amount_luna: number
  fee_luna: number
  tx_hash: string
  status: 'pending' | 'included' | 'expired'
  block_height: number | null
  failure_reason: FailureReason | null
  created_at: string
  confirmed_at: string | null
}
```

Declare it in `src/lib/database.types.ts` and re-export it from `src/lib/vault/verify.ts`
so `settle.ts` has one import.

### 2.2 `network.ts`

```ts
import type { Network } from '@/lib/nimiq'

export const VAULT_NETWORK_ID: Record<Network, number> = { mainnet: 24, testnet: 5 }

export const VAULT_RPC_URL: Record<Network, string> = {
  mainnet: 'https://rpc.nimiqwatch.com',
  testnet: 'https://rpc.testnet.nimiqwatch.com',
}

/** Explorer link for a settled transaction. `#`, never `/tx/`: that path 404s. */
export function explorerTxUrl(network: Network, hash: string): string {
  const base = network === 'mainnet' ? 'https://nimiq.watch' : 'https://test.nimiq.watch'
  return `${base}/#${hash}`
}

export function isNetwork(value: unknown): value is Network {
  return value === 'mainnet' || value === 'testnet'
}
```

### 2.3 `address.ts`

Nimiq user-friendly addresses are uppercase, space-separated, and case-insensitive.
Never compare raw strings.

```ts
export function normalizeAddress(address: string): string {
  return address.replace(/[\s+]/g, '').toUpperCase()
}

export function sameAddress(a: string, b: string): boolean {
  return normalizeAddress(a) === normalizeAddress(b)
}

/** NQ + 32 base32 chars (36 without spaces). */
export function isPlausibleAddress(value: unknown): value is string {
  return typeof value === 'string' && /^NQ[0-9A-Z]{34}$/.test(normalizeAddress(value))
}

export function shortenAddress(address: string, groups = 2): string {
  const parts = normalizeAddress(address).match(/.{4}/g) ?? []
  if (parts.length <= groups * 2) return parts.join(' ')
  return `${parts.slice(0, groups).join(' ')} … ${parts.slice(-groups).join(' ')}`
}
```

### 2.4 `rpc.ts`

```ts
import type { Network } from '@/lib/nimiq'

export type RpcOptions = { fetchImpl?: typeof fetch; timeoutMs?: number }

export class RpcError extends Error {
  constructor(
    readonly kind: 'unreachable' | 'rpc_error',
    message: string,
  ) {
    super(message)
    this.name = 'RpcError'
  }
}

export type ChainAccount = { address: string; balanceLuna: number; type: string }
// NOTE: `type` is the string "basic" on these nodes — not a numeric account type.

export type ChainTransaction = {
  hash: string
  blockNumber: number
  from: string
  to: string
  valueLuna: number
  feeLuna: number
  networkId: number
  executionResult: boolean
  confirmations: number
}

export async function getAccount(
  address: string,
  network: Network,
  opts?: RpcOptions,
): Promise<ChainAccount>

export async function getHeadHeight(
  network: Network,
  opts?: RpcOptions,
): Promise<number>

/** `null` when the node says the transaction is not known yet. Throws on transport. */
export async function getChainTransaction(
  hash: string,
  network: Network,
  opts?: RpcOptions,
): Promise<ChainTransaction | null>

/** Returns the hash the node accepted. */
export async function broadcastTransaction(
  hex: string,
  network: Network,
  opts?: RpcOptions,
): Promise<string>
```

Wire details that must be encoded, not remembered at call sites:

- envelope `{ jsonrpc: '2.0', id: 1, method, params }`
- success is `result.data`; `getBalance` on these nodes returns **`Method not allowed`** —
  never use it
- not-found for `getTransactionByHash` arrives as
  `error.data === 'Transaction not found: <hash>'` (HTTP 200). Map it to `null`
- any other `error` object → `RpcError('rpc_error', …)`
- network failure / abort → `RpcError('unreachable', …)`
- `value` and `fee` arrive as JSON numbers in Luna; cast with `Number()` and
  `Math.trunc()` and document why that is safe

### 2.5 `verify.ts`

```ts
import type { ChainTransaction } from './rpc'

export type TransferDirection = 'in' | 'out'

export type FailureReason =
  | 'wrong_recipient'
  | 'wrong_sender'
  | 'wrong_amount'
  | 'wrong_network'
  | 'execution_failed'
  | 'not_included'

export type VerifyClaim = {
  direction: TransferDirection
  amountLuna: number
  vaultAddress: string
  /** The player's identity address — the only withdrawal destination v1 allows. */
  playerAddress: string
  networkId: number
}

export type VerifyResult = { ok: true } | { ok: false; reason: FailureReason }

export function verifyClaim(tx: ChainTransaction, claim: VerifyClaim): VerifyResult
```

Check order (it determines which reason the user sees):

1. `tx.networkId !== claim.networkId` → `wrong_network`. This is defensive: in practice the
   transaction is read from the vault's own chain, so a wrong-network transaction appears
   as not-found rather than as a foreign `networkId`. Keep the check anyway — it costs one
   comparison and it documents the assumption.
2. `!tx.executionResult` → `execution_failed`
3. direction `in`: `!sameAddress(tx.to, claim.vaultAddress)` → `wrong_recipient`
4. direction `out`: `!sameAddress(tx.from, claim.vaultAddress)` → `wrong_sender`
5. direction `out`: `!sameAddress(tx.to, claim.playerAddress)` → `wrong_recipient`
6. `tx.valueLuna !== claim.amountLuna` → `wrong_amount`
7. otherwise `{ ok: true }`

### 2.6 `crypto.ts` and `storage.ts`

```ts
export const PBKDF2_ITERATIONS = 210_000

export type EncryptedBlob = {
  ciphertext: string // base64
  iv: string // base64, 12 bytes
  salt: string // base64, 16 bytes
  iterations: number
  kdf: 'PBKDF2-SHA256'
  cipher: 'AES-GCM-256'
}

export async function encryptPhrase(
  phrase: string[],
  passphrase: string,
  opts?: { iterations?: number },
): Promise<EncryptedBlob>

/** Returns the 24 words, in order. */
export async function decryptPhrase(
  blob: EncryptedBlob,
  passphrase: string,
): Promise<string[]>
```

The phrase crosses the crypto boundary as `string[]` everywhere — the grid needs words,
the mnemonic needs a joined string, and a `string`/`string[]` mismatch inside a component
is the easiest way to encrypt the wrong thing. Join exactly once, inside `phrase.ts`.

Wrong passphrase must reject with `VaultLockedError` (an `OperationError` from
`crypto.subtle.decrypt` is mapped to it). Do not leak the underlying error text.

```ts
export type StoredVault = {
  version: 1
  address: string
  network: Network
  createdAt: string
  blob: EncryptedBlob
}

export const vaultStorageKey = (playerAddress: string) =>
  `savborne.vault.v1.${normalizeAddress(playerAddress)}`

export function readVault(playerAddress: string): StoredVault | null
export function writeVault(playerAddress: string, vault: StoredVault): void
export function clearVault(playerAddress: string): void
```

`storage.ts` is keyed by the **player's wallet address**, not the vault address, because
the wallet address is known before the vault exists (onboarding step 2). Two players on a
shared device therefore keep separate vaults.

### 2.7 API surface

All routes are `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, and take the caller from
`X-Player-Address` (`PLAYER_HEADER`), exactly like the existing routes.

**Dynamic route params are a `Promise` in this Next version.** Both the handler and the
image function take `{ params }: { params: Promise<{ … }> }` and must `await params`.
This is the single most likely source of a runtime bug in tasks 9 and 16.

| Route | Body / query | Success | Failure |
|---|---|---|---|
| `POST /api/players` | `{ address, displayName, vaultAddress, network, backupVerified }` | `201 { player, vault, created }` | `400` bad input, `409 vault_taken` / `vault_exists` |
| `GET /api/vaults` | — | `200 { vault: VaultDto \| null }` | `401` |
| `POST /api/vaults` | `{ vaultAddress, network, backupVerified }` | `201 { vault }` | `409 vault_taken` / `vault_exists` / `has_vault` |
| `PATCH /api/vaults` | `{ backupVerified: true }` | `200 { vault }` | `404 no_vault` |
| `POST /api/transfers` | `{ direction, txHash, amountLuna, network }` | `202 { transfer, verified: bool }` | `403 backup_required`, `409 vault_required` / `network_mismatch`, `422` malformed |
| `GET /api/transfers` | — | `200 { transfers }` (list only, no chain calls) | `401` |
| `GET /api/transfers/[hash]` | — | `200 { transfer, changed }` | `404`, `503 rpc_unreachable` |
| `GET /api/receipts` | — | `200 { rows }` merged timeline | `401` |
| `POST /api/check-ins` | `{}` (body ignored) | existing shape + `shields`, `shieldsEarned` | `409 vault_required`, `503 rpc_unreachable` |

`VaultDto = { address, network, cardToken, backupVerifiedAt, createdAt }`. The server can
never return the phrase; it does not have it.

---

## 3. Tasks

### Task 1 — Schema

**Why:** everything else reads or writes these tables.

**Files**
- modify `supabase/FINAL-SCHEMA.sql`
- create `supabase/migrations/20261102000000_vault_and_savings_loop.sql` (the same
  statements, for the `supabase db push` record). The timestamp must sort after the
  existing `20261016000002_leaderboard_stats.sql`; the migrations are named
  `YYYYMMDDHHMMSS_slug.sql`.

**Depends on:** nothing.

**Contract**

`vaults` and `transfers` exactly as spec §5, plus:

```sql
alter table vaults enable row level security;
alter table transfers enable row level security;
-- No anon policies: only the service-role client touches these tables.
```

`players` gains `shields int not null default 1` and
`shields_earned int not null default 0`. (The spec's snippet is valid SQL — extra
alignment spaces are harmless. Copy the values, not the whitespace.)

`missions` seed:

```sql
insert into missions (key, name, description, type, xp_reward, bracket_required)
values ('first_deposit', 'Vault Opened', 'Make your first deposit into your vault.',
        'onetime', 20, null)
on conflict (key) do nothing;
```

`leaderboard_stats()` gains `has_vault boolean`. **A function's return type cannot be
changed by `create or replace`** — the file must `drop function if exists
leaderboard_stats();` first, then recreate it with an extra `left join vaults v on
v.player_address = p.address` and `(v.address is not null) as has_vault`. Keep
`security definer` and `set search_path = public`, and keep the existing revoke/grant.

`create_player_with_vault(...)`: a `security definer` plpgsql function so onboarding is
genuinely atomic (the Supabase JS client cannot span two inserts in one transaction).

```sql
create or replace function create_player_with_vault(
  p_address         text,
  p_display_name    text,
  p_vault_address   text,
  p_network         text,
  p_card_token      text,
  p_backup_verified boolean
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_existed boolean;
  v_player  players%rowtype;
  v_vault   vaults%rowtype;
begin
  select exists(select 1 from players p where p.address = p_address) into v_existed;

  insert into players (address, savings_account_address, display_name, current_balance_luna)
  values (p_address, p_vault_address, p_display_name, 0)
  on conflict (address) do nothing;

  select * into v_player from players where address = p_address;

  if exists (select 1 from vaults v
              where v.player_address = p_address and v.address <> p_vault_address) then
    raise exception 'vault_exists' using errcode = '23505';
  end if;

  insert into vaults (address, player_address, network, card_token, backup_verified_at)
  values (p_vault_address, p_address, p_network, p_card_token,
          case when p_backup_verified then now() else null end)
  on conflict (address) do nothing;

  select * into v_vault
    from vaults v
   where v.address = p_vault_address and v.player_address = p_address;

  if v_vault.address is null then
    raise exception 'vault_taken' using errcode = '23505';
  end if;

  return jsonb_build_object(
    'player', to_jsonb(v_player),
    'vault',  to_jsonb(v_vault),
    'created', not v_existed
  );
end;
$$;

revoke all on function create_player_with_vault(text,text,text,text,text,boolean) from public;
grant execute on function create_player_with_vault(text,text,text,text,text,boolean) to service_role;
```

Add the two new tables to the RLS enable list and bump the verification footer's
`rls_tables` expectation from **13 to 15**. There is no table-count column to change.

**Steps**
1. Edit `FINAL-SCHEMA.sql` in place, keeping the file's section banners and idempotent
   style. **Placement matters:** the two `create table` statements must land **before**
   the `alter table … enable row level security` block (around line 252), otherwise those
   `alter` statements reference tables that do not exist yet and the paste fails. The
   `players` columns go with the other `alter table players` lines; the two new
   `enable row level security` lines go inside the existing RLS block.
2. Copy the same statements into the migration file with a header comment naming the
   FINAL-SCHEMA as the source of truth.
3. Do **not** run either file. Print the path and ask the user to paste FINAL-SCHEMA.

**Done when**
- [ ] Both files exist and contain the same statements.
- [ ] `grep -c "create table if not exists vaults"` = 1 in each.
- [ ] Every statement is safe to re-run (no bare `create table`, no unguarded `alter`).

**Review focus:** the `drop function` before `leaderboard_stats`; the `raise exception`
paths in `create_player_with_vault` actually roll back the player insert.

**Commit:** `feat(db): vaults, transfers, shields, first_deposit mission`

---

### Task 2 — Test harness

**Why:** pure logic becomes load-bearing (streak bridging, transfer verification,
encryption). There is no test runner today.

**Files**
- modify `package.json`
- create `src/lib/game/streaks.test.ts` (temporary smoke test, replaced in task 6)

**Steps**
1. **Commit the pre-existing working-tree changes first.** `package.json`,
   `package-lock.json` and `tsconfig.json` already carry uncommitted edits this build
   depends on: `@nimiq/core@^2.22.0` and `"target": "ES2020"` (required for `100_000n`
   BigInt literals). Stage those three files only. **Do not stage
   `src/app/(tabs)/page.tsx`.**
2. `npm install -D tsx`
3. Add `"test": "node --import tsx --test"`. With no arguments Node discovers
   `**/*.test.ts` recursively and skips `node_modules` (verified on Node 26.5).
4. Add a one-assertion smoke test, e.g. in `src/lib/game/streaks.test.ts`:

   ```ts
   import { test } from 'node:test'
   import assert from 'node:assert/strict'
   import { LUNA_PER_NIM } from '@/lib/constants'

   test('tsx resolves the @/ alias', () => {
     assert.equal(LUNA_PER_NIM, 100_000)
   })
   ```

   Verified on this machine: `npx tsx --test <file>` resolves `@/` through
   `tsconfig.json`'s `paths`. Tests can therefore import real app modules, which is the
   point.
5. `npm test` must print `pass 1`.

**Done when**
- [ ] `npm test` green.
- [ ] `npx tsc --noEmit` green (test files are in `include`).

**Review focus:** no second framework, no config file, no `"type": "module"` flip (that
would break Next's CJS assumptions).

**Commit:** `test: add node:test harness with tsx`

---

### Task 3 — Network constants and address helpers

**Files**
- create `src/lib/vault/network.ts`, `src/lib/vault/address.ts`
- create `src/lib/vault/network.test.ts`

**Steps (TDD)**
1. Write failing tests: `explorerTxUrl('mainnet', h)` starts with
   `https://nimiq.watch/#`; testnet uses `test.nimiq.watch`; ids are 24 and 5;
   `isNetwork` rejects `'devnet'`; `sameAddress` treats `"NQ07 0000…"` and
   `"nq070000…"` as equal; `isPlausibleAddress` accepts a real address and rejects a
   truncated one; `shortenAddress` keeps the first and last two groups.
2. Implement. Comments cite the measured network ids and the `/tx/` 404.

**Done when**
- [ ] `npm test` green.
- [ ] No import of `@nimiq/core/web` or React in either file.

**Review focus:** `shortenAddress` never returns an ambiguous string; `isPlausibleAddress`
is not used as an authorisation check (it is a shape check only).

**Commit:** `feat(vault): network constants and address helpers`

---

### Task 4 — RPC client

**Files**
- create `src/lib/vault/rpc.ts`, `src/lib/vault/rpc.test.ts`

**Steps (TDD)**
1. Tests use a fake `fetchImpl` and assert the exact request body, plus:
   - `getAccount` returns `balanceLuna` from `result.data.balance`
   - `getHeadHeight` returns `result.data`
   - `getChainTransaction` returns `null` on
     `error.data.startsWith('Transaction not found')` and maps a full row
   - `getChainTransaction` throws `RpcError('rpc_error')` on any other error object
   - `getChainTransaction` throws `RpcError('unreachable')` when fetch rejects
   - `broadcastTransaction` returns `result.data`
   - `getBalance` is never called (assert on the recorded method names)
2. Implement `rpcCall(network, method, params, opts)` as the single internal call site.
3. Default `timeoutMs` 8 000 via `AbortSignal.timeout`.

**Done when**
- [ ] `npm test` green, including the "never calls getBalance" assertion.
- [ ] `npx tsc --noEmit` green.

**Review focus:** the not-found mapping is exact (`error.data`, not `error.message`);
`AbortSignal.timeout` is guarded for older WebViews? No — Nimiq Pay is Chromium-based and
already supports it; do not add a polyfill.

**Commit:** `feat(vault): json-rpc client for account, tx, head, broadcast`

---

### Task 5 — Testnet end-to-end script

**Why:** proves the whole signing/broadcast/inclusion path in a form anyone can re-run,
and it is the evidence the spec cites.

**Files**
- create `scripts/vault-e2e.mjs`
- modify `package.json`: `"vault:e2e": "node scripts/vault-e2e.mjs"`

**Behaviour**

1. Load `@nimiq/core` in Node (`import * as Nimiq`; `const mod = Nimiq.default ?? Nimiq`;
   `await mod()` if it is a function).
2. Generate a throwaway phrase → address.
3. Fund it from `POST https://faucet.pos.nimiq-testnet.com/tapit` with
   `application/x-www-form-urlencoded` body `address=<addr>&amount=100`.
4. Poll `getAccountByAddress` until balance > 0 (40 × 1.5 s).
5. Build a 1 NIM transfer to a second generated address with
   `TransactionBuilder.newBasic(sender, recipient, 100_000n, 0n, head, 5)` (1 NIM =
   100 000 Luna), `tx.sign(kp, undefined)`.
6. `broadcastTransaction(tx.toHex(), 'testnet')`; assert the returned hash equals
   `tx.hash()`.
7. Poll `getChainTransaction(hash, 'testnet')` every 2 s up to 60 times; assert
   `blockNumber` is a number and `executionResult === true`.
8. Print a table of each step with PASS/FAIL and exit non-zero on any FAIL.
9. Print the explorer URL via `explorerTxUrl('testnet', hash)`.

**Done when**
- [ ] `npm run vault:e2e` prints all PASS and exits 0.
- [ ] The printed explorer URL opens a real testnet transaction page.

**Review focus:** the script must never touch the repo or the database; it is a probe.
It reuses `src/lib/vault/rpc.ts`? No — `.mjs` cannot import TypeScript without a loader.
Duplicate the four RPC calls in the script and note that the duplication is deliberate so
the script has zero build dependencies.

**Commit:** `test(vault): testnet deposit/withdraw end-to-end script`

---

### Task 6 — Shields replace the grace rule

**Files**
- modify `src/lib/game/streaks.ts`
- create `src/lib/game/streaks.test.ts` (replace the task-2 smoke test)
- modify `src/app/api/check-ins/route.ts` only where it calls `computeStreak` (the full
  rewrite is task 11; here, adapt the call so the build stays green)

**Contract**

```ts
export type StreakInput = {
  checkInsAt: Date[]
  now: Date
  /** Current shield count from `players.shields`. */
  shields: number
  /** Lifetime 7-day blocks already awarded, from `players.shields_earned`. */
  shieldsEarned: number
}

export type StreakResult = {
  current: number
  isThisWeekFirstCheckIn: boolean
  shields: number
  shieldsEarned: number
}
```

`graceUsedThisWeek` is deleted from the result. Update every reader.

**Algorithm** (one pass, no week-boundary special cases)

1. Distinct UTC day strings, descending. If empty →
   `{ current: 0, isThisWeekFirstCheckIn: true, shields, shieldsEarned }`.
2. `cursor = utcDayOf(now)`; `current = 0`; `remaining = shields`.
3. If the most recent check-in day is not today, the leading gap is
   `utcDaysBetween(lastDay, now) - 1`; if `gap > remaining` → `current = 0`, break;
   else `remaining -= gap`, `current += gap`. (In practice the check-in route has already
   inserted today, so this branch is for direct callers and tests.)
4. Walk the days: for each `day`, `gap = utcDaysBetween(day, cursor)`. If `gap > 1`, let
   `missed = gap - 1`; if `missed > remaining` → break; else `remaining -= missed`,
   `current += missed`. Then `current += 1`, `cursor = day`.
5. `blocks = Math.floor(current / 7)`.
   `const gained = Math.max(0, blocks - shieldsEarned)`.
   `shields = Math.min(3, remaining + gained)`.
   `shieldsEarned = Math.max(shieldsEarned, blocks)`.

**Tests that must exist and pass**

| Case | Expectation |
|---|---|
| no check-ins | `current 0`, shields unchanged |
| 3 consecutive days, 1 shield | `current 3`, `shields 1` |
| 7 consecutive days, 1 shield | `current 7`, `shields 2`, `shieldsEarned 1` |
| 7 days, 3 shields | `shields 3` (cap), `shieldsEarned 1` |
| 21 days, 1 shield | `shields 3` (cap), `shieldsEarned 3` |
| one missed day, 1 shield | bridged: `shields 0`, `current` includes the missed day |
| one missed day, 0 shields | reset at the gap |
| two missed days, 1 shield | reset at the gap |
| 14-day streak, then reset, then 7 days | second 7-day block awards **nothing** (`shieldsEarned` stays 2) — the cap is lifetime, and this is the anti-farm rule |
| gap crossing a week boundary | bridged (the old week restriction is gone) |

**Steps**
1. Write all tests first; watch them fail against the old implementation.
2. Rewrite `computeStreak`. Delete `hadCheckInThisWeek`'s grace coupling; keep
   `alreadyCheckedInToday` and `alreadyCheckedInThisWeek` untouched.
3. In the check-in route, pass `player.shields` and `player.shields_earned`, and write
   `streak.shields` / `streak.shieldsEarned` into the update. Remove
   `grace_used_this_week`.

**Done when**
- [ ] `npm test` green with all ten cases.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` green.

**Review focus:** the leading-gap branch; earnings use `remaining + gained`, not original
`shields + gained` (otherwise shields spent this check-in are refunded).

**Commit:** `feat(game): streak shields replace the weekly grace`

---

### Task 7 — `POST /api/players` creates player + vault atomically

**Files**
- modify `src/app/api/players/route.ts`
- create `src/lib/vault/dto.ts` (`toVaultDto`)
- modify `src/lib/database.types.ts` (add `VaultRow`, `TransferRow`, `vaults`, `transfers`;
  add the shields columns)

**Behaviour**

Body `{ address, displayName, vaultAddress, network, backupVerified }`.

1. Validate: address plausible, `displayName` trimmed 1–32, `vaultAddress` plausible,
   `network` in enum, `backupVerified` is a boolean.
2. `cardToken = crypto.randomUUID()` (server-minted; a client-minted token buys nothing
   and lets two clients collide).
3. Call `create_player_with_vault(...)` via `db.rpc(...)`.
4. **Map the result to the DTO.** The function returns raw snake_case jsonb
   (`backup_verified_at`, `card_token`, …). Every route serializes the same shape:

   ```ts
   function toVaultDto(row: VaultRow): VaultDto {
     return {
       address: row.address,
       network: row.network,
       cardToken: row.card_token,
       backupVerifiedAt: row.backup_verified_at,
       createdAt: row.created_at,
     }
   }
   ```

   Put `toVaultDto` in `src/lib/vault/dto.ts` and import it in `/api/players` and
   `/api/vaults`, so the two endpoints cannot drift into different shapes for one resource.
5. Map a Postgres error whose message contains `vault_taken` → `409 { error: 'vault_taken'
   }`; `vault_exists` → `409 { error: 'vault_exists' }`.
6. Return `{ player, vault: toVaultDto(vault), created }`.

The old `savingsAddress` and `initialBalanceLuna` fields are removed from the contract.
A caller still sending them is ignored, not rejected — the client ships in the same
build, but an in-flight tab must not 400.

`players.savings_account_address` is written from `p_vault_address` inside the function.

**Done when**
- [ ] `npx tsc --noEmit` green.
- [ ] `npm run build` green.
- [ ] Manual SQL check by the user: existing player + new vault returns `created: false`
      and does not duplicate the player row.

**Review focus:** `crypto.randomUUID()` availability in the Node runtime (global since
Node 19 — fine); the route does not catch the `rpc` error generically, because the
message is the only signal for which 409 to return.

**Commit:** `feat(api): create player and vault in one atomic call`

---

### Task 8 — `/api/vaults` for existing players and recovery

**Files**
- create `src/app/api/vaults/route.ts`

**Behaviour**

- **GET** — load `vaults` by `player_address = header`; return `{ vault: null }` or
  `toVaultDto(row)`. Used by the app to decide between the vault screen and the creation
  ceremony, and by recovery to confirm that a phrase the user re-entered derives the
  registered address.
- **POST** — body `{ vaultAddress, network, backupVerified }`. If the player already has a
  vault → `409 has_vault`. Insert; on unique violation of `address` → `409 vault_taken`.
  Returns `201`.
- **PATCH** — body `{ backupVerified: true }`. Sets `backup_verified_at = now()` where it
  was null, and returns the DTO. This is the only mutation allowed after creation.

**Done when**
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` green.
- [ ] `GET` for a player with no vault returns `200 { vault: null }`, not 404.

**Review focus:** POST never accepts a `playerAddress` from the body — it comes from the
header only. PATCH cannot change the address or network.

**Commit:** `feat(api): vault registration for existing players`

---

### Task 9 — Transfer verification and the transfers API

**Files**
- create `src/lib/vault/verify.ts`, `src/lib/vault/verify.test.ts`
- create `src/lib/vault/settle.ts`
- create `src/app/api/transfers/route.ts`
- create `src/app/api/transfers/[hash]/route.ts`

**Steps (TDD for `verify.ts`)**

1. Write `verify.test.ts` first. Cases, one per reason plus success, for both directions:
   - wrong network id beats everything else
   - `executionResult: false` → `execution_failed`
   - deposit to the wrong recipient → `wrong_recipient`
   - withdrawal from the wrong sender → `wrong_sender`
   - withdrawal to anything other than `players.address` → `wrong_recipient`
   - value mismatch → `wrong_amount`
   - a correct deposit and a correct withdrawal → `{ ok: true }`
   - addresses differing only by spaces/case still pass
2. Implement `verifyClaim` in the documented order.

**`settle.ts`**

```ts
export type SettleOutcome = {
  transfer: TransferRow
  changed: boolean
  balanceLuna: number | null
}

export async function pollAndSettle(
  db: SupabaseClient,
  transfer: TransferRow,
  opts?: { now?: Date; rpc?: RpcOptions },
): Promise<SettleOutcome>
```

Logic:

1. **Guard on state first.** If `transfer.status !== 'pending'`, return `{ transfer,
   changed: false, balanceLuna: null }` without touching the chain. A settled transfer must
   never be re-settled, because re-running the side effects re-stamps
   `steady_hand_started_at` and `last_withdrawal_at` on every poll.
2. `getChainTransaction(transfer.tx_hash, network)` where network comes from the vault row.
   An `RpcError` propagates — the route returns 503 and nothing is written.
3. `null` → if `now - created_at > 120 s`, set `status='expired'`,
   `failure_reason='not_included'`; else leave pending. `changed` reflects a write.
4. Present → `verifyClaim(...)`. Failure → `status='expired'`, `failure_reason=reason`.
5. Success → update with a **conditional write**:

   ```ts
   const { data: updated } = await db
     .from('transfers')
     .update({
       status: 'included',
       block_height: tx.blockNumber,
       amount_luna: tx.valueLuna,   // from chain, never from the claim
       fee_luna: tx.feeLuna,        // from chain
       confirmed_at: now.toISOString(),
     })
     .eq('id', transfer.id)
     .eq('status', 'pending')       // makes concurrent polls agree on one winner
     .select()
     .maybeSingle()

   if (!updated) return { transfer, changed: false, balanceLuna: null }
   ```

   **Only now** run the side effects, because this call won the race:
   - read the vault balance with `getAccount`
   - `players.current_balance_luna`, `players.bracket = bracketFromLuna(balance)`
   - unlock items: load `player_items` keys, call
     `itemsToUnlock(new Set(owned), newBracket)`, insert one row per returned key
     (`on conflict do nothing`). Spec §6.2.5 requires this and it is the same rule the
     check-in route uses.
   - `direction='out'`: `withdrawal_in_progress = true`,
     `last_withdrawal_at = confirmed_at`, `steady_hand_started_at = now`, and set
     `revoked_at = now` on `week_warrior` and `iron_saver` rows in `player_badges` that are
     still live.
   - `direction='in'`: **no XP.** The `first_deposit` mission is evaluated at the next
     check-in (§6, spec delta D-1). Do not award it here.

`pollAndSettle` is the only place that writes `included`. Every route calls it.

**`POST /api/transfers`**

1. Validate header, then body: `direction` in `('in','out')`, `txHash` matches
   `/^[0-9a-f]{64}$/i`, `amountLuna` a positive safe integer, `network` in enum.
   Anything else → `422`. This is the only 422 in the route.
2. Load player (`404`) and vault (`409 vault_required`).
3. `direction === 'in' && vault.backup_verified_at === null` → `403 backup_required`.
4. `network !== vault.network` → `409 network_mismatch`.
5. Insert `{ player_address, vault_address, direction, amount_luna, tx_hash,
   status: 'pending' }`. On unique violation of `tx_hash`, load the existing row and:
   - **owner is the caller** → return `200` with it (idempotent retry). `202` is
     documented for a *new* claim; `200` for a replay.
   - **owner is someone else** → `409 { error: 'tx_hash_conflict' }` and **never serialize
     the row.** Deposit hashes are public on chain, so without this check anyone could
     pre-claim a hash and read back another player's transfer.
6. `pollAndSettle` immediately (it may already be included). Catch `RpcError` → return
   `202` with `verified: false` and no error, because a pending transfer is a valid state,
   not a failure.
7. Return `202 { transfer, verified }`.

**`GET /api/transfers`** — list the caller's transfers, newest first, limit 50. No chain
calls.

**`GET /api/transfers/[hash]`** — load by hash + caller (`404` if not theirs), call
`pollAndSettle`, return `{ transfer, changed }`. `RpcError` → `503 { error:
'rpc_unreachable', reason }`.

**Done when**
- [ ] `npm test` green (verify cases).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` green.
- [ ] Posting the same hash twice as the same player returns the same transfer row, not a
      duplicate.
- [ ] Posting a hash owned by another player returns `409` and no row data.

**Review focus:** the 422/403/409 boundaries; `amount_luna` always overwritten from chain
on settle; the conditional `status='pending'` update is what prevents double side effects —
the early guard alone is not enough because two requests can both read `pending`.

**Commit:** `feat(vault): chain-verified transfers with pending/included/expired`

---

### Task 10 — `/api/check-ins` reads the chain

**Files**
- modify `src/app/api/check-ins/route.ts`
- modify `src/lib/game/missions.ts` (add `'first_deposit'` to the `MissionKey` union, add
  `hasIncludedDeposit` to `CheckInSnapshot`, emit the mission)
- modify `src/lib/constants.ts` (add `XP_VALUES.firstDeposit = 20`)
- modify `src/app/api/players/me/route.ts` (expose `shields`, `shieldsEarned`,
  `hasVault`)
- modify `src/app/api/profile/route.ts` (expose `shields`, `shieldsEarned`, `cardToken`)
- modify `src/lib/usePlayerSession.ts` (add the same fields to `PlayerMe`, or the UI cannot
  read them)

**Behaviour**

1. Drop the body parse entirely. A body is ignored. Keep `X-Player-Address`.
2. Load player (`404`). Load `vaults` by `player_address`.
   No vault → `409 { error: 'vault_required' }`.
3. `getAccount(vault.address, vault.network)`.
   `RpcError` → `503 { error: 'rpc_unreachable', reason }`. **No fallback.**
4. `balanceLuna = account.balanceLuna`. Insert the check-in with it.
5. Withdrawal detection: keep the existing balance-delta inference (a non-custodial vault
   can be drained outside Savborne, and the delta is the only trace) **or** an included
   `out` transfer in the current week. Both feed `anyWithdrawalThisWeek`.
6. `evaluateForCheckIn` gains `hasIncludedDeposit: boolean`; when true and not previously
   credited, award `{ key: 'first_deposit', xp: XP_VALUES.firstDeposit, isOnetime: true }`.
   Compute it as:

   ```ts
   const { count } = await db
     .from('transfers')
     .select('id', { count: 'exact', head: true })
     .eq('player_address', address)
     .eq('direction', 'in')
     .eq('status', 'included')
   const hasIncludedDeposit = (count ?? 0) > 0
   ```

   `status = 'included'` is not optional: a `pending` claim must never unlock the mission.
7. Shields: read `player.shields` / `player.shields_earned`, pass to `computeStreak`,
   write both back. Remove the `grace_used_this_week` write.
8. Return the existing aggregate plus `shields` and `shieldsEarned`.

**Done when**
- [ ] A player with no vault gets `409 vault_required`.
- [ ] A body containing `balanceLuna: 999999999999` changes nothing (assert in a scratch
      request; the value written equals the chain balance).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` green.

**Review focus:** step 3 has no `try/catch` that falls back to a stored balance; the
mission snapshot is built from the chain balance, not the previous row.

**Commit:** `feat(api): check-in reads the vault balance from chain`

---

### Task 11 — Phrase, encryption, and browser signing

**Files**
- create `src/lib/vault/phrase.ts`, `src/lib/vault/errors.ts`
- create `src/lib/vault/crypto.ts`, `src/lib/vault/crypto.test.ts`
- create `src/lib/vault/storage.ts`

**Contract**

```ts
// phrase.ts — browser only, WASM loaded lazily
type NimiqWeb = typeof import('@nimiq/core/web')

export async function loadNimiq(): Promise<NimiqWeb>
export async function generatePhrase(): Promise<string[]>
export async function phraseToMnemonic(phrase: string[]): string // phrase.join(' ')
export async function deriveVaultAddress(phrase: string[]): Promise<string>
export async function addressFromPhrase(phrase: string[]): Promise<string>
export async function signTransfer(args: {
  phrase: string[]
  recipient: string // user-friendly NQ address
  valueLuna: number
  feeLuna: number
  validityStartHeight: number
  networkId: number
}): Promise<{ hash: string; hex: string }>
```

`loadNimiq` memoises a single `import('@nimiq/core/web')` promise and calls
`mod.default()` once. The module must be type-only imported at the top
(`type NimiqWeb = typeof import('@nimiq/core/web')`) so the 1.06 MB WASM never enters a
server bundle.

`signTransfer` must convert the recipient **before** building:

```ts
const mod = await loadNimiq()
const keyPair = mod.KeyPair.derive(
  mod.MnemonicUtils.mnemonicToExtendedPrivateKey(phraseToMnemonic(args.phrase)).privateKey,
)
const recipient = mod.Address.fromUserFriendlyAddress(args.recipient) // NOT the string
const tx = mod.TransactionBuilder.newBasic(
  keyPair.toAddress(),
  recipient,
  BigInt(args.valueLuna),
  BigInt(args.feeLuna),
  args.validityStartHeight,
  args.networkId,
)
tx.sign(keyPair, undefined) // second arg = "no inner key", required by the web typings
```

Passing the user-friendly string straight to `newBasic` throws
`expected instance of Address` at runtime even where it type-checks.

**`crypto.test.ts`** (uses a low iteration count so it runs in milliseconds):

- round-trip returns the same phrase
- wrong passphrase rejects with `VaultLockedError`
- tampering with `ciphertext` rejects
- two encryptions of the same phrase produce different `iv` and `salt`
- the blob stores `kdf`, `cipher`, and `iterations`

**Done when**
- [ ] `npm test` green.
- [ ] `npx tsc --noEmit` green.
- [ ] `grep -r "@nimiq/core/web" src/lib/vault/phrase.ts` shows only a dynamic `import()`
      and a `typeof import()` type.

**DEVICE:** `/vault-spike` already proved phrase → address → sign in the WebView. Re-prove
through `phrase.ts` in the device pass, because the module boundary changed.

**Commit:** `feat(vault): phrase derivation, encryption at rest, offline signing`

---

### Task 12 — Onboarding: five steps, backup gate, passphrase

**Files**
- modify `src/app/setup/page.tsx`
- create `src/components/vault/PhraseCeremony.tsx`
- create `src/components/vault/BackupQuiz.tsx`
- create `src/components/vault/PassphraseField.tsx`

**Flow**

| Step | Screen | Writes |
|---|---|---|
| 1 | Welcome — one sentence of non-custodial truth | — |
| 2 | Create vault | localStorage: none yet |
| 3 | Backup gate: show 24 words → acknowledge → quiz 4 positions → set passphrase | localStorage: encrypted vault |
| 4 | Privacy notice, corrected for the vault | — |
| 5 | Character name | `POST /api/players` |

Step 3 detail:

- words in a 4×6 grid, numbered 1–24, `font-mono`, selectable text
- **no copy-to-clipboard button** — the clipboard is shared with other apps
- "I have written these down" checkbox gates Continue
- quiz: four random 1-based indices (distinct), four inputs, case-insensitive compare,
  all four must match before Continue
- passphrase: minimum 8 characters, confirm field, no strength meter (a fake score is
  worse than a rule)
- on finish: `encryptPhrase(phrase, passphrase)` → `writeVault(walletAddress, …)`;
  then drop the plaintext phrase and passphrase from component state

Step 5 sends `{ address, displayName, vaultAddress, network, backupVerified: true }`.

**After a `201`, write the session with the vault in the savings slot:**

```ts
writeSession({ playerAddress: address, savingsAddress: vaultAddress, displayName })
```

`Session` already has exactly these three fields. This matters because
`src/app/(tabs)/page.tsx` — the file this build must not touch — reads
`getBalance(session.savingsAddress)`. Pointing that field at the vault makes the existing
home screen display the real vault balance with **zero edits**, and its check-in POST's
`balanceLuna` is ignored by task 10's server. Do not rename the field.

**Failure paths**

- `409 vault_exists` → show "This wallet already has a vault. Open the Vault tab to
  restore it." Do **not** `router.push('/vault')` yet — that route is created in task 13,
  one commit later. The message is the whole behaviour here.
- `listAccounts()` returns no account → "Connect a wallet in Nimiq Pay."

**Done when**
- [ ] Typing the name and submitting creates exactly one player and one vault (user checks
      in the SQL editor).
- [ ] Reloading mid-flow restarts at step 1 without a half-written player (nothing is
      written before step 5).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` green.

**Review focus:** the phrase never reaches `console.log`, a URL, or the network; the quiz
indices are memoised so a re-render does not reshuffle them; the passphrase is cleared on
unmount.

**Commit:** `feat(setup): five-step onboarding with vault backup gate`

---

### Task 13 — Existing-player vault creation and the vault screen

**Files**
- create `src/app/setup/vault/page.tsx`
- create `src/app/(tabs)/vault/page.tsx`
- create `src/lib/vault/transfers.ts`
- create `src/lib/vault/useVault.ts`
- create `src/components/VaultGuard.tsx`
- modify `src/lib/nimiq.ts` (add the deposit wrapper and hash normaliser)
- modify `src/app/(tabs)/layout.tsx` (mount `VaultGuard`)
- modify `src/components/BottomTabBar.tsx` (6th tab, inserted before Profile; add
  `data-tour` anchors, see task 17)

**`src/lib/nimiq.ts` additions**

The file's own header says every Nimiq interaction goes through it. Do not call
`sendBasicTransaction` from a component.

```ts
/** Sends `valueLuna` from the player's wallet to the vault. Returns the tx hash. */
export async function sendDeposit(args: {
  recipient: string
  valueLuna: number
}): Promise<string>

/**
 * `sendBasicTransaction` is documented as returning "the serialized transaction"
 * but has been observed returning the hash. Accept both: 64 hex is a hash,
 * anything longer is deserialized and hashed.
 */
function normalizeTxHash(raw: string): Promise<string>
```

`normalizeTxHash` imports `@nimiq/core/web` lazily and only on the long-hex branch, so the
common path pays nothing for it.

**`/setup/vault`** reuses `PhraseCeremony` then calls `POST /api/vaults`. On success it
routes to `/vault`. It never touches the player row, so name and history survive.

**`VaultGuard`** — spec §6.6 says a player with no vault is sent to the creation flow *on
open*, and the home screen cannot be edited. So the guard is a client component mounted in
`src/app/(tabs)/layout.tsx`:

```tsx
'use client'
// reads the session; does nothing when there is none (home owns that redirect).
// when a session exists, GET /api/vaults once per mount:
//   vault === null -> router.replace('/setup/vault')
//   network failure -> render nothing (never block the app on a failed probe)
```

It must not loop: after `replace`, the guard observes `pathname === '/setup/vault'` (which
is outside the tabs group) and unmounts. It also must not fire while the user is in the
middle of onboarding.

**`/vault`** first resolves three states, because the local key and the server row can
disagree:

| Local storage | `GET /api/vaults` | Screen |
|---|---|---|
| no vault | `null` | "Create your vault" CTA → `/setup/vault` |
| no vault | vault | "This wallet has a vault. Restore it from your 24 words." → restore flow |
| vault | vault, same address | the full vault screen |
| vault | vault, different address | hard error: local data belongs to another vault; offer clear-and-restore |

Then, top to bottom:

1. **Balance** — live `getAccount(vault.address, vault.network)`; skeleton while loading;
   on `RpcError` a retry card with the reason, never a stale number.
2. **Streak and shields** — the `shields` count from `/api/players/me`, rendered as a strip
   of three ⟡ with the live ones filled. `data-tour="shields"`.
3. **Network badge** — when `hostNetwork()` (note the name — the facade exports
   `hostNetwork`, not `getHostNetwork`) disagrees with `vault.network`, a persistent amber
   badge and deposits/withdrawals disabled. Mainnet and testnet never mix.
4. **Empty state** — balance 0 and no transfers: a first-deposit CTA, not a zero.
5. **Deposit** — amount in NIM, default `1`, converted with `Math.floor(nim *
   LUNA_PER_NIM)`; first deposit shows the one-time loss warning before the wallet prompt.
   `data-tour="deposit"` on the submit button. **Gate the button on
   `vault.backupVerifiedAt !== null` before any broadcast** — the server's `403` arrives
   after the wallet has already sent the money, so a client-side gate is the only way to
   avoid stranding a deposit with no receipt. The server check stays as defence in depth.
   Then `sendDeposit(...)` → `POST /api/transfers` → poll.
6. **Grow** — the same form with the label "Top up", plus a 30-day sparkline from
   `GET /api/transfers` and bracket progress.
7. **Withdraw** — amount, destination shown as the player's identity address
   (`read-only`, with a line explaining why it is fixed), passphrase field, then
   `decryptPhrase` → `getHeadHeight` → `signTransfer` → `broadcastTransaction` →
   `POST /api/transfers` → poll.
8. **Footer links** — Receipts, Share card, Backup settings. `data-tour="vault"` on the
   card that wraps the balance.

**Broadcast-then-POST is two steps, and the second can fail.** Money leaves before the
server knows about it. So both deposit and withdraw must:

1. write `{ txHash, direction, amountLuna, network, at }` to
   `localStorage['savborne.pending.v1.<playerAddress>']` **before** calling
   `POST /api/transfers`;
2. clear the entry on a 2xx, or on a `4xx` that will never succeed (403/409/422);
3. retry the POST on next mount and on `online` for anything left behind.

Without this, a failed POST leaves a withdrawal with no `transfers` row — no receipt, no
badge revocation, no `withdrawal_in_progress` flag — which is exactly the silent failure
this build exists to prevent.

**`transfers.ts`**

```ts
export type TransferView = {
  id: number
  direction: 'in' | 'out'
  amountLuna: number
  feeLuna: number
  txHash: string
  status: 'pending' | 'included' | 'expired'
  blockHeight: number | null
  failureReason: string | null
  explorerUrl: string | null
}

export async function submitTransfer(args: {
  playerAddress: string
  direction: 'in' | 'out'
  txHash: string
  amountLuna: number
  network: Network
}): Promise<{ transfer: TransferView; verified: boolean }>

export async function pollTransfer(args: {
  playerAddress: string
  txHash: string
  onUpdate?: (t: TransferView) => void
  intervalMs?: number
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<TransferView>
```

`pollTransfer` stops on `included` or `expired`, on abort, or after `timeoutMs` (default
150 s — longer than the server's 120 s expiry so the server's verdict always wins). It
never invents success.

**`useVault.ts`** exposes
`{ vault, status, balanceLuna, pending, error, refresh, deposit, withdraw, lockState }`.
`lockState` is `'locked' | 'unlocked' | 'no_vault'` — the decrypted key is held in a
`useRef`, never in `localStorage`, and is dropped on unmount.

**Done when**
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` green.
- [ ] Six tabs fit at 360 px without wrapping (check the built page in the browser at
      360×640).
- [ ] Every fail state in spec §10 is reachable in the UI.
- [ ] A session whose player has no vault lands on `/setup/vault` after one navigation,
      with no redirect loop.
- [ ] Killing the network between broadcast and POST leaves a retry entry in
      localStorage, and reloading with the network back creates the transfer row.

**DEVICE:** the wallet-signed deposit and the in-browser withdrawal are the only paths
that cannot be exercised here.

**Review focus:** amount conversion rounds down; the withdraw button is disabled until the
passphrase decrypts; the destination is rendered from `player.address`, not typed by the
user; polling is aborted on unmount; the pending entry is written **before** the POST, not
after.

**Commit:** `feat(vault): deposit, grow, withdraw UI with fail states`

---

### Task 14 — Receipts

**Files**
- create `src/app/api/receipts/route.ts`
- create `src/app/receipts/page.tsx` (outside the tabs group on purpose: receipts are
  reached from the vault screen, not from a 7th tab)

**Behaviour**

- Run the pending sweep: up to 5 of the caller's `pending` transfers older than 10 s are
  re-checked with `pollAndSettle`. A failure in one does not fail the response; the row
  simply stays pending.
- Merge:
  - transfers: `{ kind: 'transfer', id, direction, amountLuna, feeLuna, txHash, status,
    blockHeight, failureReason, explorerUrl, at }`
  - check-ins: `{ kind: 'snapshot', balanceLuna, at }`
- Sort descending by `at`, limit 200.

**UI**

- Included transfer: hash (shortened), block height, amount, fee, "View on explorer" →
  `#` link, network-correct.
- Pending: hash, "Pending — not yet confirmed", **no receipt link**, a "Check again" button
  that triggers `GET /api/transfers/[hash]`.
- Expired: "Failed", the `failure_reason` in human words, and — because `expired` is
  terminal and polling it again is a no-op — a **"Try again"** action that opens the deposit
  or withdraw form with the amount pre-filled, ready to sign a new transaction. Never
  re-submit the same hash.
- Snapshot: "Balance check-in", amount, **no hash and no link**, visually flatter than a
  transaction row.

**Done when**
- [ ] A snapshot row never renders an explorer link (assert by inspection and by the DTO
      having no `txHash` key).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` green.

**Review focus:** the two row types cannot be mistaken for each other; the sweep is
bounded.

**Commit:** `feat(receipts): merged timeline of transfers and balance snapshots`

---

### Task 15 — "Verified saver" on the leaderboard

**Files**
- modify `src/app/api/leaderboards/route.ts`
- modify `src/app/(tabs)/leaderboard/page.tsx`

**Behaviour**

- `leaderboard_stats()` now returns `has_vault`. The route maps it to `verifiedSaver` and
  includes it in every row.
- The leaderboard renders a small ⟡ marker with an accessible label ("Verified saver —
  funds held in their own vault") next to the name. It is **not** a ranking input.
- A player with no vault shows no marker; nothing else changes.

**Done when**
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` green.
- [ ] The marker appears for a player with a vault and not for one without (user-checked
      against two rows).

**Review focus:** the marker is derived from the mapping, never from a client flag; the
route still exposes no addresses.

**Commit:** `feat(leaderboard): verified-saver marker from vault mapping`

---

### Task 16 — Public flex card and OG image

**Files**
- create `src/app/card/[token]/page.tsx`
- create `src/app/card/[token]/opengraph-image.tsx`
- modify `src/components/VersionGate.tsx` (exempt `/card/`)
- modify `src/app/(tabs)/profile/page.tsx` (Share card entry)

**Page**

- Server component. `supabaseAdmin()` reads `vaults` by `card_token`, then the player.
- **Select explicit columns.** `select('address, player_address, network, backup_verified_at')`
  and `select('address, display_name, level, streak_current, bracket, shields')` — never
  `select('*')`, so a balance cannot leak into the card by accident.
- **`params` is a `Promise` in this Next version.** The signature is
  `async function Page({ params }: { params: Promise<{ token: string }> })` and the first
  line is `const { token } = await params`. A non-awaited `params.token` is `undefined`
  at runtime and the 404 path will never fire.
- Unknown token → `notFound()` (404). No enumeration, no list endpoint.
- Shows: display name, level, streak + shields, bracket, shortened vault address as the
  "verified saver" marker.
- **Never the balance, never the full address, never the player's wallet address.**
- `export const dynamic = 'force-dynamic'` so a shared link is never a stale build-time
  snapshot.

**Share entry**

The Profile screen gets the token from `/api/profile` (`cardToken`, added in task 10 — a
player with no vault gets `null`). The Share row copies `${window.location.origin}/card/
${cardToken}` (with a `navigator.share()` path where available) and is disabled with
"Create a vault to share your card" when the token is null. The card page never mints a
token: tokens are created once, server-side, at vault creation.

**OG image**

- `export const alt`, `size = { width: 1200, height: 630 }`, `contentType = 'image/png'`.
- The image function has the same promise-shaped params:
  `async function Image({ params }: { params: Promise<{ token: string }> })`.
- `ImageResponse` from `next/og`, default font (no asset fetch, stay under the 500 KB
  bundle limit), background `#152420`, mint accent, Silkscreen-like letter spacing.
  If the build errors about a missing font, put a Silkscreen `.ttf` in `assets/` and read
  it once at module scope with `readFile` (the documented pattern) — do not fetch a font at
  request time.
- Params make it request-time automatically; add `export const dynamic =
  'force-dynamic'` anyway so it cannot be statically cached per token.
- Same data as the page, same omissions.

**VersionGate**

Replace the single spike constant with a prefix list:

```ts
const PUBLIC_PREFIXES = ['/card/']
```

and treat the spike path the same way until task 18 deletes it. `isInsideNimiqPay()`
false → render children for public prefixes instead of the "open in Nimiq Pay" notice.

**Done when**
- [ ] `/card/<real-token>` renders outside Nimiq Pay in a normal browser.
- [ ] `/card/not-a-token` returns 404.
- [ ] The OG image URL returns `image/png` (check the response headers).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` green.

**Review focus:** no `balance` field is selected from the database at all (select explicit
columns, never `*`), so it cannot leak by accident.

**Commit:** `feat(card): public flex card with generated OG image`

---

### Task 17 — Guided tour, level-up sound, haptics

**Files**
- create `src/components/VaultTour.tsx`
- create `src/lib/haptics.ts`, `src/lib/level-up-sound.ts`
- modify `src/app/(tabs)/layout.tsx` (mount the tour)
- modify `src/lib/usePlayerSession.ts` (fire the level-up effect — see Wiring)
- modify `src/components/BottomTabBar.tsx` (`data-tour="home"` on the Home tab)
- modify `src/app/(tabs)/profile/page.tsx` (re-open the tour, `data-tour="shields"`)

**Tour**

- Five steps, custom overlay, no library: `Your vault → Streak & shields → Check in →
  XP, level, bracket → Deposit`.
- **Anchors that actually exist.** Home is off-limits, so steps 3 and 4 cannot spotlight
  Home's check-in button or XP bar. They anchor the **Home tab icon** in `BottomTabBar`
  instead, with captions that point rather than pretend:

  | Step | Anchor | Caption |
  |---|---|---|
  | 1 | `data-tour="vault"` on `/vault`'s balance card | "This is your vault. The NIM in it is yours alone." |
  | 2 | `data-tour="shields"` on `/vault`'s shield strip | "Miss a day and a shield covers you." |
  | 3 | `data-tour="home"` on the Home tab | "Check in here every day to keep the streak." |
  | 4 | `data-tour="home"` on the Home tab | "XP, level and bracket grow from checking in." |
  | 5 | `data-tour="deposit"` on the deposit button | "Start here. Your first deposit opens the vault." |

  If a target element is missing, centre the card instead of crashing. The tour starts on
  `/vault`, so steps 1, 2 and 5 always have their anchor; steps 3 and 4 always do.
- Skippable at every step; "Skip" writes the flag and closes.
- localStorage key `savborne.tour.v1`. Shown once, on first arrival at `/vault`.
- Re-openable from Profile → "Show tour again" (clears the flag and routes to `/vault`).

**Sound**

```ts
// level-up-sound.ts
export function playLevelUp(): void
```

- `AudioContext` created lazily on first call (autoplay policy); resume if suspended.
- Four notes, ascending, square wave with a short attack/decay envelope:
  e.g. `[523.25, 659.25, 783.99, 1046.5]` Hz, 90 ms each, 20 ms overlap.
- Total under 400 ms. No asset files.
- Wrapped in `try/catch`; a blocked context is silent, not an error.

**Haptics**

```ts
// haptics.ts
export function buzz(pattern: number | number[] = 40): void
```

`navigator.vibrate?.(pattern)`, guarded. Called once alongside `playLevelUp`, never on
other interactions.

**Wiring — inside `usePlayerSession`, not in a layout**

The check-in response reports `leveledUp`, but that response is consumed by the **home
screen**, which this build must not edit. A layout-level watcher would never see it.
Instead, put the trigger in `src/lib/usePlayerSession.ts`, which every screen already
imports and which task 10 already modifies:

```ts
// module scope, shared by every hook instance
const reportedLevel = new Map<string, number>()

// inside the hook, whenever a fresh PlayerMe arrives
const previous = reportedLevel.get(me.address)
if (previous !== undefined && me.level > previous) {
  playLevelUp()
  buzz([30, 40, 30])
}
reportedLevel.set(me.address, me.level)
```

Module scope is what makes it fire **once**: the layout, Home and Profile each hold their
own `usePlayerSession` instance, and a component-level ref would fire two or three times
for the same level. The map also suppresses a replay when a screen remounts at the same
level.

**Done when**
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` green.
- [ ] Nothing else in the app calls `playLevelUp` or `buzz`.
- [ ] Levelling up plays exactly one arpeggio even with three mounted hook instances.

**DEVICE:** sound and vibration.

**Review focus:** the `AudioContext` is never constructed at module scope; the tour never
traps focus with no escape; the level watcher never fires on first load (previous
`undefined` must stay silent).

**Commit:** `feat(ux): guided tour, level-up chiptune, haptics`

---

### Task 18 — README, footer, cleanup, and the full gate

**Files**
- modify `README.md` (or `docs/Savborne-spec.md`'s checkpoint section, whichever carries
  the stale date — check both)
- modify `src/app/(tabs)/profile/page.tsx` (contact footer + backup settings entry)
- modify `src/components/VersionGate.tsx` (delete the spike bypass)
- delete `src/app/vault-spike/`

**Work**

1. **Checkpoint date** → the real date and the real state ("vault live on testnet, device
   pass pending" until it is not).
2. **Non-custodial disclosure** — rewrite from "only reads the balance" to: Savborne never
   holds your NIM; a 24-word phrase generated on your device controls the vault; the
   server can read the vault address on chain but cannot move funds; if you lose the
   phrase and your device, the NIM is unrecoverable.
3. **Contact** `damilareogooluwade@outlook.com` in a real in-app footer on Profile:
   `mailto:` link, plus "Privacy" and "Show tour again".
4. **Backup settings** on Profile: "Show recovery phrase" (passphrase required),
   "Change passphrase" (requires the current passphrase, re-encrypts the same phrase), and
   "Restore from phrase" (enter 24 words → derive → `GET /api/vaults` → if the derived
   address matches, re-encrypt locally; if it does not, say so and write nothing).
5. **Item 12** — record in the commit message that `.bak` was added in `64a9485` and
   removed in `4f701f1`; nothing to fix.
6. Remove the spike page and the bypass. `VersionGate` keeps only `PUBLIC_PREFIXES`.

**Full gate**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run vault:e2e
```

Plus the art scripts listed in `docs/HANDOFF-PROMPT.md` (unchanged by this build; run them
only if the art pipeline was touched — it was not).

**Done when**
- [ ] All five commands exit 0.
- [ ] `git grep -n "vault-spike\|SPIKE BYPASS"` returns nothing.
- [ ] A profile footer renders the contact address as a `mailto:` link.
- [ ] `ls src/app` contains no `vault-spike`.

**Commit:** `chore: README truth pass, in-app footer, remove spike`

---

## 4. Cut line

The floor is the spec's: **deposit → on-chain proof → check-in against the real balance →
withdraw, none of which can lie.**

| Order | Task | Cut first? |
|---|---|---|
| 1–11 | schema, RPC, verification, transfers, check-in, encryption | never |
| 12–13 | onboarding, vault UI | never |
| 14 | receipts | last of the floor |
| 15 | verified-saver marker | cut 3rd |
| 6 | shields | cut 2nd (but the check-in rewrite in task 10 must still land) |
| 16 | flex card + OG | cut 4th |
| 17 | tour, sound, haptics | cut 1st |
| 18 | README, footer, cleanup | never (submission hygiene) |

Task 6 is placed early because the check-in rewrite depends on its result type. If the
schedule collapses, ship `shields` as a stored counter that never decreases (no
consumption) rather than reverting to grace.

---

## 5. The single device pass

One deployed preview, one phone, one sitting. Ordered so a failure stops the run early.

**Setup**

1. Deploy the preview to Vercel; note the URL.
2. In Nimiq Pay → Developer → load mini app by URL.
3. Ensure the wallet is on **testnet** for the first pass.
4. Fund the wallet: `POST https://faucet.pos.nimiq-testnet.com/tapit` with the wallet
   address, or use the in-app faucet if Nimiq Pay exposes one.

**Checks**

| # | Action | Pass condition |
|---|---|---|
| 1 | Open the app | `VersionGate` passes on the real `getBalance` (task 18 keeps the check) |
| 2 | Complete onboarding | 24 words shown, quiz rejects a wrong word, passphrase accepted |
| 3 | Reload before finishing | Restarts at step 1, no player row created |
| 4 | Finish onboarding | Player + vault rows exist, `backup_verified_at` not null |
| 5 | Deposit 1 NIM | Wallet prompt appears; hash returned; row goes `pending` → `included`; balance updates |
| 6 | Explorer link | Opens the testnet transaction page showing the vault address as recipient |
| 7 | Check in | Succeeds; balance in the response equals the chain balance |
| 8 | Tamper test | (Desktop) POST a fake `balanceLuna`; the stored balance is unchanged |
| 9 | Withdraw 0.5 NIM | Passphrase prompt; unlock takes 1–2 s; tx included; badge revoked |
| 10 | Withdraw to `players.address` | Explorer shows the identity address as recipient |
| 11 | Wrong passphrase | Decrypt fails with a clear message; no broadcast |
| 12 | Airplane mode | Balance shows a retry card with a reason; check-in returns 503; no stale success |
| 13 | Switch wallet to mainnet | Amber badge; deposit and withdraw disabled |
| 14 | Level up | Chiptune plays once, device vibrates |
| 15 | Tour | Five steps, last one anchors the deposit button, skip works, does not reappear |
| 16 | Share card in a plain browser | Renders, no balance, OG image unfurls in a chat app |

**Known device unknowns** (record the observed value in `docs/HANDOFF-PROMPT.md`):

- `sendBasicTransaction` return shape: hash (expected) or serialized hex.
- `listAccounts()` approval behaviour on first call.
- `getHostNetwork()` returning `'mainnet' | 'testnet'` exactly.
- Whether `TransactionBuilder` + `sendRawTransaction` works from the WebView origin
  (proven from Node and Apache-licensed CORS is open, but not yet from inside Nimiq Pay).

---

## 6. Spec deltas introduced by this plan

Each is a deliberate refinement. Update the spec when the task lands.

| # | Delta | Reason |
|---|---|---|
| D-1 | `first_deposit` XP is awarded at the **next check-in**, not at settle time | Keeps all XP in the single award pipeline (caps, ledger, level-up, items). Awarding inside `settle.ts` would duplicate that logic and risk double-counting. The mission row and the UI copy ("unlocks at your next check-in") must match. |
| D-2 | `execution_failed` added to `FailureReason` | A transaction can be included with `executionResult: false`. Without this, a failed transfer would settle as `included` and credit a balance that never moved. |
| D-3 | `card_token` is minted **server-side** | Nothing is persisted before step 5 anyway, and a client-minted token buys no privacy while allowing collisions. |
| D-4 | Withdrawals also check `value == amountLuna` | The client knows what it signed; the extra check turns a silent under-withdrawal into a visible `wrong_amount`. |
| D-5 | Shields chip is shown on **Vault** and **Profile**, not Home | `src/app/(tabs)/page.tsx` holds the user's uncommitted work. Appendix §7 gives the 6-line Home snippet for them to paste once they commit. |
| D-6 | A 6th tab ("Vault") is added | The vault must be one tap away; the alternative was editing the user's home screen. |
| D-7 | `GET /api/transfers` does not call the chain | `GET /api/transfers/[hash]` and `/api/receipts` do the bounded sweep. Keeps list latency flat. |
| D-8 | Shield earnings use `remaining + gained`, not `shields + gained` | `shields` is the count *before* this check-in's spending. Using it would refund the shields just spent on a bridge. The spec's pseudocode (§7) is an approximation; this is the arithmetic it intends. Add a test either way. |
| D-9 | Tour steps 3–4 anchor the Home **tab icon**, not Home's check-in button | Home cannot be edited in this build. The captions point at Home rather than pretending to highlight controls that were never tagged. Anchor the real ones properly once Home is committed. |
| D-10 | Pending broadcasts are persisted to localStorage and re-POSTed | A wallet broadcast is irreversible; if the following POST fails, the money has moved with no receipt. The retry makes the loop recoverable instead of silently lossy. |
| D-11 | `expired` transfers offer "Try again", never a re-poll of the same hash | `expired` is terminal by design. Re-polling is a no-op that looks like a retry. |

---

## 7. Appendix — Home-screen shield chip (deferred, user applies)

After committing `src/app/(tabs)/page.tsx`, paste this next to the streak display. It is
the only change needed to satisfy spec §7's "shown on Home".

```tsx
{/* Streak shields — spec §7 */}
<div className="flex items-center gap-1" aria-label={`${player.shields} streak shields`}>
  {Array.from({ length: 3 }).map((_, i) => (
    <span
      key={i}
      aria-hidden
      className={i < player.shields ? 'text-mint' : 'text-fg-faint opacity-40'}
    >
      ◈
    </span>
  ))}
</div>
```

`player.shields` comes from `/api/players/me`, which task 10 extends.

---

## 8. Definition of done for the whole build

- [ ] A new player can complete onboarding, back up 24 words, set a passphrase, deposit
      real testnet NIM, see the transaction on chain, check in against the chain balance,
      and withdraw to their identity account.
- [ ] No screen renders success from a hash.
- [ ] A client that lies about its balance changes nothing.
- [ ] A player with no vault is told to create one, not silently trusted.
- [ ] Every fail state in spec §10 has a UI and a retry.
- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run vault:e2e`
      all pass.
- [ ] The device pass in §5 has been run on a real phone and the results are recorded in
      `docs/HANDOFF-PROMPT.md`.
- [ ] `src/app/(tabs)/page.tsx` is untouched by this build's commits.

# Check-in trust - design

**Date:** 2026-11-11
**Status:** awaiting approval
**Branch:** `check-in-trust` (from `main` at `8cbfe80`)
**Reference:** `docs/superpowers/backlog/2026-11-09-check-in-integrity.md`
(Gaps 14 and 15, Fix order step 2, Acceptance tests);
`docs/superpowers/audits/2026-11-05-ui-gap-audit.md` sections 13, 19 and 23.
**Depends on:** the merged release gate (`consume_rate_limit`, same-day
idempotency, `commit_check_in`) and the delete proof pattern
(`src/lib/delete-request.ts`, `src/lib/delete-verify.ts`).

---

## 1. Goal

Close check-in backlog gap 14 in code: `POST /api/check-ins` currently trusts
`X-Player-Address`, so anyone who knows an address can run that player's ritual,
automate it, or grief their withdrawal flags and badges. Every player-triggered
check-in must carry a wallet signature, verified server-side, whose signing key
derives the address in the header.

Gap 15 (the rate limit) already landed with the release gate. This batch keeps
it first among the expensive paths and does not change it.

The success response shape must not change, and the only new responses are the
rejection statuses for missing, malformed, stale, bad-signature and
wrong-signer proofs.

---

## 2. What is verified today

- `POST /api/check-ins` checks only for `X-Player-Address`. A caller can POST
  for any known address and trigger a chain read, a reading, XP and badge
  writes, and withdrawal-flag changes.
- The release gate is already in code and works: the fixed-window rate limit
  runs before any table or chain read; a same-day POST returns the normal shape
  with `alreadyCheckedIn: true`; `commit_check_in` writes in one transaction and
  derives `check_in_count` from distinct UTC days.
- The delete flow already has the pattern: a Nimiq signed-message envelope, a
  120s freshness window, signer-address verification, and shape checks before
  any database read.
- `.env.local` is missing, so the live migration and the five-POST/concurrency
  acceptance checks remain blocked. Tests, build and fixture renders do not
  need it.
- No cron endpoint exists in the repo.

---

## 3. Decisions (confirmed with the user)

| # | Decision | Choice |
|---|---|---|
| 1 | Signature requirement | Required for every POST. No secret header, env flag or IP allowlist bypass. |
| 2 | Freshness window | 120 seconds, bounded in both directions (same as delete). |
| 3 | Message binding | Player address + action string + signed-at timestamp. Vault address and balance stay server-read. No nonce (no schema change). |
| 4 | Rejection mapping | 401 for missing, stale, bad_signature, wrong_signer; 400 for malformed. Body `{ error: <reason> }`. |
| 5 | Home UI | Reuse the existing `checking` state and error Banner; map proof errors to actionable copy. No new screen or phase. |
| 6 | CRON_SECRET | Document the policy only. No unused env var or dead helper. |
| 7 | Renders | Only if the visible Home state changes. Layout and markup do not change, so no new captures. |
| 8 | Proof module reuse | One shared pure module; `delete-request` / `delete-verify` delegate to it and keep their exported names. |
| 9 | Verify order | Player header → pure shape/freshness check (no I/O) → `consume_rate_limit` → signature verify (no DB) → player/vault/chain reads. |

---

## 4. Design

### 4.1 One shared proof module

The Nimiq envelope and the header shape checks are the same bytes and the same
rules for both flows. Two copies would drift, and a drifted envelope makes every
real signature fail.

**New `src/lib/wallet-proof.ts`** (pure, no WASM, no network, safe in the
browser bundle):

- `WALLET_PROOF_MAX_AGE_MS = 120_000` — the default window.
- `WalletProof = { publicKey: string; signature: string; signedAt: number }`.
- `WalletProofHeaderNames = { publicKey: string; signature: string; signedAt: string }`.
- `nimiqSignedPayload(message)` — moved verbatim from `delete-request.ts`:
  `\x16Nimiq Signed Message:\n` + the UTF-8 **byte** length + the message.
- `readWalletProof(headers, names, now, maxAgeMs)` — reads the three named
  headers, normalises `0x` and case, requires 64-hex key, 128-hex signature and
  a safe-integer unsigned timestamp, and bounds `|now - signedAt|`.
  Returns `{ ok: true, proof }` or `{ ok: false, reason: 'missing' | 'malformed' | 'stale' }`.
- `walletProofHeaders(names, proof)` — writes the three headers.
- `normalizeHex` stays private to this module.

**New `src/lib/wallet-proof-verify.ts`** (server only, mirrors
`delete-verify.ts`):

- `verifyWalletSignature({ message, address, proof })` lazily imports
  `@nimiq/core`, hashes `nimiqSignedPayload(message)` with `node:crypto`,
  verifies the Ed25519 signature, and requires `publicKey.toAddress()` to match
  `address` through `sameAddress`.
- Returns `{ ok: true }` or `{ ok: false, reason: 'malformed' | 'bad_signature' | 'wrong_signer' }`.
  The three reasons and the try/catch boundaries are exactly the delete
  verifier's.

**`src/lib/delete-request.ts`** keeps its public API:
`DELETE_PUBLIC_KEY_HEADER`, `DELETE_SIGNATURE_HEADER`, `DELETE_SIGNED_AT_HEADER`,
`DELETE_PROOF_MAX_AGE_MS`, `deleteMessage`, `deleteAuthHeaders`,
`readDeleteProof` and a re-export of `nimiqSignedPayload`. Its body delegates to
`readWalletProof` / `walletProofHeaders`. `deleteMessage` is unchanged.
**`src/lib/delete-verify.ts`** delegates to `verifyWalletSignature` with the
message from `deleteMessage`, keeping `verifyDeleteSignature({ address, createdAt, proof })`
and its result type. The delete route and its tests do not change.

### 4.2 The check-in message and headers

**New `src/lib/checkin-request.ts`** (pure, client and server):

```ts
export const CHECKIN_PUBLIC_KEY_HEADER = 'X-Savborne-Check-In-Public-Key'
export const CHECKIN_SIGNATURE_HEADER = 'X-Savborne-Check-In-Signature'
export const CHECKIN_SIGNED_AT_HEADER = 'X-Savborne-Check-In-Signed-At'
export const CHECKIN_PROOF_MAX_AGE_MS = 120_000
export const CHECKIN_ACTION = 'check-in'

export function checkInMessage(args: {
  address: string
  action?: string        // defaults to CHECKIN_ACTION
  signedAt: number
}): string
```

The message is:

```
Savborne check-in
Address: <normalizeAddress(address)>
Action: check-in
Signed at: <signedAt>
This signature proves I control this player's wallet.
```

Why this shape:

- The first line is a different namespace from `Savborne account deletion`, so
  the two messages can never share a signature.
- The normalised address stops a spaced and an unspaced address producing two
  different messages for one player.
- The action string is a constant both sides embed. The server always rebuilds
  `check-in`, so a proof for a future action (for example a claim) fails.
- `signedAt` bounds replay to the freshness window.
- It binds nothing the server must read before verifying (no vault, no
  `createdAt`, no balance), so a bad proof costs no database or chain read.

Headers, not query parameters, keep the proof out of logs and URLs, matching
delete. The names are distinct from `X-Savborne-Delete-*`, so a delete request
and a check-in request cannot even be confused by a proxy: a delete proof is
**missing** at the check-in route, and a delete signature replayed into the
check-in headers is a **bad signature** because the message differs.

`readCheckInProof(headers, now)` and `checkInAuthHeaders(proof)` wrap the shared
module with these names and `CHECKIN_PROOF_MAX_AGE_MS`.

`checkInErrorMessage(code, status)` lives beside them so the Home copy is pure
and testable:

| code | copy |
|---|---|
| `missing` | Nimiq Pay did not sign the check-in. Tap Check in now to try again. |
| `stale` | Confirming took too long. Tap Check in now to try again. |
| `malformed`, `bad_signature` | The wallet signature did not match this check-in. Try again. |
| `wrong_signer` | Nimiq Pay signed with a different account. Switch back to this one and try again. |
| anything else | Check-in failed (status). |

**New `src/lib/checkin-verify.ts`** (server only): `verifyCheckInSignature({ address, proof })`
calls `verifyWalletSignature` with `checkInMessage({ address, signedAt: proof.signedAt })`.
It accepts no action override, so the server's message always uses
`CHECKIN_ACTION`.

### 4.3 Server order in `POST /api/check-ins`

```
1. X-Player-Address present?                      401 "Missing X-Player-Address header"
2. readCheckInProof(headers, Date.now())          missing → 401, stale → 401, malformed → 400   (no I/O)
3. consume_rate_limit                             denied → 429 + Retry-After                     (unchanged)
4. verifyCheckInSignature({ address, proof })     bad_signature / wrong_signer → 401              (no DB)
                                                  malformed → 400
                                                  verifier threw → 500 "Could not verify the signature."
5. player, vault, history reads                   (unchanged)
6. same-day idempotent response                   (unchanged)
7. chain read, mission evaluation, commit_check_in (unchanged)
```

Rationale for 2 before 3, and 4 after 3:

- Shape and freshness are pure, so a missing or stale proof costs nothing and
  consumes no rate-limit budget.
- The rate limit still runs before **any** table or chain read, preserving the
  release-gate property and its existing test.
- Signature verification is CPU (WASM) but no I/O. Putting it after the rate
  limit means a flood of well-shaped bogus proofs is bounded to ten
  verifications per address per minute, while a wrong signature still never
  reaches the player table.

The rate-limit key, limit, window, same-day short-circuit, `commit_check_in`
payload and response builders are untouched.

### 4.4 Rejection contract

New responses only:

| case | status | body |
|---|---|---|
| player header missing | 401 | `{ "error": "Missing X-Player-Address header" }` (unchanged) |
| any proof header missing | 401 | `{ "error": "missing" }` |
| key/signature/timestamp not the right shape | 400 | `{ "error": "malformed" }` |
| signedAt outside ±120s | 401 | `{ "error": "stale" }` |
| signature does not verify for the key | 401 | `{ "error": "bad_signature" }` |
| signature verifies, key does not derive the header address | 401 | `{ "error": "wrong_signer" }` |
| WASM load or verify threw | 500 | `{ "error": "Could not verify the signature." }` |

These are the same codes and statuses as `DELETE /api/players/me`, so one client
mental model covers both.

### 4.5 Success response unchanged

Both 200 branches keep every field and value type they have today. No field is
added, renamed or removed:

- fresh check-in: `ok`, `alreadyCheckedIn`, `checkInCount`, `awarded`,
  `leveledUp`, `newLevel`, `newXp`, `xpToNext`, `streakCurrent`, `shields`,
  `shieldsEarned`, `bracket`, `bracketChanged`, `previousBracket`,
  `withdrawalDetected`, `previousBalanceLuna`, `balanceLuna`, `unlockedItems`,
  `badgeActions`;
- same-day / lost-race: `ok`, `alreadyCheckedIn`, `checkInCount`, `awarded`,
  `leveledUp`, `newLevel`, `newXp`, `xpToNext`, `streakCurrent`, `shields`,
  `shieldsEarned`, `bracket`, `bracketChanged`, `previousBracket`,
  `withdrawalDetected`, `previousBalanceLuna`, `balanceLuna`, `unlockedItems`,
  `badgeActions`.

Tests pin the exact key set of both.

### 4.6 Home client

`onCheckIn` keeps its shape and its `checking` / `checkError` state:

```ts
setChecking(true)
setCheckError(null)
setAwards(null)
try {
  const address = session.playerAddress
  const signedAt = Date.now()
  const proof = await signMessage(checkInMessage({ address, signedAt }))
  const res = await fetch('/api/check-ins', {
    method: 'POST',
    headers: authHeaders(checkInAuthHeaders({ ...proof, signedAt })),
  })
  ...
}
```

- The address signed is the same one `authHeaders()` sends; both come from the
  session. Signing a different address would be a `wrong_signer` rejection.
- `signMessage` already returns the wallet's `publicKey`/`signature` over
  Nimiq's envelope; nothing is hashed client-side.
- The wallet approval sheet is Nimiq Pay's own UI, not a Savborne screen, so the
  button keeps `Reading balance…` while `checking` is true.
- On a proof rejection the response body's `error` is mapped through
  `checkInErrorMessage` into the existing inline Banner and the handler returns
  without throwing a generic `Check-in failed (401)`.
- `503 rpc_unreachable` still routes to `/balance-error`.
- A cancelled signature throws `WalletError` from `signMessage`; the existing
  `describeError` path shows the wallet message. Its `PERMISSION_DENIED` copy
  becomes signing-aware: "Check-in needs your wallet signature. Tap Check in now
  to try again."
- The `takeBalanceRetry()` path (returning from `/balance-error`) calls the same
  `onCheckIn`, so it now asks for one signature. The player has just chosen to
  retry, so the prompt is expected; this is noted, not worked around.
- No phase, screen, route, button label, layout or component changes. Only the
  request headers, the signing call and the error copy differ.

### 4.7 CRON_SECRET policy (documented, not built)

Recorded in the route header comment and the backlog:

> Any future server-triggered check-in or claim path must authenticate with a
> separate `CRON_SECRET` and must never accept a player header as authority. It
> must not reuse the check-in proof headers. A player-triggered request is
> authorised only by a signed check-in proof.

No cron route, background job, env var or dead helper is added. A signature
proves wallet control, not that a person tapped; that policy limit stands.

---

## 5. Non-goals and invariants

- No SQL, schema, migration, RLS or `FINAL-SCHEMA.sql` change.
- Do not weaken the rate limit, the same-day idempotency or `commit_check_in`.
- No success response field rename or shape break.
- No new cron route or background job.
- No vault-address or balance binding in the message; the server reads those.
- No nonce store (would be a schema change).
- No new UI screen, phase, route or layout.
- The body stays unread: the proof lives in headers and nothing in the body
  changes the snapshot.

---

## 6. Files

**Create**

- `src/lib/wallet-proof.ts`
- `src/lib/wallet-proof-verify.ts`
- `src/lib/checkin-request.ts`
- `src/lib/checkin-verify.ts`
- `src/test/wallet-signer.ts` (test-only real-keypair signer shared by tests)
- `src/lib/checkin-request.test.ts`
- `src/lib/checkin-verify.test.ts`
- `docs/superpowers/specs/2026-11-11-check-in-trust-design.md`
- `docs/superpowers/plans/2026-11-11-check-in-trust.md`

**Modify**

- `src/lib/delete-request.ts` (delegate, keep exports)
- `src/lib/delete-verify.ts` (delegate, keep exports)
- `src/app/api/check-ins/route.ts` (proof gate, header comment, CRON_SECRET policy)
- `src/app/(tabs)/page.tsx` (`onCheckIn` signs; mapped errors)
- `src/app/api/check-ins/route.test.ts` (signed requests + new cases)
- `src/app/api/players/me/route.test.ts` (reverse cross-namespace case; shared signer)
- `src/lib/home.test.ts` (Home signs before POST)
- `docs/superpowers/backlog/2026-11-09-check-in-integrity.md` (status)

**Not touched:** `supabase/FINAL-SCHEMA.sql`, `src/app/api/queue/join/route.ts`,
any response field, any checkpoint/default state markup.

---

## 7. Tests

Real `@nimiq/core` keypairs sign; production verifiers check. No signature
mocks.

`src/lib/checkin-request.test.ts`

1. The message names the check-in namespace, the normalised address, the action
   and the timestamp.
2. The check-in message and the delete message differ for the same address and
   timestamp.
3. A different address, action or `signedAt` produces a different message.
4. `nimiqSignedPayload` is the same envelope as the delete flow, including the
   UTF-8 byte length.
5. A complete proof is read from the headers.
6. `0x`-prefixed and upper-case hex are accepted.
7. Any missing header is `missing`, not `malformed`.
8. Wrong lengths and non-hex are `malformed`.
9. Non-numeric, fractional, negative or unsafe timestamps are `malformed`.
10. The proof is `stale` just outside ±120s and valid at the boundary.
11. The headers the client writes are the headers the server reads.
12. The check-in header names are not the delete header names.
13. `checkInErrorMessage` maps every code and falls back on status.

`src/lib/checkin-verify.test.ts`

1. A proof signed over its own address verifies.
2. Spacing and case differences still verify.
3. Key A's signature against key B is `bad_signature`.
4. A proof signed for a different action is `bad_signature`.
5. A valid signature naming the victim, from the attacker's key, is
   `wrong_signer`.
6. A delete-namespace message signed by the right key is `bad_signature`.
7. Bad key or signature shapes are `malformed`.

`src/app/api/check-ins/route.test.ts` (existing cases now send a real proof)

1. Missing proof: 401 `{ error: 'missing' }`, zero calls.
2. Malformed proof: 400, zero calls.
3. Stale proof: 401, zero calls.
4. Bad signature: 401, the rate limit ran once, no player/vault/chain read.
5. Wrong signer: 401, no player/vault/chain read.
6. Proof signed for a different action: 401 `bad_signature`, no writes.
7. Proof signed for a different address: 401 `wrong_signer`, no writes.
8. A valid proof runs the existing path exactly once (one chain read, one
   commit).
9. A denied rate limit with a valid proof: 429 before any player/vault/chain
   read, no commit.
10. The fresh-success 200 key set is pinned exactly.
11. The `alreadyCheckedIn` 200 key set is pinned exactly.
12. Existing cases (404, 409, 503, body ignored, five POSTs, lost race) keep
    their assertions.

`src/app/api/players/me/route.test.ts`

1. A valid check-in proof sent as a delete proof is 401 `bad_signature` and runs
   no `delete_player` (the reverse namespace direction).

`src/lib/home.test.ts`

1. Home builds `checkInMessage`, calls `signMessage`, merges
   `checkInAuthHeaders` into `authHeaders`, and still POSTs once to
   `/api/check-ins`.

---

## 8. Acceptance criteria

- Every POST needs a valid proof; there is no unsigned path in code.
- A proof from a key that does not control the header address is rejected.
- A proof for a different action, address or namespace is rejected.
- The same signature replayed after 120s is `stale`.
- Missing/malformed/stale/bad-signature/wrong-signer consume no table or chain
  read; the rate limit still precedes every table and chain read.
- The 200 shape, status codes and `alreadyCheckedIn` semantics are unchanged.
- Home signs and POSTs through the same headers the server reads; a rejection
  appears in the existing inline Banner.
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all green
  before the single commit.

---

## 9. Risks

- **Deployed clients.** A build that POSTs without a proof now gets 401. This is
  a pre-release app and the signed client ships in the same commit.
- **Delete refactor.** Moving the envelope could break real signatures. The
  delete route tests, the delete request/verify tests and the byte-for-byte
  envelope test guard it; the move is mechanical and `deleteMessage` is
  unchanged.
- **WASM cost.** Verification is bounded by the rate limit and happens after it.
- **Signature ≠ human.** Automation by the wallet owner remains possible; the
  policy limit in the backlog stands.

---

## 10. Renders and docs

- No renders: the default, loaded, checking and already-checked-in Home markup
  are unchanged. The only visible differences are text inside the existing error
  Banner and the existing loading label, and Nimiq Pay's own approval sheet.
  Recorded in the plan and final report; no new files under
  `docs/superpowers/renders/`.
- No new UI gap audit section: section 24 is added only when a batch changes a
  visible Savborne screen state. This batch does not.
- The backlog status becomes: gap 14 closed in code, gap 15 already landed, live
  migration and the five-POST/concurrency checks still pending `.env.local`.

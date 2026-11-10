# Check-in trust - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans.
> Steps use checkbox (`- [ ]`) syntax.

**Goal:** Require a wallet signature for every `POST /api/check-ins`, verify it
server-side against the header address, keep the release gate and the success
shape untouched, and make Home sign before POSTing.

**Architecture:** One pure shared module holds Nimiq's signed-message envelope
and the proof header shape checks; one server-only verifier holds the lazy
`@nimiq/core` signature check. `delete-request` / `delete-verify` delegate to
them and keep their public API. The check-in proof adds its own header names,
namespace, action string and message builder. The route runs the pure proof
check, then the existing rate limit, then the signature verify, then the
unchanged check-in pipeline.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, `@nimiq/core`
Ed25519, `node:crypto`, node:test with the existing `src/test/fake-net.ts`.

**Spec:** `docs/superpowers/specs/2026-11-11-check-in-trust-design.md`.

## Global Constraints

- Branch `check-in-trust` from `main` at `8cbfe80`.
- No SQL, schema, migration, RLS or `FINAL-SCHEMA.sql` changes.
- Do not weaken the rate limit, the same-day idempotency or `commit_check_in`.
- No success response field rename or shape break.
- No new cron route, background job, env var or dead helper.
- Signature required for every POST; no bypass path.
- 120s freshness, address + action + signedAt binding.
- 401 for missing/stale/bad_signature/wrong_signer, 400 for malformed.
- One commit per task; `npm test`, `npx tsc --noEmit`, `npm run lint` and
  `npm run build` green before each commit.
- Never stage `.env.local`, `AGENTS.md` or InstaBox tooling.
- Do not merge or push before sign-off.
- No renders and no UI gap audit section: no visible Savborne screen state
  changes.

## Baseline

`main` at `8cbfe80`: 438 tests pass, tsc clean, lint 49 warnings / 0 errors,
build exit 0, `.env.local` absent.

---

### Task 0: Spec, plan and branch

**Files:**
- Create: `docs/superpowers/specs/2026-11-11-check-in-trust-design.md`
- Create: `docs/superpowers/plans/2026-11-11-check-in-trust.md`

- [ ] **Step 1: Confirm the branch and base**

```bash
git branch --show-current          # check-in-trust
git log --oneline -1               # 8cbfe80
```

- [ ] **Step 2: Get approval on both documents**

Do not start Task 1 before the user approves the spec and plan.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-11-11-check-in-trust-design.md \
        docs/superpowers/plans/2026-11-11-check-in-trust.md
git commit -m "docs: specify the check-in trust batch"
```

---

### Task 1: Shared wallet-proof module, delete delegates

**Files:**
- Create: `src/lib/wallet-proof.ts`
- Create: `src/lib/wallet-proof-verify.ts`
- Modify: `src/lib/delete-request.ts`
- Modify: `src/lib/delete-verify.ts`

**Interfaces produced (used by later tasks):**

```ts
// wallet-proof.ts (pure, no WASM, no network)
export const WALLET_PROOF_MAX_AGE_MS = 120_000
export type WalletProof = { publicKey: string; signature: string; signedAt: number }
export type WalletProofHeaderNames = { publicKey: string; signature: string; signedAt: string }
export type ReadWalletProofResult =
  | { ok: true; proof: WalletProof }
  | { ok: false; reason: 'missing' | 'malformed' | 'stale' }
export function nimiqSignedPayload(message: string): Uint8Array
export function readWalletProof(
  headers: Headers,
  names: WalletProofHeaderNames,
  now: number,
  maxAgeMs?: number,
): ReadWalletProofResult
export function walletProofHeaders(
  names: WalletProofHeaderNames,
  proof: WalletProof,
): Record<string, string>

// wallet-proof-verify.ts (server only)
export type WalletVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'wrong_signer' }
export function verifyWalletSignature(args: {
  message: string
  address: string
  proof: WalletProof
}): Promise<WalletVerifyResult>
```

- [ ] **Step 1: Move the envelope verbatim**

Copy `nimiqSignedPayload`, `normalizeHex` and the `encoder` into
`wallet-proof.ts`. Keep the doc comments that explain the `\x16` prefix, the
UTF-8 byte length and why `String.length` is wrong. `normalizeHex` stays
module-private.

- [ ] **Step 2: Add the generic reader and writer**

`readWalletProof` is the old `readDeleteProof` body with the header names and
`maxAgeMs` parameterised:

- any header absent → `missing`;
- key 64 hex, signature 128 hex, `signedAt` `/^\d+$/` and a safe integer →
  otherwise `malformed`;
- `Math.abs(now - signedAt) > maxAgeMs` → `stale`.

`walletProofHeaders` writes `names.publicKey`, `names.signature` and
`String(proof.signedAt)`.

- [ ] **Step 3: Add the generic verifier**

`wallet-proof-verify.ts` is the old `delete-verify.ts` body with `message` as an
argument:

- lazy `import('@nimiq/core')` memoised, reset on failure;
- `PublicKey.fromHex` / `Signature.fromHex` in a try/catch → `malformed`;
- `createHash('sha256').update(nimiqSignedPayload(message)).digest()`;
- `publicKey.verify(...)` in a try/catch → `malformed`, false → `bad_signature`;
- `sameAddress(publicKey.toAddress().toUserFriendlyAddress(), address)` false →
  `wrong_signer`.

- [ ] **Step 4: Delegate in `delete-request.ts`**

Keep every exported name and the `deleteMessage` text byte-for-byte:

```ts
export const DELETE_PROOF_MAX_AGE_MS = WALLET_PROOF_MAX_AGE_MS
const DELETE_HEADERS = {
  publicKey: DELETE_PUBLIC_KEY_HEADER,
  signature: DELETE_SIGNATURE_HEADER,
  signedAt: DELETE_SIGNED_AT_HEADER,
}
export function readDeleteProof(headers: Headers, now: number) {
  return readWalletProof(headers, DELETE_HEADERS, now, DELETE_PROOF_MAX_AGE_MS)
}
export function deleteAuthHeaders(proof: DeleteProof) {
  return walletProofHeaders(DELETE_HEADERS, proof)
}
export { nimiqSignedPayload } from './wallet-proof'
```

- [ ] **Step 5: Delegate in `delete-verify.ts`**

```ts
export async function verifyDeleteSignature(args: { address: string; createdAt: string; proof: DeleteProof }) {
  return verifyWalletSignature({
    message: deleteMessage(args),
    address: args.address,
    proof: args.proof,
  })
}
```

Keep the `DeleteVerifyResult` type alias so the route's imports still compile.

- [ ] **Step 6: Run the delete tests and the full suite**

```bash
node --import tsx --test src/lib/delete-request.test.ts
node --import tsx --test src/lib/delete-verify.test.ts
node --import tsx --test src/app/api/players/me/route.test.ts
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: 438 tests pass; the delete envelope test still asserts the
hand-computed `164e69...` bytes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/wallet-proof.ts src/lib/wallet-proof-verify.ts \
        src/lib/delete-request.ts src/lib/delete-verify.ts
git commit -m "refactor: share the wallet proof envelope and verifier"
```

---

### Task 2: Check-in proof modules and the test signer

**Files:**
- Create: `src/lib/checkin-request.ts`
- Create: `src/lib/checkin-verify.ts`
- Create: `src/test/wallet-signer.ts`
- Create: `src/lib/checkin-request.test.ts`
- Create: `src/lib/checkin-verify.test.ts`

**Interfaces produced:**

```ts
// checkin-request.ts (pure, client + server)
export const CHECKIN_PUBLIC_KEY_HEADER = 'X-Savborne-Check-In-Public-Key'
export const CHECKIN_SIGNATURE_HEADER = 'X-Savborne-Check-In-Signature'
export const CHECKIN_SIGNED_AT_HEADER = 'X-Savborne-Check-In-Signed-At'
export const CHECKIN_PROOF_MAX_AGE_MS = 120_000
export const CHECKIN_ACTION = 'check-in'
export function checkInMessage(args: { address: string; action?: string; signedAt: number }): string
export function readCheckInProof(headers: Headers, now: number): ReadWalletProofResult
export function checkInAuthHeaders(proof: WalletProof): Record<string, string>
export function checkInErrorMessage(code: string | undefined, status: number): string

// checkin-verify.ts (server only)
export function verifyCheckInSignature(args: { address: string; proof: WalletProof }): Promise<WalletVerifyResult>
```

- [ ] **Step 1: Write `checkin-request.ts`**

Message, exactly:

```
Savborne check-in
Address: <normalizeAddress(address)>
Action: <action ?? CHECKIN_ACTION>
Signed at: <signedAt>
This signature proves I control this player's wallet.
```

Delegate `readCheckInProof` / `checkInAuthHeaders` to the shared module with the
three check-in header names and `CHECKIN_PROOF_MAX_AGE_MS`. Add the copy table
from spec section 4.2 to `checkInErrorMessage` (fallback
`Check-in failed (<status>).`).

- [ ] **Step 2: Write `checkin-verify.ts`**

```ts
export function verifyCheckInSignature(args: { address: string; proof: WalletProof }) {
  return verifyWalletSignature({
    message: checkInMessage({ address: args.address, signedAt: args.proof.signedAt }),
    address: args.address,
    proof: args.proof,
  })
}
```

No action parameter: the server always rebuilds `CHECKIN_ACTION`.

- [ ] **Step 3: Write the shared test signer**

`src/test/wallet-signer.ts`:

```ts
export type TestSigner = {
  address: string
  publicKey: string
  sign(message: string): Promise<{ publicKey: string; signature: string }>
}
export async function newWalletSigner(): Promise<TestSigner>
```

It dynamically imports `@nimiq/core`, generates a `KeyPair`, and signs
`createHash('sha256').update(nimiqSignedPayload(message)).digest()` with
`Signature.create`. No mocks.

- [ ] **Step 4: Write `checkin-request.test.ts`**

Cover spec section 7, items 1-13:

1. message namespace / normalised address / action / timestamp;
2. check-in vs delete message differ for the same address + `signedAt`;
3. different address, action or `signedAt` change the message;
4. envelope bytes identical to the delete envelope, including the UTF-8 byte
   length (hand-computed hex, not a round-trip);
5. complete proof read;
6. `0x` and upper-case hex;
7. each missing header → `missing`;
8. wrong lengths / non-hex → `malformed`;
9. `soon`, `1.5`, `-1`, `99999999999999999` → `malformed`;
10. boundary and just-outside ±120s → `stale`;
11. `checkInAuthHeaders` output read back by `readCheckInProof`;
12. check-in header names differ from the delete header names;
13. every `checkInErrorMessage` code plus the status fallback.

- [ ] **Step 5: Write `checkin-verify.test.ts`**

Cover spec section 7, items 1-7 using `newWalletSigner`:
own address; spacing/case; key A vs key B; different action; attacker key naming
the victim → `wrong_signer`; delete-namespace message → `bad_signature`;
malformed key/signature shapes.

- [ ] **Step 6: Verify and commit**

```bash
node --import tsx --test src/lib/checkin-request.test.ts src/lib/checkin-verify.test.ts
npm test && npx tsc --noEmit && npm run lint && npm run build
git add src/lib/checkin-request.ts src/lib/checkin-verify.ts src/test/wallet-signer.ts \
        src/lib/checkin-request.test.ts src/lib/checkin-verify.test.ts
git commit -m "feat: add the signed check-in proof"
```

---

### Task 3: Require the proof in POST /api/check-ins

**Files:**
- Modify: `src/app/api/check-ins/route.ts`
- Modify: `src/app/api/check-ins/route.test.ts`

- [ ] **Step 1: Add the gate in the agreed order**

After the `X-Player-Address` check and before `supabaseAdmin()`:

```ts
const proof = readCheckInProof(req.headers, Date.now())
if (!proof.ok) {
  return NextResponse.json(
    { error: proof.reason },
    { status: proof.reason === 'malformed' ? 400 : 401 },
  )
}
```

After the existing rate-limit block and before the player read:

```ts
let verified
try {
  verified = await verifyCheckInSignature({ address, proof: proof.proof })
} catch {
  return NextResponse.json({ error: 'Could not verify the signature.' }, { status: 500 })
}
if (!verified.ok) {
  return NextResponse.json(
    { error: verified.reason },
    { status: verified.reason === 'malformed' ? 400 : 401 },
  )
}
```

Break nothing else: keep the rate-limit key/limit/window, the same-day
short-circuit, every response builder and the `commit_check_in` payload.

- [ ] **Step 2: Document the proof and the cron policy in the route comment**

Add to the header comment: the three check-in headers, the namespace, the 120s
window, the order (shape → rate limit → verify → reads), and:

> Any future server-triggered check-in or claim path must authenticate with a
> separate `CRON_SECRET` and must never accept a player header as authority.

- [ ] **Step 3: Make the test file sign by default**

- `before(async () => { signer = await newWalletSigner() })`, with
  `let signer: TestSigner` and `let PLAYER: string` assigned from
  `signer.address` (top-level await is unavailable: no `"type": "module"`).
- Replace the `PLAYER_ROW` const with `playerRow(overrides = {})` returning the
  same fields with `address: PLAYER`.
- Add helpers:

```ts
async function proofHeaders(address = PLAYER, signedAt = Date.now()) {
  const message = checkInMessage({ address, signedAt })
  const proof = await signer.sign(message)
  return checkInAuthHeaders({ ...proof, signedAt })
}
async function signedReq(body: unknown = {}, extra: Record<string, string> = {}) {
  return req(body, { 'X-Player-Address': PLAYER, ...(await proofHeaders()), ...extra })
}
```

- Every existing POST that expects to reach the pipeline uses
  `await signedReq()`; the header-less test keeps a bare `req({}, {})`; the
  429/503 tests use signed requests so they still prove the order.

- [ ] **Step 4: Add the new route cases (spec section 7, items 1-12)**

- missing proof: 401 `{ error: 'missing' }`, `net.calls.length === 0`;
- malformed proof: 400 `{ error: 'malformed' }`, zero calls;
- stale proof (`Date.now() - 125_000`): 401, zero calls;
- bad signature (valid shape, `publicKey` from a second signer, signature from
  the first): 401 `bad_signature`, exactly one `consume_rate_limit` call, no
  `players`/`vaults` read, no chain call;
- wrong signer (attacker signs a message naming `PLAYER`): 401 `wrong_signer`,
  no `players` read;
- different action (`checkInMessage({ address: PLAYER, action: 'claim', signedAt })`):
  401 `bad_signature`, no commit;
- different address (signer A's message sent with signer B's header):
  401 `wrong_signer`, no commit;
- valid proof: one chain read, one `commit_check_in`, 200;
- valid proof + denied rate limit: 429, `Retry-After`, no `players` read, no
  chain call;
- exact fresh-success key set: `Object.keys(body).sort()` equals the 19-field
  list in spec 4.5;
- exact `alreadyCheckedIn` key set: same list, with `alreadyCheckedIn: true`.

- [ ] **Step 5: Run the route file, then the full gates**

```bash
node --import tsx --test src/app/api/check-ins/route.test.ts
npm test && npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/check-ins/route.ts src/app/api/check-ins/route.test.ts
git commit -m "feat: require a signed proof for check-in"
```

---

### Task 4: Home signs before POSTing

**Files:**
- Modify: `src/app/(tabs)/page.tsx`
- Modify: `src/lib/home.test.ts`
- Modify: `src/app/api/players/me/route.test.ts` (reverse namespace case)

- [ ] **Step 1: Sign in `onCheckIn`**

Add imports for `signMessage`, `checkInMessage`, `checkInAuthHeaders`,
`checkInErrorMessage`. Inside the existing `try`, before `fetch`:

```ts
const address = session.playerAddress
const signedAt = Date.now()
const proof = await signMessage(checkInMessage({ address, signedAt }))
const res = await fetch('/api/check-ins', {
  method: 'POST',
  headers: authHeaders(checkInAuthHeaders({ ...proof, signedAt })),
})
```

Keep `setChecking`, `setCheckError`, `setAwards`, the 503 → `/balance-error`
branch, the handoff destinations and the `finally`.

- [ ] **Step 2: Map proof rejections into the existing Banner**

On `!res.ok`, parse the JSON body once; when `status` is 400 or 401 and the
`error` code is one of the proof reasons, `setCheckError(checkInErrorMessage(code, status))`
and return. Otherwise keep the current generic throw.

In `describeError`, change only the `PERMISSION_DENIED` copy to
`Check-in needs your wallet signature. Tap Check in now to try again.`

- [ ] **Step 3: Pin the client contract**

Add to `src/lib/home.test.ts`:

```ts
test('Home signs the check-in before it POSTs', () => {
  assert.match(HOME, /signMessage\(checkInMessage/)
  assert.match(HOME, /checkInAuthHeaders/)
  assert.match(HOME, /authHeaders\(checkInAuthHeaders/)
  assert.match(HOME, /checkInErrorMessage/)
})
```

- [ ] **Step 4: Add the reverse cross-namespace case**

In `src/app/api/players/me/route.test.ts`, add one test: a real check-in proof
(signed over `checkInMessage`) sent in the check-in headers to
`DELETE /api/players/me` is `missing` (different headers), and the same bytes
sent in the delete headers are 401 `bad_signature` with no `delete_player` call.
Make the file's local `newSigner` delegate to `newWalletSigner` so there is one
signer helper.

- [ ] **Step 5: Verify and commit**

```bash
node --import tsx --test src/lib/home.test.ts src/app/api/players/me/route.test.ts
npm test && npx tsc --noEmit && npm run lint && npm run build
git add 'src/app/(tabs)/page.tsx' src/lib/home.test.ts \
        src/app/api/players/me/route.test.ts
git commit -m "feat: sign check-in from Home"
```

---

### Task 5: Backlog status and final verification

**Files:**
- Modify: `docs/superpowers/backlog/2026-11-09-check-in-integrity.md`

- [ ] **Step 1: Update the status**

- Header status: release gate landed in code; trust step 2 closed in code;
  migration pending deployment.
- Add a `### 2026-11-11 — trust` subsection under "Implementation status":
  gap 14 closed in code (headers, message, 120s window, wrong-signer check, both
  namespace directions), gap 15 already landed with the release gate, live
  migration and the five-POST/concurrency checks still need `.env.local`.
- Annotate gaps 14 and 15 inline (`Closed in code 2026-11-11` / `Landed
  2026-11-09`).
- Under "Acceptance tests", mark the unsigned-POST line as covered by
  `src/app/api/check-ins/route.test.ts`; leave the live five-POST and
  concurrency lines as deployment steps.
- Add the `CRON_SECRET` policy sentence to Fix order step 2, if not already
  explicit.

- [ ] **Step 2: Confirm no unintended files**

```bash
git status --short
```

`supabase/FINAL-SCHEMA.sql`, `AGENTS.md`, `.env.local` and any InstaBox files
must not appear. No files under `docs/superpowers/renders/` and no section 24 in
the UI gap audit (no visible UI state changed).

- [ ] **Step 3: Final full gates and numbers**

```bash
npm test                 # record pass/fail counts
npx tsc --noEmit         # expect clean
npm run lint             # record warning/error counts
npm run build            # expect exit 0
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/backlog/2026-11-09-check-in-integrity.md
git commit -m "docs: close check-in trust in the backlog"
```

- [ ] **Step 5: Stop**

Do not merge or push. Report the exact test, lint and build numbers, the files
changed, the rejection contract, and the still-pending live checks.

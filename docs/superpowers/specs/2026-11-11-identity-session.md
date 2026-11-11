# Spec - signed player sessions (identity authority)

**Date:** 2026-11-11
**Status:** approved for implementation (release-blocking)
**Closes:** backlog gap 14 for every route, not just check-in and delete.

## Problem

Today `X-Player-Address` is identity *and* authority on 17 of 19 API routes.
Anyone who knows a public address can read that player's profile, transfers and
receipts, rename or re-avatar them, start missions and battles, join or leave
ranked, and claim transfers. No NIM can move (withdrawals are signed in the
browser by the 24-word phrase), but public use needs this closed: it enables
griefing and privacy leaks for any known address.

Check-in and account deletion already require a wallet signature. They keep
that proof (defense in depth); the session is added on top.

## Model

1. **Issue.** `POST /api/session` takes
   `{ address, signedAt, publicKey, signature }`. The signature is Nimiq's
   signed-message envelope over:

   ```text
   Savborne session
   Address: <normalised address>
   Action: session
   Signed at: <unix ms>
   This signature starts a 12-hour Savborne session for this wallet.
   ```

   The server shape-checks the proof, rejects it outside the existing 120s
   freshness window, and verifies that the signing key derives the claimed
   address (`wallet-proof-verify.ts`). No database read is needed: a wallet
   that has never onboarded can still get a session, which is what onboarding
   needs.

2. **Token.** The response is
   `{ token, expiresAt }`. The token is stateless:
   `base64url(JSON.stringify({ addr, exp })).base64url(HMAC-SHA256(payload, SESSION_SECRET))`.
   `exp` is unix milliseconds, TTL **12 hours**. `SESSION_SECRET` is a new
   server-only environment variable of at least 32 bytes. No token is stored in
   the database, so there is nothing to revoke server-side; expiry is the bound.

3. **Present.** Every authenticated request carries
   `X-Savborne-Session: <token>`. `X-Player-Address` may still be sent; if it is
   present it must match the token (`session_mismatch` otherwise). The token's
   address is the authority.

4. **Guard.** `requirePlayer(req)` returns `{ address }` or a 401
   `NextResponse` with a stable code:

   | Code | Meaning | Client action |
   |---|---|---|
   | `session_required` | header missing | sign once, retry |
   | `session_expired` | `exp <= now` | sign once, retry |
   | `session_invalid` | bad shape/signature | sign once, retry |
   | `session_mismatch` | token and player header disagree | sign out / reconnect |

   Every authenticated route uses it, reads included: profile, transfers,
   receipts, leaderboards, missions, vaults, battles, queue, check-ins and
   account deletion. `POST /api/players` requires a session too, so a new
   wallet cannot be pre-empted by someone who merely knows its address.

5. **Client.** The Mini App signs once, caches
   `{ address, token, expiresAt }` in localStorage, and attaches the token to
   every API call. A 401 with a session code clears the cache, signs once, and
   retries the request once. A second 401 surfaces an inline reconnect, never a
   dead end. `authHeaders()` stays synchronous for callers that already hold a
   token; `apiFetch()` owns the obtain/refresh/retry path.

## Why not a database session table

Stateless HMAC keeps the smallest possible server surface: no new table, no
cleanup job, no session id to leak, and the non-custodial model is untouched.
The trade-off is that a stolen token is valid until `exp`; 12 hours is short
enough for game state with no money-moving authority. If per-device revocation
is needed later, add a `session_epoch` per player and include it in the
payload - a schema change, deliberately out of scope here.

## Rate limits

`consume_rate_limit` is reused on the unauthenticated and abuse-prone routes:
session issue (per IP), player create (per IP and address), queue join/poll,
battle move, transfers POST, vault create, profile/name change, and
leaderboards read. Denials are `429` with `Retry-After` and `retryAfterSeconds`,
matching the check-in contract. Authenticated keys use the token address;
unauthenticated keys use Vercel's `x-forwarded-for` first hop.

## Rollout

Hard cut in one release. The server rejects bare address headers; the client
ships the signing path in the same build. There is no dual-trust window. The
onboarding flow obtains a session before `POST /api/players`, so a fresh wallet
works on its first request.

## Tests

- Token: issue/verify, tamper, expiry, wrong secret, malformed segments.
- Session route: valid signature, wrong signer, stale, bad signature, rate limit.
- Guard: missing, expired, invalid, mismatch, valid.
- One read (`GET /api/profile`) and one mutation (`PATCH /api/players/me`) reject
  a bare address and accept a valid token.
- A token for player A cannot read player B's transfers or change B's name.

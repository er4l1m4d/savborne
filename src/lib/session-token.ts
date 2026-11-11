/**
 * Savborne - stateless player session tokens (server only)
 *
 * A session is an HMAC-signed envelope, not a database row:
 *
 *   base64url(JSON.stringify({ addr, exp })) . base64url(HMAC-SHA256(payload))
 *
 * It binds one normalised Nimiq address for 12 hours. The signature key is
 * `SESSION_SECRET` (32+ bytes), which exists only in the server environment.
 * There is no money-moving authority in a session: withdrawals stay signed in
 * the browser by the 24-word phrase.
 *
 * Verification checks the signature before the expiry, so a tampered payload
 * is always `bad_signature`, never a misleading `expired`.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** 12 hours. Long enough for a play session; short enough to bound theft. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000

const MIN_SECRET_BYTES = 32

type SessionPayload = {
  addr: string
  exp: number
}

export type VerifySessionResult =
  | { ok: true; address: string; expiresAt: number }
  | { ok: false; reason: 'malformed' | 'expired' | 'bad_signature' }

function sessionSecret(): Buffer {
  const value = process.env.SESSION_SECRET
  if (!value || Buffer.byteLength(value, 'utf8') < MIN_SECRET_BYTES) {
    throw new Error('SESSION_SECRET must be set to at least 32 bytes')
  }
  return Buffer.from(value, 'utf8')
}

function signPayload(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
}

function isBase64Url(value: string): boolean {
  return value.length > 0 && /^[A-Za-z0-9_-]+$/.test(value)
}

/** Mint a token for a wallet. Throws if the secret is missing or too short. */
export function issueSessionToken(
  address: string,
  now: number = Date.now(),
): { token: string; expiresAt: number } {
  const expiresAt = now + SESSION_TTL_MS
  // Keep the caller's formatting: the database stores the wallet's spaced
  // user-friendly address, and exact-match queries must keep working. The
  // signed message binds the normalised form; the HMAC binds this string.
  const payload: SessionPayload = { addr: address.trim(), exp: expiresAt }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const token = `${encoded}.${signPayload(encoded)}`
  return { token, expiresAt }
}

/** Verify shape, signature and expiry. Never throws for a bad token. */
export function verifySessionToken(
  token: string,
  now: number = Date.now(),
): VerifySessionResult {
  const parts = token.split('.')
  if (parts.length !== 2 || !isBase64Url(parts[0]) || !isBase64Url(parts[1])) {
    return { ok: false, reason: 'malformed' }
  }

  const [encoded, provided] = parts
  const expected = signPayload(encoded)

  const providedBytes = Buffer.from(provided, 'base64url')
  const expectedBytes = Buffer.from(expected, 'base64url')
  if (
    providedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(providedBytes, expectedBytes)
  ) {
    return { ok: false, reason: 'bad_signature' }
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'malformed' }
  const { addr, exp } = payload as Partial<SessionPayload>
  if (typeof addr !== 'string' || addr.length === 0) {
    return { ok: false, reason: 'malformed' }
  }
  if (typeof exp !== 'number' || !Number.isSafeInteger(exp)) {
    return { ok: false, reason: 'malformed' }
  }
  if (exp <= now) return { ok: false, reason: 'expired' }

  return { ok: true, address: addr, expiresAt: exp }
}

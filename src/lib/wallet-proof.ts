/**
 * Savborne — wallet proof: Nimiq's signed-message envelope and header parsing
 *
 * A wallet signature is the only thing that distinguishes "this player asked"
 * from "someone knows this player's address". Both the delete flow and the
 * check-in flow use the same bytes and the same shape rules, so they live here
 * once; a drifted copy would make every real signature fail.
 *
 *  - The bytes are Nimiq's, not ours. The wallet signs
 *    `sha256('\x16Nimiq Signed Message:\n' + <UTF-8 BYTE length> + message)`.
 *    Using `String.length` would produce a different payload for any message
 *    containing a non-ASCII character, and the signature would never verify.
 *  - This module is pure (no WASM, no network, no node built-ins) so the same
 *    header parsing runs in the browser and in route handlers, and is testable
 *    without a renderer.
 *
 * Each flow supplies its own header names, namespace and freshness window;
 * nothing here decides what a proof means.
 */

/** How far a signed request time may be from server time, either way. */
export const WALLET_PROOF_MAX_AGE_MS = 120_000

const NIMIQ_MESSAGE_PREFIX = '\x16Nimiq Signed Message:\n'
const encoder = new TextEncoder()

export type WalletProof = {
  /** Ed25519 public key, 64 hex characters. */
  publicKey: string
  /** Ed25519 signature over the hashed payload, 128 hex characters. */
  signature: string
  /** Unix milliseconds at which the client signed. */
  signedAt: number
}

/** The three request headers a proof travels in, named per flow. */
export type WalletProofHeaderNames = {
  publicKey: string
  signature: string
  signedAt: string
}

export type ReadWalletProofResult =
  | { ok: true; proof: WalletProof }
  | { ok: false; reason: 'missing' | 'malformed' | 'stale' }

/**
 * Nimiq's signed-message envelope: a fixed prefix, the message's length in
 * UTF-8 BYTES, then the message itself. Callers hash this with SHA-256.
 */
export function nimiqSignedPayload(message: string): Uint8Array {
  const messageBytes = encoder.encode(message)
  const prefixBytes = encoder.encode(`${NIMIQ_MESSAGE_PREFIX}${messageBytes.length}`)

  const payload = new Uint8Array(prefixBytes.length + messageBytes.length)
  payload.set(prefixBytes, 0)
  payload.set(messageBytes, prefixBytes.length)
  return payload
}

/** Build the three headers the client sends and the server reads. */
export function walletProofHeaders(
  names: WalletProofHeaderNames,
  proof: WalletProof,
): Record<string, string> {
  return {
    [names.publicKey]: proof.publicKey,
    [names.signature]: proof.signature,
    [names.signedAt]: String(proof.signedAt),
  }
}

/**
 * Read and shape-check the proof. This is deliberately not a signature check:
 * it can run before any database access, so a missing or stale proof costs
 * nothing. If the signature itself is wrong, the expensive checks come later.
 */
export function readWalletProof(
  headers: Headers,
  names: WalletProofHeaderNames,
  now: number,
  maxAgeMs: number = WALLET_PROOF_MAX_AGE_MS,
): ReadWalletProofResult {
  const publicKeyRaw = headers.get(names.publicKey)
  const signatureRaw = headers.get(names.signature)
  const signedAtRaw = headers.get(names.signedAt)

  if (!publicKeyRaw || !signatureRaw || !signedAtRaw) {
    return { ok: false, reason: 'missing' }
  }

  const publicKey = normalizeHex(publicKeyRaw)
  const signature = normalizeHex(signatureRaw)
  if (!publicKey || publicKey.length !== 64) return { ok: false, reason: 'malformed' }
  if (!signature || signature.length !== 128) return { ok: false, reason: 'malformed' }

  const signedAtText = signedAtRaw.trim()
  if (!/^\d+$/.test(signedAtText)) return { ok: false, reason: 'malformed' }

  const signedAt = Number(signedAtText)
  if (!Number.isSafeInteger(signedAt)) return { ok: false, reason: 'malformed' }

  // Both directions are bounded: a clock far in the future is as untrustworthy
  // as an old proof.
  if (Math.abs(now - signedAt) > maxAgeMs) {
    return { ok: false, reason: 'stale' }
  }

  return { ok: true, proof: { publicKey, signature, signedAt } }
}

/** Strip an optional `0x` and lowercase; null when it is not hex at all. */
function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^0x/i, '').toLowerCase()
  return /^[0-9a-f]+$/.test(hex) ? hex : null
}

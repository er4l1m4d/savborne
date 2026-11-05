/**
 * Savborne — the delete proof: message, envelope, and header handling
 *
 * Deleting an account is irreversible, and the only thing that makes the
 * request authentic is a wallet signature. Two pieces make that safe:
 *
 *  - The message binds the address, the account's creation time, and the time
 *    the request was signed. Binding `createdAt` stops a proof captured before
 *    a re-onboard from deleting the fresh account; binding `signedAt` bounds
 *    replay to the freshness window.
 *  - The bytes are Nimiq's, not ours. The wallet signs
 *    `sha256('\x16Nimiq Signed Message:\n' + <UTF-8 BYTE length> + message)`.
 *    Using `String.length` would produce a different payload for any message
 *    containing a non-ASCII character, and the signature would never verify.
 *
 * This module is pure (no WASM, no network) so the same header parsing runs in
 * the browser and in the route handler, and is testable without a renderer.
 */

import { normalizeAddress } from './vault/address'

export const DELETE_PUBLIC_KEY_HEADER = 'X-Savborne-Delete-Public-Key'
export const DELETE_SIGNATURE_HEADER = 'X-Savborne-Delete-Signature'
export const DELETE_SIGNED_AT_HEADER = 'X-Savborne-Delete-Signed-At'

/** How far the signed request time may be from server time, either way. */
export const DELETE_PROOF_MAX_AGE_MS = 120_000

const NIMIQ_MESSAGE_PREFIX = '\x16Nimiq Signed Message:\n'
const encoder = new TextEncoder()

export type DeleteProof = {
  /** Ed25519 public key, 64 hex characters. */
  publicKey: string
  /** Ed25519 signature over the hashed payload, 128 hex characters. */
  signature: string
  /** Unix milliseconds at which the client signed. */
  signedAt: number
}

export type ReadDeleteProofResult =
  | { ok: true; proof: DeleteProof }
  | { ok: false; reason: 'missing' | 'malformed' | 'stale' }

/** The exact message the player signs. Stable across client and server. */
export function deleteMessage(args: {
  address: string
  createdAt: string
  signedAt: number
}): string {
  return [
    'Savborne account deletion',
    `Address: ${normalizeAddress(args.address)}`,
    `Created: ${args.createdAt}`,
    `Signed at: ${args.signedAt}`,
    'This signature proves I can reach the 24 words that control this vault.',
  ].join('\n')
}

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
export function deleteAuthHeaders(proof: DeleteProof): Record<string, string> {
  return {
    [DELETE_PUBLIC_KEY_HEADER]: proof.publicKey,
    [DELETE_SIGNATURE_HEADER]: proof.signature,
    [DELETE_SIGNED_AT_HEADER]: String(proof.signedAt),
  }
}

/**
 * Read and shape-check the proof. This is deliberately not a signature check:
 * it can run before any database access, so a missing or stale proof costs
 * nothing. If the signature itself is wrong, the expensive checks come later.
 */
export function readDeleteProof(headers: Headers, now: number): ReadDeleteProofResult {
  const publicKeyRaw = headers.get(DELETE_PUBLIC_KEY_HEADER)
  const signatureRaw = headers.get(DELETE_SIGNATURE_HEADER)
  const signedAtRaw = headers.get(DELETE_SIGNED_AT_HEADER)

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
  if (Math.abs(now - signedAt) > DELETE_PROOF_MAX_AGE_MS) {
    return { ok: false, reason: 'stale' }
  }

  return { ok: true, proof: { publicKey, signature, signedAt } }
}

/** Strip an optional `0x` and lowercase; null when it is not hex at all. */
function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^0x/i, '').toLowerCase()
  return /^[0-9a-f]+$/.test(hex) ? hex : null
}

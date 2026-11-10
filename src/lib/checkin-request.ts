/**
 * Savborne — the check-in proof: message, headers, and shape checks
 *
 * Checking in writes a reading, XP, badges and withdrawal flags for a player,
 * so `X-Player-Address` alone cannot be the authority: anyone who knows an
 * address could run someone else's ritual. The request must carry a wallet
 * signature over a message that names the player and the action.
 *
 * The message binds exactly three things the server does not have to look up:
 *
 *  - the namespace (`Savborne check-in`), which is not the delete namespace, so
 *    a delete signature can never authorise a check-in;
 *  - the normalised player address and the action string, so a proof for
 *    another player or another action fails;
 *  - the signed-at time, which bounds replay to the freshness window.
 *
 * It deliberately does not bind the vault address or the balance: the server
 * reads those itself, and binding them would force a database read before the
 * signature could be checked at all.
 *
 * This module is pure (no WASM, no network, no node built-ins) so the same
 * parsing runs in the browser and in the route handler.
 */

import { normalizeAddress } from './vault/address'
import {
  WALLET_PROOF_MAX_AGE_MS,
  readWalletProof,
  walletProofHeaders,
  type ReadWalletProofResult,
  type WalletProof,
  type WalletProofHeaderNames,
} from './wallet-proof'

export const CHECKIN_PUBLIC_KEY_HEADER = 'X-Savborne-Check-In-Public-Key'
export const CHECKIN_SIGNATURE_HEADER = 'X-Savborne-Check-In-Signature'
export const CHECKIN_SIGNED_AT_HEADER = 'X-Savborne-Check-In-Signed-At'

/** How far the signed request time may be from server time, either way. */
export const CHECKIN_PROOF_MAX_AGE_MS = WALLET_PROOF_MAX_AGE_MS

/**
 * The action the signed message authorises. A future claim path must use its
 * own action string so a check-in proof cannot authorise it.
 */
export const CHECKIN_ACTION = 'check-in'

const CHECKIN_HEADERS: WalletProofHeaderNames = {
  publicKey: CHECKIN_PUBLIC_KEY_HEADER,
  signature: CHECKIN_SIGNATURE_HEADER,
  signedAt: CHECKIN_SIGNED_AT_HEADER,
}

/** The exact message the player signs. Stable across client and server. */
export function checkInMessage(args: {
  address: string
  action?: string
  signedAt: number
}): string {
  return [
    'Savborne check-in',
    `Address: ${normalizeAddress(args.address)}`,
    `Action: ${args.action ?? CHECKIN_ACTION}`,
    `Signed at: ${args.signedAt}`,
    "This signature proves I control this player's wallet.",
  ].join('\n')
}

/** Build the three headers the client sends and the server reads. */
export function checkInAuthHeaders(proof: WalletProof): Record<string, string> {
  return walletProofHeaders(CHECKIN_HEADERS, proof)
}

/** Read and shape-check the proof before any database or chain access. */
export function readCheckInProof(headers: Headers, now: number): ReadWalletProofResult {
  return readWalletProof(headers, CHECKIN_HEADERS, now, CHECKIN_PROOF_MAX_AGE_MS)
}

/** Turn a proof rejection into something a player can act on. */
export function checkInErrorMessage(code: string | undefined, status: number): string {
  switch (code) {
    case 'missing':
      return 'Nimiq Pay did not sign the check-in. Tap Check in now to try again.'
    case 'stale':
      return 'Confirming took too long. Tap Check in now to try again.'
    case 'malformed':
    case 'bad_signature':
      return 'The wallet signature did not match this check-in. Try again.'
    case 'wrong_signer':
      return 'Nimiq Pay signed with a different account. Switch back to this one and try again.'
    default:
      return `Check-in failed (${status}).`
  }
}

/**
 * Savborne - the session proof: message, action, and body shape
 *
 * The session signature is a wallet consent, not a game action. It uses its own
 * namespace so a session proof can never authorise a check-in or a deletion,
 * and vice versa. It binds the normalised address and the signed-at time, and
 * shares the 120s freshness window with the other wallet proofs.
 */

import { normalizeAddress } from './vault/address'
import {
  WALLET_PROOF_MAX_AGE_MS,
  readWalletProofFields,
  type ReadWalletProofResult,
} from './wallet-proof'

/** The action a session signature authorises. */
export const SESSION_ACTION = 'session'

export const SESSION_PROOF_MAX_AGE_MS = WALLET_PROOF_MAX_AGE_MS

/** The exact message the player signs. Stable across client and server. */
export function sessionMessage(args: { address: string; signedAt: number }): string {
  return [
    'Savborne session',
    `Address: ${normalizeAddress(args.address)}`,
    `Action: ${SESSION_ACTION}`,
    `Signed at: ${args.signedAt}`,
    'This signature starts a 12-hour Savborne session for this wallet.',
  ].join('\n')
}

/**
 * Shape-check the proof fields from a JSON body. Signature verification is a
 * separate, later step so a missing or stale proof costs no crypto or I/O.
 */
export function readSessionProof(body: unknown, now: number): ReadWalletProofResult {
  const record = (body ?? {}) as Record<string, unknown>
  return readWalletProofFields(
    {
      publicKey: record.publicKey,
      signature: record.signature,
      signedAt: record.signedAt,
    },
    now,
    SESSION_PROOF_MAX_AGE_MS,
  )
}

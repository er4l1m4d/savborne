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
 *  - The bytes are Nimiq's, not ours (see `wallet-proof.ts`).
 *
 * The envelope and the header shape rules are shared with the check-in proof.
 * The namespace, the message text, the header names and the meaning are not:
 * a delete signature can never authorise a check-in, or the reverse.
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

export const DELETE_PUBLIC_KEY_HEADER = 'X-Savborne-Delete-Public-Key'
export const DELETE_SIGNATURE_HEADER = 'X-Savborne-Delete-Signature'
export const DELETE_SIGNED_AT_HEADER = 'X-Savborne-Delete-Signed-At'

/** How far the signed request time may be from server time, either way. */
export const DELETE_PROOF_MAX_AGE_MS = WALLET_PROOF_MAX_AGE_MS

export type DeleteProof = WalletProof
export type ReadDeleteProofResult = ReadWalletProofResult

const DELETE_HEADERS: WalletProofHeaderNames = {
  publicKey: DELETE_PUBLIC_KEY_HEADER,
  signature: DELETE_SIGNATURE_HEADER,
  signedAt: DELETE_SIGNED_AT_HEADER,
}

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

/** Build the three headers the client sends and the server reads. */
export function deleteAuthHeaders(proof: DeleteProof): Record<string, string> {
  return walletProofHeaders(DELETE_HEADERS, proof)
}

/**
 * Read and shape-check the proof. This is deliberately not a signature check:
 * it can run before any database access, so a missing or stale proof costs
 * nothing. If the signature itself is wrong, the expensive checks come later.
 */
export function readDeleteProof(headers: Headers, now: number): ReadDeleteProofResult {
  return readWalletProof(headers, DELETE_HEADERS, now, DELETE_PROOF_MAX_AGE_MS)
}

export { nimiqSignedPayload } from './wallet-proof'

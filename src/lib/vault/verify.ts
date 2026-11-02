/**
 * Savborne — transfer verification (pure)
 *
 * A client-supplied { txHash, amountLuna } is a claim; the chain transaction is
 * the fact. This module decides whether the claim is true. It performs no I/O
 * and imports no WASM, so it is shared by route handlers and tests.
 *
 * The check order is deliberate: it determines which failure reason the user
 * sees, and a wrong-network transaction is the most confusing, so it is
 * reported first.
 */

import { sameAddress } from './address'
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

export function verifyClaim(tx: ChainTransaction, claim: VerifyClaim): VerifyResult {
  // 1. Wrong network. Defensive: in practice the transaction is read from the
  //    vault's own chain, so a foreign-network transaction appears as
  //    not-found. It costs one comparison and documents the assumption.
  if (tx.networkId !== claim.networkId) {
    return { ok: false, reason: 'wrong_network' }
  }

  // 2. Included but reverted. Never credit money that did not move.
  if (!tx.executionResult) {
    return { ok: false, reason: 'execution_failed' }
  }

  // 3. Direction: where the money must have gone / come from.
  if (claim.direction === 'in') {
    if (!sameAddress(tx.to, claim.vaultAddress)) {
      return { ok: false, reason: 'wrong_recipient' }
    }
  } else {
    if (!sameAddress(tx.from, claim.vaultAddress)) {
      return { ok: false, reason: 'wrong_sender' }
    }
    if (!sameAddress(tx.to, claim.playerAddress)) {
      return { ok: false, reason: 'wrong_recipient' }
    }
  }

  // 4. Amount. The client knows what it signed; a mismatch is a visible error
  //    rather than a silent under-credit.
  if (tx.valueLuna !== claim.amountLuna) {
    return { ok: false, reason: 'wrong_amount' }
  }

  return { ok: true }
}

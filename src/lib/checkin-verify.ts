/**
 * Savborne — verify the check-in signature (server only)
 *
 * The signature check itself is shared with the delete proof
 * (`wallet-proof-verify.ts`). What makes it a *check-in* authorisation is the
 * message: the check-in namespace, this player's address, the `check-in`
 * action and the signed-at time. The server always rebuilds that message with
 * its own action constant, so a proof signed for any other action is a bad
 * signature.
 */

import { checkInMessage, CHECKIN_ACTION } from './checkin-request'
import {
  verifyWalletSignature,
  type WalletVerifyResult,
} from './wallet-proof-verify'
import type { WalletProof } from './wallet-proof'

export type CheckInVerifyResult = WalletVerifyResult

export async function verifyCheckInSignature(args: {
  address: string
  proof: WalletProof
}): Promise<CheckInVerifyResult> {
  return verifyWalletSignature({
    message: checkInMessage({
      address: args.address,
      action: CHECKIN_ACTION,
      signedAt: args.proof.signedAt,
    }),
    address: args.address,
    proof: args.proof,
  })
}

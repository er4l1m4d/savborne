/**
 * Savborne — verify the delete signature (server only)
 *
 * The signature check itself is shared with the check-in proof
 * (`wallet-proof-verify.ts`). What makes it a *delete* authorisation is the
 * message: it names this address and this account's creation time, in the
 * deletion namespace. A check-in proof signs different bytes and therefore
 * cannot delete an account.
 */

import { deleteMessage, type DeleteProof } from './delete-request'
import {
  verifyWalletSignature,
  type WalletVerifyResult,
} from './wallet-proof-verify'

export type DeleteVerifyResult = WalletVerifyResult

export async function verifyDeleteSignature(args: {
  address: string
  createdAt: string
  proof: DeleteProof
}): Promise<DeleteVerifyResult> {
  return verifyWalletSignature({
    message: deleteMessage({
      address: args.address,
      createdAt: args.createdAt,
      signedAt: args.proof.signedAt,
    }),
    address: args.address,
    proof: args.proof,
  })
}

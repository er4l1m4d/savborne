/**
 * Savborne - verify the session signature (server only)
 *
 * Same cryptographic check as check-in and delete; the message makes it a
 * session authorisation. The key must derive the claimed address, so a
 * signature from another wallet is `wrong_signer`.
 */

import { sessionMessage } from './session-request'
import {
  verifyWalletSignature,
  type WalletVerifyResult,
} from './wallet-proof-verify'
import type { WalletProof } from './wallet-proof'

export type SessionVerifyResult = WalletVerifyResult

export async function verifySessionSignature(args: {
  address: string
  proof: WalletProof
}): Promise<SessionVerifyResult> {
  return verifyWalletSignature({
    message: sessionMessage({ address: args.address, signedAt: args.proof.signedAt }),
    address: args.address,
    proof: args.proof,
  })
}

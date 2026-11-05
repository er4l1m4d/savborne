/**
 * Savborne — verify the delete signature (server only)
 *
 * The client can send any public key, so a valid signature alone proves only
 * that *someone* signed the message. Two checks make it authorisation:
 *
 *  1. the signature verifies against the message built from the header address
 *     and the stored account creation time; and
 *  2. the signing key derives the header address. Without this, an attacker
 *     could sign a message naming a victim's address with their own key.
 *
 * `@nimiq/core` is imported lazily: it is a WASM module that must never enter a
 * client bundle (the browser copy lives in `vault/phrase.ts`), and the static
 * import would also make the test runner load WASM before it is needed.
 */

import { createHash } from 'node:crypto'

import { deleteMessage, nimiqSignedPayload, type DeleteProof } from './delete-request'
import { sameAddress } from './vault/address'

type NimiqNode = typeof import('@nimiq/core')

export type DeleteVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'wrong_signer' }

let nimiqPromise: Promise<NimiqNode> | null = null

async function loadNimiq(): Promise<NimiqNode> {
  if (!nimiqPromise) {
    nimiqPromise = import('@nimiq/core').catch((err) => {
      nimiqPromise = null
      throw err
    })
  }
  return nimiqPromise
}

export async function verifyDeleteSignature(args: {
  address: string
  createdAt: string
  proof: DeleteProof
}): Promise<DeleteVerifyResult> {
  const mod = await loadNimiq()

  let publicKey
  let signature
  try {
    publicKey = mod.PublicKey.fromHex(args.proof.publicKey)
    signature = mod.Signature.fromHex(args.proof.signature)
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  const message = deleteMessage({
    address: args.address,
    createdAt: args.createdAt,
    signedAt: args.proof.signedAt,
  })
  const hash = createHash('sha256').update(nimiqSignedPayload(message)).digest()

  let valid: boolean
  try {
    valid = publicKey.verify(signature, hash)
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!valid) return { ok: false, reason: 'bad_signature' }

  // The key must control the address the request claims. This is the check that
  // separates "someone consented" from "the account owner consented".
  const signer = publicKey.toAddress().toUserFriendlyAddress()
  if (!sameAddress(signer, args.address)) {
    return { ok: false, reason: 'wrong_signer' }
  }

  return { ok: true }
}

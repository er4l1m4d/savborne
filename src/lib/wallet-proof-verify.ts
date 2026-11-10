/**
 * Savborne — verify a wallet signature (server only)
 *
 * The client can send any public key, so a valid signature alone proves only
 * that *someone* signed the message. Two checks make it authorisation:
 *
 *  1. the signature verifies against the exact message this server rebuilds
 *     from its own fields; and
 *  2. the signing key derives the address the request claims. Without this, an
 *     attacker could sign a message naming a victim's address with their own
 *     key.
 *
 * The caller owns the message: it binds the namespace, the address, the action
 * and the signed-at time for its flow. This module only answers "did this key
 * sign these bytes, and does that key control this address?".
 *
 * `@nimiq/core` is imported lazily: it is a WASM module that must never enter a
 * client bundle (the browser copy lives in `vault/phrase.ts`), and the static
 * import would also make the test runner load WASM before it is needed.
 */

import { createHash } from 'node:crypto'

import { nimiqSignedPayload, type WalletProof } from './wallet-proof'
import { sameAddress } from './vault/address'

type NimiqNode = typeof import('@nimiq/core')

export type WalletVerifyResult =
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

export async function verifyWalletSignature(args: {
  message: string
  address: string
  proof: WalletProof
}): Promise<WalletVerifyResult> {
  const mod = await loadNimiq()

  let publicKey
  let signature
  try {
    publicKey = mod.PublicKey.fromHex(args.proof.publicKey)
    signature = mod.Signature.fromHex(args.proof.signature)
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  const hash = createHash('sha256').update(nimiqSignedPayload(args.message)).digest()

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

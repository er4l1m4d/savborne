/**
 * Savborne — shared real-keypair signer for tests
 *
 * Tests exercise the production verifiers with real Ed25519 signatures, never a
 * mock: the whole point of the proof is that the bytes and the key are real.
 *
 * Signing here mirrors what Nimiq Pay does: hash Nimiq's signed-message
 * envelope with SHA-256, then sign the digest. A test that builds its own
 * envelope would stop testing the shared one.
 */

import { createHash } from 'node:crypto'

import { nimiqSignedPayload } from '@/lib/wallet-proof'

export type TestSigner = {
  /** The user-friendly address the key controls. */
  address: string
  /** 64-hex public key. */
  publicKey: string
  /** Sign `message` exactly as the wallet would and return the raw proof parts. */
  sign(message: string): Promise<{ publicKey: string; signature: string }>
}

export async function newWalletSigner(): Promise<TestSigner> {
  const { KeyPair, Signature } = await import('@nimiq/core')
  const keyPair = KeyPair.generate()
  const publicKey = keyPair.publicKey.toHex()

  return {
    address: keyPair.publicKey.toAddress().toUserFriendlyAddress(),
    publicKey,
    async sign(message: string) {
      const hash = createHash('sha256').update(nimiqSignedPayload(message)).digest()
      const signature = Signature.create(keyPair.privateKey, keyPair.publicKey, hash)
      return { publicKey, signature: signature.toHex() }
    },
  }
}

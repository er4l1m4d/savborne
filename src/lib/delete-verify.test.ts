/**
 * The signature check is the only thing standing between a stolen address header
 * and an irreversible delete, so each branch is pinned with a REAL keypair:
 * `@nimiq/core` signs, the production verifier checks.
 *
 * The distinctions that matter:
 *  - a proof from key A does not verify against key B (`bad_signature`);
 *  - a valid signature over a message naming an address the key does not
 *    control is not authorisation (`wrong_signer`) — otherwise anyone could
 *    sign a message containing a victim's address and delete their account;
 *  - the message binds the account's creation time, so a proof made before a
 *    re-onboard cannot delete the fresh account.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { deleteMessage, nimiqSignedPayload } from './delete-request'
import { verifyDeleteSignature } from './delete-verify'

const CREATED_AT = '2026-11-03T18:20:00.123Z'
const SIGNED_AT = 1762300000000
/** A plausible address no generated test key will control. */
const VICTIM = 'NQ83 P433 8LLX 6Y22 79T8 TT3S F311 XXQJ 01TS'

/**
 * Sign `createdAt`/`signedAt` with a freshly generated key. When `address` is
 * given, the message names it even though the key does not control it — that is
 * exactly the impersonation shape the verifier must reject.
 */
async function signed(address: string | null, createdAt = CREATED_AT, signedAt = SIGNED_AT) {
  const { KeyPair, Signature } = await import('@nimiq/core')
  const keyPair = KeyPair.generate()
  const signerAddress = keyPair.publicKey.toAddress().toUserFriendlyAddress()
  const namedAddress = address ?? signerAddress

  const message = deleteMessage({ address: namedAddress, createdAt, signedAt })
  const hash = createHash('sha256').update(nimiqSignedPayload(message)).digest()
  const signature = Signature.create(keyPair.privateKey, keyPair.publicKey, hash)

  return {
    address: namedAddress,
    signerAddress,
    proof: {
      publicKey: keyPair.publicKey.toHex(),
      signature: signature.toHex(),
      signedAt,
    },
  }
}

test('a proof signed by the address it names verifies', async () => {
  const { address, proof } = await signed(null)
  assert.deepEqual(
    await verifyDeleteSignature({ address, createdAt: CREATED_AT, proof }),
    { ok: true },
  )
})

test('the same address with different spacing or case still verifies', async () => {
  const { signerAddress, proof } = await signed(null)
  assert.deepEqual(
    await verifyDeleteSignature({
      address: signerAddress.replace(/\s/g, '').toLowerCase(),
      createdAt: CREATED_AT,
      proof,
    }),
    { ok: true },
  )
})

test('a proof from one key does not verify against another key', async () => {
  const mine = await signed(null)
  const theirs = await signed(null)
  assert.deepEqual(
    await verifyDeleteSignature({
      address: mine.address,
      createdAt: CREATED_AT,
      proof: { ...mine.proof, publicKey: theirs.proof.publicKey },
    }),
    { ok: false, reason: 'bad_signature' },
  )
})

test('a valid signature over a different account creation time is rejected', async () => {
  const { address, proof } = await signed(null)
  assert.deepEqual(
    await verifyDeleteSignature({
      address,
      createdAt: '2026-11-04T00:00:00.000Z',
      proof,
    }),
    { ok: false, reason: 'bad_signature' },
  )
})

test('signing a message that names someone else is not authorisation', async () => {
  // The attacker signs a message naming the victim, with their own key. The
  // signature is valid; the address it derives does not match.
  const { proof } = await signed(VICTIM)
  assert.deepEqual(
    await verifyDeleteSignature({ address: VICTIM, createdAt: CREATED_AT, proof }),
    { ok: false, reason: 'wrong_signer' },
  )
})

test('a signature that is the wrong shape is malformed, not a bad signature', async () => {
  const { address, proof } = await signed(null)
  for (const bad of [
    { ...proof, publicKey: 'zz'.repeat(32) },
    { ...proof, publicKey: 'ab'.repeat(31) },
    { ...proof, signature: 'zz'.repeat(64) },
    { ...proof, signature: 'cd'.repeat(63) },
  ]) {
    assert.deepEqual(
      await verifyDeleteSignature({ address, createdAt: CREATED_AT, proof: bad }),
      { ok: false, reason: 'malformed' },
      JSON.stringify(bad).slice(0, 50),
    )
  }
})

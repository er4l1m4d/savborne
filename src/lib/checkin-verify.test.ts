/**
 * The check-in signature check is what stops a stolen address header from
 * running someone else's ritual. Each branch is pinned with a REAL keypair:
 * `@nimiq/core` signs, the production verifier checks.
 *
 * The distinctions that matter:
 *  - a proof from key A does not verify against key B (`bad_signature`);
 *  - a valid signature over a message naming an address the key does not
 *    control is not authorisation (`wrong_signer`);
 *  - a proof signed for another action, or in the delete namespace, does not
 *    verify against the check-in message.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CHECKIN_ACTION, checkInMessage } from './checkin-request'
import { verifyCheckInSignature } from './checkin-verify'
import { deleteMessage } from './delete-request'
import { newWalletSigner } from '@/test/wallet-signer'

const SIGNED_AT = 1762300000000
/** A plausible address no generated test key will control. */
const VICTIM = 'NQ83 P433 8LLX 6Y22 79T8 TT3S F311 XXQJ 01TS'

/** Sign a message with a fresh key; `named` impersonates another address. */
async function signed(args: {
  named?: string
  action?: string
  message?: string
} = {}) {
  const signer = await newWalletSigner()
  const message =
    args.message ??
    checkInMessage({
      address: args.named ?? signer.address,
      action: args.action,
      signedAt: SIGNED_AT,
    })
  return {
    signer,
    address: args.named ?? signer.address,
    proof: { ...(await signer.sign(message)), signedAt: SIGNED_AT },
  }
}

test('a proof signed by the address it names verifies', async () => {
  const { address, proof } = await signed()
  assert.deepEqual(await verifyCheckInSignature({ address, proof }), { ok: true })
})

test('the same address with different spacing or case still verifies', async () => {
  const { signer, proof } = await signed()
  assert.deepEqual(
    await verifyCheckInSignature({
      address: signer.address.replace(/\s/g, '').toLowerCase(),
      proof,
    }),
    { ok: true },
  )
})

test('a proof from one key does not verify against another key', async () => {
  const mine = await signed()
  const theirs = await signed()
  assert.deepEqual(
    await verifyCheckInSignature({
      address: mine.address,
      proof: { ...mine.proof, publicKey: theirs.proof.publicKey },
    }),
    { ok: false, reason: 'bad_signature' },
  )
})

test('a proof signed for a different action is rejected', async () => {
  const { address, proof } = await signed({ action: 'claim' })
  assert.deepEqual(
    await verifyCheckInSignature({ address, proof }),
    { ok: false, reason: 'bad_signature' },
  )
})

test('a valid signature naming someone else is not authorisation', async () => {
  // The attacker signs a message naming the victim, with their own key. The
  // signature is valid; the address it derives does not match.
  const { proof } = await signed({ named: VICTIM })
  assert.deepEqual(
    await verifyCheckInSignature({ address: VICTIM, proof }),
    { ok: false, reason: 'wrong_signer' },
  )
})

test('a delete-namespace signature does not authorise a check-in', async () => {
  const signer = await newWalletSigner()
  const message = deleteMessage({
    address: signer.address,
    createdAt: '2026-11-03T18:20:00.123Z',
    signedAt: SIGNED_AT,
  })
  const proof = { ...(await signer.sign(message)), signedAt: SIGNED_AT }
  assert.deepEqual(
    await verifyCheckInSignature({ address: signer.address, proof }),
    { ok: false, reason: 'bad_signature' },
  )
})

test('the server always expects the check-in action', async () => {
  // A proof signed with the default action verifies; the verifier cannot be
  // asked to accept another action for the same route.
  const { address, proof } = await signed({ action: CHECKIN_ACTION })
  assert.deepEqual(await verifyCheckInSignature({ address, proof }), { ok: true })
})

test('a signature that is the wrong shape is malformed, not a bad signature', async () => {
  const { address, proof } = await signed()
  for (const bad of [
    { ...proof, publicKey: 'zz'.repeat(32) },
    { ...proof, publicKey: 'ab'.repeat(31) },
    { ...proof, signature: 'zz'.repeat(64) },
    { ...proof, signature: 'cd'.repeat(63) },
  ]) {
    assert.deepEqual(
      await verifyCheckInSignature({ address, proof: bad }),
      { ok: false, reason: 'malformed' },
      JSON.stringify(bad).slice(0, 50),
    )
  }
})

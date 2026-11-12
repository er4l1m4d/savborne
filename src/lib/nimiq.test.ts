import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signingAccount } from './nimiq'

test('identity uses the wallet signing address, never the HTLC address', () => {
  const wallet = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
  const htlc = 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL'

  // Nimiq Pay documents this order: wallet address first, HTLC second.
  assert.equal(signingAccount([wallet, htlc]), wallet)
  assert.equal(signingAccount([wallet]), wallet)
})

test('an empty or malformed account list has no signer', () => {
  assert.equal(signingAccount([]), null)
  assert.equal(signingAccount(['']), null)
})

/**
 * Task 9 — does this chain transaction satisfy this claim?
 *
 * This is the money check. A client-supplied hash is a claim, not a fact;
 * `verifyClaim` decides whether the server is willing to credit it. The order
 * of checks decides which reason the user is shown, so it is part of the
 * contract and is asserted here.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { ChainTransaction } from './rpc'
import { verifyClaim, type VerifyClaim } from './verify'

const VAULT = 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL'
const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const OTHER = 'NQ90 UBCH 1T6J 500V DVDR A1H6 X55M P96U GRS7'

const AMOUNT = 100_000

function tx(overrides: Partial<ChainTransaction>): ChainTransaction {
  return {
    hash: 'ab'.repeat(32),
    blockNumber: 15_709_650,
    from: PLAYER,
    to: VAULT,
    valueLuna: AMOUNT,
    feeLuna: 0,
    networkId: 5,
    executionResult: true,
    confirmations: 1,
    ...overrides,
  }
}

function claim(overrides: Partial<VerifyClaim> = {}): VerifyClaim {
  return {
    direction: 'in',
    amountLuna: AMOUNT,
    vaultAddress: VAULT,
    playerAddress: PLAYER,
    networkId: 5,
    ...overrides,
  }
}

test('a correct deposit verifies', () => {
  assert.deepEqual(verifyClaim(tx({}), claim()), { ok: true })
})

test('a correct withdrawal verifies', () => {
  const withdrawal = tx({ from: VAULT, to: PLAYER })
  assert.deepEqual(verifyClaim(withdrawal, claim({ direction: 'out' })), { ok: true })
})

test('addresses differing only by spacing or case still verify', () => {
  const spaced = tx({
    from: 'nq81001nbase00000000000000000000000000',
    to: 'nq572f6cx3gby9b704u52bva4bvcm2t0elrl',
  })
  assert.deepEqual(verifyClaim(spaced, claim()), { ok: true })
})

test('the wrong network id beats every other check', () => {
  const wrong = tx({ networkId: 24, to: OTHER, valueLuna: 1 })
  assert.deepEqual(verifyClaim(wrong, claim()), { ok: false, reason: 'wrong_network' })
})

test('a failed execution is rejected before recipients are checked', () => {
  const failed = tx({ executionResult: false, to: OTHER, valueLuna: 1 })
  assert.deepEqual(verifyClaim(failed, claim()), { ok: false, reason: 'execution_failed' })
})

test('a deposit to the wrong recipient is rejected', () => {
  assert.deepEqual(verifyClaim(tx({ to: OTHER }), claim()), {
    ok: false,
    reason: 'wrong_recipient',
  })
})

test('a withdrawal from the wrong sender is rejected', () => {
  const wrongSender = tx({ from: OTHER, to: PLAYER })
  assert.deepEqual(verifyClaim(wrongSender, claim({ direction: 'out' })), {
    ok: false,
    reason: 'wrong_sender',
  })
})

test('a withdrawal to anything but the player identity account is rejected', () => {
  const wrongRecipient = tx({ from: VAULT, to: OTHER })
  assert.deepEqual(verifyClaim(wrongRecipient, claim({ direction: 'out' })), {
    ok: false,
    reason: 'wrong_recipient',
  })
})

test('an amount mismatch is rejected', () => {
  assert.deepEqual(verifyClaim(tx({ valueLuna: AMOUNT + 1 }), claim()), {
    ok: false,
    reason: 'wrong_amount',
  })
})

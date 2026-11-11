/**
 * Decimal NIM -> Luna: the bug this prevents is real money.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseNimToLuna } from './amount'

test('whole and fractional NIM convert exactly', () => {
  assert.equal(parseNimToLuna('1'), 100_000)
  assert.equal(parseNimToLuna('1.05'), 105_000)
  assert.equal(parseNimToLuna('0.5'), 50_000)
  assert.equal(parseNimToLuna('.25'), 25_000)
  assert.equal(parseNimToLuna('12.34567'), 1_234_567)
})

test('the floating-point trap is gone', () => {
  // Number('1.005') * 100000 === 100499.99999999999
  assert.equal(parseNimToLuna('1.005', 2), null)
  assert.equal(parseNimToLuna('1.005'), 100_500)
  assert.equal(parseNimToLuna('0.29', 2), 29_000)
  assert.equal(parseNimToLuna('0.07', 2), 7_000)
})

test('more decimals than allowed is rejected, never rounded', () => {
  assert.equal(parseNimToLuna('1.234', 2), null)
  assert.equal(parseNimToLuna('0.000001'), null)
})

test('malformed, zero and negative values are rejected', () => {
  for (const value of ['', ' ', 'abc', '1,5', '-1', '0', '0.0', '.', '1e3']) {
    assert.equal(parseNimToLuna(value), null, JSON.stringify(value))
  }
})

test('an amount beyond the safe integer range is rejected', () => {
  assert.equal(parseNimToLuna('999999999999'), null)
})

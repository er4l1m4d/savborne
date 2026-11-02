/**
 * Task 3 — network constants and address helpers.
 *
 * These values are measured, not recalled (spec §17):
 *   mainnet network id 24, testnet 5
 *   explorer links use `/#<hash>`; the `/tx/<hash>` path 404s
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  VAULT_NETWORK_ID,
  VAULT_RPC_URL,
  explorerTxUrl,
  isNetwork,
} from './network'
import {
  isPlausibleAddress,
  normalizeAddress,
  sameAddress,
  shortenAddress,
} from './address'

const HASH = 'ab'.repeat(32)
// Shape-valid only: isPlausibleAddress checks length and alphabet, never the
// checksum. Authorisation always goes through the chain or the vault mapping.
const PLAUSIBLE = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'

test('network ids are the measured mainnet 24 / testnet 5', () => {
  assert.equal(VAULT_NETWORK_ID.mainnet, 24)
  assert.equal(VAULT_NETWORK_ID.testnet, 5)
})

test('rpc urls are https and distinct per network', () => {
  assert.match(VAULT_RPC_URL.mainnet, /^https:\/\//)
  assert.match(VAULT_RPC_URL.testnet, /^https:\/\//)
  assert.notEqual(VAULT_RPC_URL.mainnet, VAULT_RPC_URL.testnet)
})

test('mainnet explorer link uses nimiq.watch with a # fragment', () => {
  assert.equal(explorerTxUrl('mainnet', HASH), `https://nimiq.watch/#${HASH}`)
  assert.ok(!explorerTxUrl('mainnet', HASH).includes('/tx/'))
})

test('testnet explorer link uses test.nimiq.watch', () => {
  assert.equal(explorerTxUrl('testnet', HASH), `https://test.nimiq.watch/#${HASH}`)
})

test('isNetwork accepts the two real networks and nothing else', () => {
  assert.equal(isNetwork('mainnet'), true)
  assert.equal(isNetwork('testnet'), true)
  assert.equal(isNetwork('devnet'), false)
  assert.equal(isNetwork(undefined), false)
  assert.equal(isNetwork(null), false)
})

test('normalizeAddress removes spaces and uppercases', () => {
  assert.equal(
    normalizeAddress('nq07 0000 0000 0000 0000 0000 0000 0000 0000'),
    'NQ0700000000000000000000000000000000',
  )
})

test('sameAddress ignores spacing and case', () => {
  assert.equal(
    sameAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000', 'nq0700000000000000000000000000000000'),
    true,
  )
  assert.equal(
    sameAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000', 'NQ07 0000 0000 0000 0000 0000 0000 0000 0001'),
    false,
  )
})

test('isPlausibleAddress checks NQ + 34 base32 characters', () => {
  assert.equal(isPlausibleAddress(PLAUSIBLE), true)
  assert.equal(isPlausibleAddress('nq07 0000 0000 0000 0000 0000'), false)
  assert.equal(isPlausibleAddress(''), false)
  assert.equal(isPlausibleAddress(42), false)
})

test('shortenAddress keeps the first and last two groups', () => {
  assert.equal(
    shortenAddress('NQ07 0000 1111 2222 3333 4444 5555 6666 7777'),
    'NQ07 0000 … 6666 7777',
  )
})

test('shortenAddress returns a short address in full', () => {
  assert.equal(shortenAddress('NQ07 0000 1111 2222'), 'NQ07 0000 1111 2222')
})

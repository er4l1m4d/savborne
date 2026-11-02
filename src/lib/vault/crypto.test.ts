/**
 * Task 11 — encryption at rest.
 *
 * A low iteration count keeps the suite fast; the production default is
 * 210_000 and is asserted separately.
 *
 * The phrase crosses this boundary as `string[]`, the same shape the grid
 * renders and the mnemonic joins. A string/string[] mismatch here would
 * encrypt the wrong thing.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { PBKDF2_ITERATIONS, decryptPhrase, encryptPhrase } from './crypto'
import { VaultLockedError } from './errors'

const PHRASE = Array.from({ length: 24 }, (_, i) => `word${i + 1}`)
const FAST = { iterations: 1_000 }

test('the production iteration count is 210000', () => {
  assert.equal(PBKDF2_ITERATIONS, 210_000)
})

test('a phrase round-trips', async () => {
  const blob = await encryptPhrase(PHRASE, 'correct horse battery', FAST)
  assert.deepEqual(await decryptPhrase(blob, 'correct horse battery'), PHRASE)
})

test('the wrong passphrase rejects with VaultLockedError', async () => {
  const blob = await encryptPhrase(PHRASE, 'correct horse battery', FAST)
  await assert.rejects(
    () => decryptPhrase(blob, 'wrong horse battery'),
    (err: unknown) => err instanceof VaultLockedError,
  )
})

test('tampering with the ciphertext rejects', async () => {
  const blob = await encryptPhrase(PHRASE, 'correct horse battery', FAST)
  const tampered = {
    ...blob,
    ciphertext: blob.ciphertext.startsWith('A')
      ? `B${blob.ciphertext.slice(1)}`
      : `A${blob.ciphertext.slice(1)}`,
  }
  await assert.rejects(
    () => decryptPhrase(tampered, 'correct horse battery'),
    (err: unknown) => err instanceof VaultLockedError,
  )
})

test('two encryptions of the same phrase use fresh iv and salt', async () => {
  const a = await encryptPhrase(PHRASE, 'correct horse battery', FAST)
  const b = await encryptPhrase(PHRASE, 'correct horse battery', FAST)
  assert.notEqual(a.iv, b.iv)
  assert.notEqual(a.salt, b.salt)
  assert.notEqual(a.ciphertext, b.ciphertext)
})

test('the blob records its algorithm parameters', async () => {
  const blob = await encryptPhrase(PHRASE, 'correct horse battery', FAST)
  assert.equal(blob.kdf, 'PBKDF2-SHA256')
  assert.equal(blob.cipher, 'AES-GCM-256')
  assert.equal(blob.iterations, 1_000)
})

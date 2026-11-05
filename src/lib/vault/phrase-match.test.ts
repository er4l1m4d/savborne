/**
 * The 24-word → vault-address check is the security crux of the server-only
 * delete path *and* of the restore-from-phrase path: it is the only thing that
 * stops someone deleting (or overwriting the key of) an account whose vault
 * they cannot actually reach.
 *
 * This runs the REAL derivation — the browser WASM build, initialised under
 * Node with explicit bytes. A wrong answer here cannot be hidden by a stub.
 *
 * The fixture phrase and its address were produced by the canonical Nimiq
 * library outside this codebase, not by the function under test.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { phraseMatchesVault } from './phrase'

const WASM = new URL(
  '../../../node_modules/@nimiq/core/web/main-wasm/index_bg.wasm',
  import.meta.url,
)

// The browser build loads its WASM over `fetch` in a browser; under Node it
// must be handed the bytes. Initialising once makes the later no-arg init a
// no-op. No top-level await because the runner emits CJS.
const ready = (async () => {
  const web = await import('@nimiq/core/web')
  await (web.default as (options: { module_or_path: Uint8Array }) => Promise<unknown>)({
    module_or_path: readFileSync(WASM),
  })
})()

const PHRASE = [
  'fit', 'fever', 'virtual', 'picnic', 'capital', 'mix',
  'split', 'logic', 'echo', 'slim', 'source', 'notable',
  'core', 'walk', 'abandon', 'detail', 'glass', 'popular',
  'drip', 'earn', 'stage', 'endorse', 'relax', 'cave',
]
const ADDRESS = 'NQ83 P433 8LLX 6Y22 79T8 TT3S F311 XXQJ 01TS'

test('the phrase that controls the vault matches it', async () => {
  await ready
  assert.equal(await phraseMatchesVault(PHRASE, ADDRESS), true)
})

test('address spacing and case do not affect the match', async () => {
  await ready
  assert.equal(await phraseMatchesVault(PHRASE, ADDRESS.replace(/\s/g, '').toLowerCase()), true)
})

test('the same words in a different order do not match', async () => {
  await ready
  const swapped = [...PHRASE]
  ;[swapped[0], swapped[1]] = [swapped[1], swapped[0]]
  assert.equal(await phraseMatchesVault(swapped, ADDRESS), false)
})

test('a valid phrase for a different vault does not match', async () => {
  await ready
  // The canonical 24-word BIP39 test vector: 23 × "abandon" + "art". Valid,
  // and controls a different address.
  const other = [...Array(23).fill('abandon'), 'art']
  assert.equal(await phraseMatchesVault(other, ADDRESS), false)
})

test('an incomplete or invalid phrase is a mismatch, not a crash', async () => {
  await ready
  assert.equal(await phraseMatchesVault(PHRASE.slice(0, 23), ADDRESS), false)
  assert.equal(await phraseMatchesVault([], ADDRESS), false)
  assert.equal(await phraseMatchesVault(['not', 'a', 'mnemonic'], ADDRESS), false)
})

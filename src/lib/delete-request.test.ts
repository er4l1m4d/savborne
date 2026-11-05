/**
 * The delete request is a wallet signature, so the *bytes* matter: a message
 * that reads the same but serialises differently will not verify.
 *
 * Two things are pinned here that a careless refactor would break:
 *  - the envelope is Nimiq's, not ours. `\x16Nimiq Signed Message:\n` + the
 *    UTF-8 BYTE length (not `String.length`) + the message. A user typing a
 *    name with an accent elsewhere in the flow does not change this, but a
 *    future "let's include the display name" would.
 *  - the proof is read from request headers with the same normalisation the
 *    client writes (`0x` tolerated, case-insensitive hex).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DELETE_PROOF_MAX_AGE_MS,
  DELETE_PUBLIC_KEY_HEADER,
  DELETE_SIGNATURE_HEADER,
  DELETE_SIGNED_AT_HEADER,
  deleteAuthHeaders,
  deleteMessage,
  nimiqSignedPayload,
  readDeleteProof,
} from './delete-request'

const ADDRESS = 'NQ83 P433 8LLX 6Y22 79T8 TT3S F311 XXQJ 01TS'
const CREATED_AT = '2026-11-03T18:20:00.123Z'

/** A syntactically valid proof: 32-byte key, 64-byte signature. */
const PUBLIC_KEY = 'ab'.repeat(32)
const SIGNATURE = 'cd'.repeat(64)

function proofHeaders(overrides: Record<string, string> = {}) {
  return new Headers({
    [DELETE_PUBLIC_KEY_HEADER]: PUBLIC_KEY,
    [DELETE_SIGNATURE_HEADER]: SIGNATURE,
    [DELETE_SIGNED_AT_HEADER]: '1762300000000',
    ...overrides,
  })
}

test('the Nimiq envelope is prefix + byte length + message', () => {
  // Hand-computed, not produced by the function under test:
  //   \x16 = 16
  //   "Nimiq Signed Message:\n" = 4e696d6971205369676e6564204d6573736167653a0a
  //   "hi" has length 2 = 32, then 6869
  const payload = nimiqSignedPayload('hi')
  assert.equal(Buffer.from(payload).toString('hex'), '164e696d6971205369676e6564204d6573736167653a0a32' + '6869')
})

test('the envelope length counts UTF-8 bytes, not UTF-16 code units', () => {
  // `\x16` + "Nimiq Signed Message:\n" is 23 bytes, so the length digits start
  // at index 23. A String.length implementation would write 1 for 'é' and 2
  // for '😀'; the wallet signs 2 and 4.
  const wroteLength = (text: string) => Buffer.from(nimiqSignedPayload(text))[23]

  assert.equal(wroteLength('ab'), 0x32) // "2"
  assert.equal(wroteLength('é'), 0x32) // "2" — 1 code unit, 2 bytes
  assert.equal(wroteLength('😀'), 0x34) // "4" — 2 code units (surrogate pair), 4 bytes
})

test('the message names the address, the account creation and the request time', () => {
  const message = deleteMessage({ address: ADDRESS, createdAt: CREATED_AT, signedAt: 1762300000000 })
  // Spacing is normalised so a spaced and an unspaced address cannot produce
  // two different signed messages for the same account.
  assert.ok(message.includes('NQ83P4338LLX6Y2279T8TT3SF311XXQJ01TS'), message)
  assert.ok(!message.includes('NQ83 P433'), message)
  assert.ok(message.includes(CREATED_AT), message)
  assert.ok(message.includes('1762300000000'), message)
  assert.ok(message.includes('24 words'), message)
})

test('the message changes with the request time, so a proof is not reusable later', () => {
  const first = deleteMessage({ address: ADDRESS, createdAt: CREATED_AT, signedAt: 1762300000000 })
  const second = deleteMessage({ address: ADDRESS, createdAt: CREATED_AT, signedAt: 1762300000001 })
  assert.notEqual(first, second)
})

test('a complete proof is read from the headers', () => {
  const read = readDeleteProof(proofHeaders(), 1762300000000)
  assert.deepEqual(read, {
    ok: true,
    proof: { publicKey: PUBLIC_KEY, signature: SIGNATURE, signedAt: 1762300000000 },
  })
})

test('0x-prefixed and upper-case hex are accepted', () => {
  const read = readDeleteProof(
    proofHeaders({
      [DELETE_PUBLIC_KEY_HEADER]: '0x' + PUBLIC_KEY.toUpperCase(),
      [DELETE_SIGNATURE_HEADER]: '0x' + SIGNATURE.toUpperCase(),
    }),
    1762300000000,
  )
  assert.equal(read.ok, true)
  if (read.ok) {
    assert.equal(read.proof.publicKey, PUBLIC_KEY)
    assert.equal(read.proof.signature, SIGNATURE)
  }
})

test('any missing header is missing, not malformed', () => {
  for (const header of [DELETE_PUBLIC_KEY_HEADER, DELETE_SIGNATURE_HEADER, DELETE_SIGNED_AT_HEADER]) {
    const headers = proofHeaders()
    headers.delete(header)
    assert.deepEqual(readDeleteProof(headers, 1762300000000), { ok: false, reason: 'missing' }, header)
  }
})

test('wrong key or signature lengths are malformed', () => {
  const cases: Record<string, string>[] = [
    { [DELETE_PUBLIC_KEY_HEADER]: 'ab'.repeat(31) },
    { [DELETE_PUBLIC_KEY_HEADER]: 'ab'.repeat(33) },
    { [DELETE_SIGNATURE_HEADER]: 'cd'.repeat(63) },
    { [DELETE_SIGNATURE_HEADER]: 'cd'.repeat(65) },
    { [DELETE_PUBLIC_KEY_HEADER]: 'zz'.repeat(32) },
  ]
  for (const overrides of cases) {
    assert.deepEqual(
      readDeleteProof(proofHeaders(overrides), 1762300000000),
      { ok: false, reason: 'malformed' },
      JSON.stringify(overrides).slice(0, 40),
    )
  }
})

test('a non-numeric or out-of-range request time is malformed', () => {
  for (const value of ['soon', '1.5', '-1', '99999999999999999']) {
    assert.deepEqual(
      readDeleteProof(proofHeaders({ [DELETE_SIGNED_AT_HEADER]: value }), 1762300000000),
      { ok: false, reason: 'malformed' },
      value,
    )
  }
})

test('the proof expires just after the window, in either direction', () => {
  const now = 1762300000000
  assert.equal(readDeleteProof(proofHeaders({ [DELETE_SIGNED_AT_HEADER]: String(now - DELETE_PROOF_MAX_AGE_MS) }), now).ok, true)
  assert.deepEqual(
    readDeleteProof(proofHeaders({ [DELETE_SIGNED_AT_HEADER]: String(now - DELETE_PROOF_MAX_AGE_MS - 1) }), now),
    { ok: false, reason: 'stale' },
  )
  assert.deepEqual(
    readDeleteProof(proofHeaders({ [DELETE_SIGNED_AT_HEADER]: String(now + DELETE_PROOF_MAX_AGE_MS + 1) }), now),
    { ok: false, reason: 'stale' },
  )
})

test('the headers written by the client are the headers the server reads', () => {
  const headers = new Headers(
    deleteAuthHeaders({ publicKey: PUBLIC_KEY, signature: SIGNATURE, signedAt: 1762300000000 }),
  )
  assert.deepEqual(readDeleteProof(headers, 1762300000000), {
    ok: true,
    proof: { publicKey: PUBLIC_KEY, signature: SIGNATURE, signedAt: 1762300000000 },
  })
})

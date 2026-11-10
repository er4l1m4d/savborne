/**
 * The check-in proof is a wallet signature, so the *bytes* and the *names*
 * matter:
 *
 *  - the message is its own namespace, so a delete signature can never
 *    authorise a check-in;
 *  - it names the normalised player address and the action, so another player
 *    or another action cannot reuse it;
 *  - the envelope is Nimiq's (UTF-8 byte length), shared with the delete flow;
 *  - the headers the client writes are exactly the headers the server reads and
 *    are not the delete headers.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CHECKIN_ACTION,
  CHECKIN_PROOF_MAX_AGE_MS,
  CHECKIN_PUBLIC_KEY_HEADER,
  CHECKIN_SIGNATURE_HEADER,
  CHECKIN_SIGNED_AT_HEADER,
  checkInAuthHeaders,
  checkInErrorMessage,
  checkInMessage,
  readCheckInProof,
} from './checkin-request'
import {
  DELETE_PUBLIC_KEY_HEADER,
  DELETE_SIGNATURE_HEADER,
  DELETE_SIGNED_AT_HEADER,
  deleteMessage,
  nimiqSignedPayload,
} from './delete-request'

const ADDRESS = 'NQ83 P433 8LLX 6Y22 79T8 TT3S F311 XXQJ 01TS'
const SIGNED_AT = 1762300000000

/** A syntactically valid proof: 32-byte key, 64-byte signature. */
const PUBLIC_KEY = 'ab'.repeat(32)
const SIGNATURE = 'cd'.repeat(64)

function proofHeaders(overrides: Record<string, string> = {}) {
  return new Headers({
    [CHECKIN_PUBLIC_KEY_HEADER]: PUBLIC_KEY,
    [CHECKIN_SIGNATURE_HEADER]: SIGNATURE,
    [CHECKIN_SIGNED_AT_HEADER]: String(SIGNED_AT),
    ...overrides,
  })
}

// ─── The message ─────────────────────────────────────────────────────────────

test('the message names the check-in namespace, the address, the action and the time', () => {
  const message = checkInMessage({ address: ADDRESS, signedAt: SIGNED_AT })
  assert.ok(message.startsWith('Savborne check-in\n'), message)
  // Spacing is normalised so a spaced and an unspaced address cannot produce
  // two different signed messages for the same player.
  assert.ok(message.includes('Address: NQ83P4338LLX6Y2279T8TT3SF311XXQJ01TS'), message)
  assert.ok(!message.includes('NQ83 P433'), message)
  assert.ok(message.includes(`Action: ${CHECKIN_ACTION}`), message)
  assert.ok(message.includes(`Signed at: ${SIGNED_AT}`), message)
  assert.ok(message.includes("I control this player's wallet"), message)
})

test('a check-in message is never a delete message', () => {
  const checkIn = checkInMessage({ address: ADDRESS, signedAt: SIGNED_AT })
  const del = deleteMessage({
    address: ADDRESS,
    createdAt: '2026-11-03T18:20:00.123Z',
    signedAt: SIGNED_AT,
  })
  assert.notEqual(checkIn, del)
  assert.ok(!checkIn.includes('account deletion'), checkIn)
  assert.ok(!del.includes('Savborne check-in'), del)
})

test('the message changes with the address, the action and the time', () => {
  const base = checkInMessage({ address: ADDRESS, signedAt: SIGNED_AT })
  assert.notEqual(checkInMessage({ address: 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL', signedAt: SIGNED_AT }), base)
  assert.notEqual(checkInMessage({ address: ADDRESS, action: 'claim', signedAt: SIGNED_AT }), base)
  assert.notEqual(checkInMessage({ address: ADDRESS, signedAt: SIGNED_AT + 1 }), base)
})

test('the envelope is the delete flow envelope, including the UTF-8 byte length', () => {
  // Hand-computed, not produced by the function under test:
  //   \x16 + "Nimiq Signed Message:\n" (23 bytes) = 16 + 4e69...3a0a
  //   "é" is 1 UTF-16 code unit but 2 UTF-8 bytes = 32 + c3a9
  const payload = nimiqSignedPayload('é')
  assert.equal(
    Buffer.from(payload).toString('hex'),
    '164e696d6971205369676e6564204d6573736167653a0a32' + 'c3a9',
  )
})

// ─── Reading the proof ───────────────────────────────────────────────────────

test('a complete proof is read from the headers', () => {
  assert.deepEqual(readCheckInProof(proofHeaders(), SIGNED_AT), {
    ok: true,
    proof: { publicKey: PUBLIC_KEY, signature: SIGNATURE, signedAt: SIGNED_AT },
  })
})

test('0x-prefixed and upper-case hex are accepted', () => {
  const read = readCheckInProof(
    proofHeaders({
      [CHECKIN_PUBLIC_KEY_HEADER]: '0x' + PUBLIC_KEY.toUpperCase(),
      [CHECKIN_SIGNATURE_HEADER]: '0x' + SIGNATURE.toUpperCase(),
    }),
    SIGNED_AT,
  )
  assert.equal(read.ok, true)
  if (read.ok) {
    assert.equal(read.proof.publicKey, PUBLIC_KEY)
    assert.equal(read.proof.signature, SIGNATURE)
  }
})

test('any missing header is missing, not malformed', () => {
  for (const header of [
    CHECKIN_PUBLIC_KEY_HEADER,
    CHECKIN_SIGNATURE_HEADER,
    CHECKIN_SIGNED_AT_HEADER,
  ]) {
    const headers = proofHeaders()
    headers.delete(header)
    assert.deepEqual(
      readCheckInProof(headers, SIGNED_AT),
      { ok: false, reason: 'missing' },
      header,
    )
  }
})

test('wrong key or signature lengths are malformed', () => {
  const cases: Record<string, string>[] = [
    { [CHECKIN_PUBLIC_KEY_HEADER]: 'ab'.repeat(31) },
    { [CHECKIN_PUBLIC_KEY_HEADER]: 'ab'.repeat(33) },
    { [CHECKIN_PUBLIC_KEY_HEADER]: 'zz'.repeat(32) },
    { [CHECKIN_SIGNATURE_HEADER]: 'cd'.repeat(63) },
    { [CHECKIN_SIGNATURE_HEADER]: 'cd'.repeat(65) },
  ]
  for (const overrides of cases) {
    assert.deepEqual(
      readCheckInProof(proofHeaders(overrides), SIGNED_AT),
      { ok: false, reason: 'malformed' },
      JSON.stringify(overrides).slice(0, 40),
    )
  }
})

test('a non-numeric or out-of-range request time is malformed', () => {
  for (const value of ['soon', '1.5', '-1', '99999999999999999']) {
    assert.deepEqual(
      readCheckInProof(proofHeaders({ [CHECKIN_SIGNED_AT_HEADER]: value }), SIGNED_AT),
      { ok: false, reason: 'malformed' },
      value,
    )
  }
})

test('the proof expires just after the window, in either direction', () => {
  const now = SIGNED_AT
  assert.equal(
    readCheckInProof(
      proofHeaders({ [CHECKIN_SIGNED_AT_HEADER]: String(now - CHECKIN_PROOF_MAX_AGE_MS) }),
      now,
    ).ok,
    true,
  )
  assert.deepEqual(
    readCheckInProof(
      proofHeaders({ [CHECKIN_SIGNED_AT_HEADER]: String(now - CHECKIN_PROOF_MAX_AGE_MS - 1) }),
      now,
    ),
    { ok: false, reason: 'stale' },
  )
  assert.deepEqual(
    readCheckInProof(
      proofHeaders({ [CHECKIN_SIGNED_AT_HEADER]: String(now + CHECKIN_PROOF_MAX_AGE_MS + 1) }),
      now,
    ),
    { ok: false, reason: 'stale' },
  )
})

// ─── Headers and copy ────────────────────────────────────────────────────────

test('the headers the client writes are the headers the server reads', () => {
  const headers = new Headers(
    checkInAuthHeaders({ publicKey: PUBLIC_KEY, signature: SIGNATURE, signedAt: SIGNED_AT }),
  )
  assert.deepEqual(readCheckInProof(headers, SIGNED_AT), {
    ok: true,
    proof: { publicKey: PUBLIC_KEY, signature: SIGNATURE, signedAt: SIGNED_AT },
  })
})

test('check-in headers are a different set from delete headers', () => {
  const checkIn = new Set([
    CHECKIN_PUBLIC_KEY_HEADER,
    CHECKIN_SIGNATURE_HEADER,
    CHECKIN_SIGNED_AT_HEADER,
  ])
  for (const header of [
    DELETE_PUBLIC_KEY_HEADER,
    DELETE_SIGNATURE_HEADER,
    DELETE_SIGNED_AT_HEADER,
  ]) {
    assert.ok(!checkIn.has(header), header)
  }
  assert.equal(checkIn.size, 3)
})

test('proof rejections map to player-actionable copy', () => {
  assert.match(checkInErrorMessage('missing', 401), /did not sign/)
  assert.match(checkInErrorMessage('stale', 401), /took too long/)
  assert.match(checkInErrorMessage('malformed', 400), /did not match/)
  assert.match(checkInErrorMessage('bad_signature', 401), /did not match/)
  assert.match(checkInErrorMessage('wrong_signer', 401), /different account/)
  assert.equal(checkInErrorMessage('rate_limited', 429), 'Check-in failed (429).')
  assert.equal(checkInErrorMessage(undefined, 500), 'Check-in failed (500).')
})

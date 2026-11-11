/**
 * /api/players/me is the only endpoint that destroys data, so its boundary is
 * tested end to end against the real handler and a fake network:
 *
 *  - GET exposes `createdAt` in the exact canonical form the client must sign.
 *    If these two ever disagree, every real delete fails at the signature check.
 *  - DELETE refuses a request with no proof, a malformed proof, a stale proof,
 *    a proof for another account creation, or a proof whose key does not
 *    control the header address — and refuses all of them BEFORE the RPC.
 *  - A verified delete runs `delete_player` exactly once.
 *  - An already-deleted account stays idempotent.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeNet } from '@/test/fake-net'
import { GET, DELETE, PATCH } from '@/app/api/players/me/route'
import { utcWeekStart } from '@/lib/game/time'
import { newWalletSigner } from '@/test/wallet-signer'
import { authRequest } from '@/test/session'
import {
  DELETE_PROOF_MAX_AGE_MS,
  DELETE_PUBLIC_KEY_HEADER,
  DELETE_SIGNATURE_HEADER,
  DELETE_SIGNED_AT_HEADER,
  deleteAuthHeaders,
  deleteMessage,
} from '@/lib/delete-request'
import { checkInAuthHeaders, checkInMessage } from '@/lib/checkin-request'

const CREATED_AT = '2026-11-03T18:20:00.123Z'
/** A plausible address no generated test key will control. */
const VICTIM = 'NQ83 P433 8LLX 6Y22 79T8 TT3S F311 XXQJ 01TS'

let net: FakeNet
afterEach(() => net?.restore())

function playerRow(address: string, created_at = CREATED_AT) {
  return {
    address,
    savings_account_address: VICTIM,
    display_name: 'Tester',
    created_at,
    level: 3,
    xp: 120,
    rating: 1010,
    bracket: 'bronze',
    current_balance_luna: 500_000,
    streak_current: 2,
    streak_best: 5,
    shields: 1,
    shields_earned: 0,
    check_in_count: 7,
    wins: 3,
    losses: 1,
    ties: 0,
    last_check_in_at: null,
  }
}

function getReq(headers: Record<string, string> = {}): Request {
  return authRequest('http://test/api/players/me', { headers })
}

function deleteReq(headers: Record<string, string>): Request {
  return authRequest('http://test/api/players/me', { method: 'DELETE', headers })
}

/** Answers every non-player query with an empty row set. */
function emptyQueries(resource: string | null) {
  return (
    resource === 'daily_xp' ||
    resource === 'check_ins' ||
    resource === 'player_missions' ||
    resource === 'missions' ||
    resource === 'daily_battles' ||
    resource === 'vaults'
  )
}

async function newSigner() {
  // One real-keypair signer is shared with the check-in tests; this wrapper
  // only names the delete message.
  const signer = await newWalletSigner()
  return {
    address: signer.address,
    async sign(namedAddress: string, createdAt: string, signedAt: number) {
      const message = deleteMessage({ address: namedAddress, createdAt, signedAt })
      return { ...(await signer.sign(message)), signedAt }
    },
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

test('GET without a player header is 401 and queries nothing', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await GET(getReq())
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('GET exposes createdAt in the canonical form the client signs', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') {
      return rows(playerRow(VICTIM, '2026-11-03T18:20:00.123+00:00'))
    }
    if (emptyQueries(c.resource)) return rows()
    return undefined
  })

  const res = await GET(getReq({ 'X-Player-Address': VICTIM }))
  assert.equal(res.status, 200)
  const body = (await res.json()) as { player: { createdAt: string } }
  assert.equal(body.player.createdAt, CREATED_AT)
})

test('GET for an unknown player is 404', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows()
    if (emptyQueries(c.resource)) return rows()
    return undefined
  })
  const res = await GET(getReq({ 'X-Player-Address': VICTIM }))
  assert.equal(res.status, 404)
})

test('GET reports exact weekly mission XP, not a check-in count', async () => {
  const weekStart = utcWeekStart(new Date())
  const inWeek = new Date(weekStart.getTime() + 60_000).toISOString()
  const beforeWeek = new Date(weekStart.getTime() - 60_000).toISOString()

  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows(playerRow(VICTIM))
    if (c.resource === 'player_missions') {
      return rows(
        { mission_key: 'weekly_check_in', completed_at: inWeek },
        { mission_key: 'steady_saver', completed_at: inWeek },
        // Duplicate credit: must not add XP twice.
        { mission_key: 'weekly_check_in', completed_at: inWeek },
        { mission_key: 'daily_check_in', completed_at: inWeek },
        // Before the week window: must not count.
        { mission_key: 'weekly_strategist', completed_at: beforeWeek },
      )
    }
    if (c.resource === 'missions') {
      return rows(
        { key: 'weekly_check_in', type: 'weekly', xp_reward: 25 },
        { key: 'steady_saver', type: 'weekly', xp_reward: 35 },
        { key: 'weekly_strategist', type: 'weekly', xp_reward: 40 },
        { key: 'daily_check_in', type: 'daily', xp_reward: 10 },
      )
    }
    if (c.resource === 'daily_xp' || c.resource === 'daily_battles' || c.resource === 'vaults') {
      return rows()
    }
    return undefined
  })

  const res = await GET(getReq({ 'X-Player-Address': VICTIM }))
  assert.equal(res.status, 200)
  const body = (await res.json()) as { player: { weeklyXpEarnedThisWeek: number } }
  assert.equal(body.player.weeklyXpEarnedThisWeek, 60)
  assert.equal(net.to('check_ins').length, 0)
})

// ─── DELETE: rejects before the destructive call ─────────────────────────────

test('DELETE without a player header is 401 and queries nothing', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await DELETE(deleteReq({}))
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('DELETE with no proof headers is 401 and queries nothing', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await DELETE(deleteReq({ 'X-Player-Address': VICTIM }))
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
  assert.deepEqual(await res.json(), { error: 'missing' })
})

test('DELETE with a malformed proof is 400 and queries nothing', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await DELETE(
    deleteReq({
      'X-Player-Address': VICTIM,
      [DELETE_PUBLIC_KEY_HEADER]: 'zz'.repeat(32),
      [DELETE_SIGNATURE_HEADER]: 'cd'.repeat(64),
      [DELETE_SIGNED_AT_HEADER]: String(Date.now()),
    }),
  )
  assert.equal(res.status, 400)
  assert.equal(net.calls.length, 0)
  assert.deepEqual(await res.json(), { error: 'malformed' })
})

test('DELETE with a stale proof is 401 and never reaches the database', async () => {
  const signer = await newSigner()
  const signedAt = Date.now() - DELETE_PROOF_MAX_AGE_MS - 5_000
  const proof = await signer.sign(signer.address, CREATED_AT, signedAt)

  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await DELETE(
    deleteReq({ 'X-Player-Address': signer.address, ...deleteAuthHeaders(proof) }),
  )
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
  assert.deepEqual(await res.json(), { error: 'stale' })
})

test('DELETE signed for a different account creation is rejected before the RPC', async () => {
  const signer = await newSigner()
  const signedAt = Date.now() - 1_000
  // Signed over the wrong creation time — e.g. a proof captured before a
  // re-onboard. The stored row no longer matches it.
  const proof = await signer.sign(signer.address, '2020-01-01T00:00:00.000Z', signedAt)

  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows(playerRow(signer.address))
    return undefined
  })
  const res = await DELETE(
    deleteReq({ 'X-Player-Address': signer.address, ...deleteAuthHeaders(proof) }),
  )
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'bad_signature' })
  assert.equal(net.calls.filter((c) => c.rpc === 'delete_player').length, 0)
})

test('a valid signature from a key that does not control the address is rejected', async () => {
  const attacker = await newSigner()
  const signedAt = Date.now() - 1_000
  // The attacker signs a message naming the victim, with their own key.
  const proof = await attacker.sign(VICTIM, CREATED_AT, signedAt)

  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows(playerRow(VICTIM))
    return undefined
  })
  const res = await DELETE(deleteReq({ 'X-Player-Address': VICTIM, ...deleteAuthHeaders(proof) }))
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'wrong_signer' })
  assert.equal(net.calls.filter((c) => c.rpc === 'delete_player').length, 0)
})

// ─── DELETE: the two namespaces cannot cross ─────────────────────────────────

test('a check-in proof carries no delete headers, so it is missing', async () => {
  const signer = await newWalletSigner()
  const signedAt = Date.now() - 1_000
  const proof = {
    ...(await signer.sign(checkInMessage({ address: signer.address, signedAt }))),
    signedAt,
  }

  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await DELETE(
    deleteReq({
      'X-Player-Address': signer.address,
      ...checkInAuthHeaders(proof),
    }),
  )
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'missing' })
  assert.equal(net.calls.length, 0)
})

test('a check-in signature replayed in delete headers is a bad signature', async () => {
  const signer = await newWalletSigner()
  const signedAt = Date.now() - 1_000
  const proof = {
    ...(await signer.sign(checkInMessage({ address: signer.address, signedAt }))),
    signedAt,
  }

  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows(playerRow(signer.address))
    return undefined
  })
  const res = await DELETE(
    deleteReq({
      'X-Player-Address': signer.address,
      ...deleteAuthHeaders(proof),
    }),
  )
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'bad_signature' })
  assert.equal(net.calls.filter((c) => c.rpc === 'delete_player').length, 0)
})

// ─── DELETE: the happy path and idempotency ──────────────────────────────────

test('a verified delete runs delete_player once and returns its result', async () => {
  const signer = await newSigner()
  const signedAt = Date.now() - 1_000
  const proof = await signer.sign(signer.address, CREATED_AT, signedAt)

  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows(playerRow(signer.address))
    if (c.rpc === 'delete_player') return { json: { deleted: true, battles: 4 } }
    return undefined
  })

  const res = await DELETE(
    deleteReq({ 'X-Player-Address': signer.address, ...deleteAuthHeaders(proof) }),
  )
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { deleted: true, battles: 4 })

  const calls = net.calls.filter((c) => c.rpc === 'delete_player')
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].body, { p_address: signer.address })
})

test('deleting an already-deleted account is idempotent and runs no RPC', async () => {
  const signer = await newSigner()
  const signedAt = Date.now() - 1_000
  const proof = await signer.sign(signer.address, CREATED_AT, signedAt)

  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows() // no row: already gone
    return undefined
  })

  const res = await DELETE(
    deleteReq({ 'X-Player-Address': signer.address, ...deleteAuthHeaders(proof) }),
  )
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { deleted: false, battles: 0 })
  assert.equal(net.calls.filter((c) => c.rpc === 'delete_player').length, 0)
})

test('a failing RPC is a 500, not a silent success', async () => {
  const signer = await newSigner()
  const signedAt = Date.now() - 1_000
  const proof = await signer.sign(signer.address, CREATED_AT, signedAt)

  net = installFakeNet((c) => {
    if (c.resource === 'players') return rows(playerRow(signer.address))
    if (c.rpc === 'delete_player') {
      return { status: 400, json: { message: 'foreign key violation' } }
    }
    return undefined
  })

  const res = await DELETE(
    deleteReq({ 'X-Player-Address': signer.address, ...deleteAuthHeaders(proof) }),
  )
  assert.equal(res.status, 500)
  assert.deepEqual(await res.json(), { error: 'db_error' })
})


test('PATCH with a bare player header is rejected before any query', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })

  const res = await PATCH(
    new Request('http://test/api/players/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'X-Player-Address': VICTIM },
      body: JSON.stringify({ avatar: 'heroine' }),
    }),
  )

  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'session_required' })
  assert.equal(net.calls.length, 0)
})

test('PATCH saves the leaderboard privacy flag', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'players' && c.method === 'PATCH') {
      return rows({ avatar: 'hero', show_stats: false })
    }
    return undefined
  })

  const res = await PATCH(
    authRequest('http://test/api/players/me', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'X-Player-Address': VICTIM,
      },
      body: JSON.stringify({ showStats: false }),
    }),
  )

  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { avatar: 'hero', showStats: false })

  const patch = net.to('players').find((c) => c.method === 'PATCH')
  assert.ok(patch)
  assert.deepEqual(patch.body, { show_stats: false })
})

test('PATCH rejects a non-boolean leaderboard flag', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })

  const res = await PATCH(
    authRequest('http://test/api/players/me', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'X-Player-Address': VICTIM,
      },
      body: JSON.stringify({ showStats: 'yes' }),
    }),
  )

  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'showStats must be a boolean' })
  assert.equal(net.calls.length, 0)
})

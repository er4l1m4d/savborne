/**
 * GET /api/profile - identity is the session, not the address header.
 *
 * The read includes the player's stats, items and badges, so a bare address
 * must never be enough. A valid token reads only its own wallet.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeNet } from '@/test/fake-net'
import { authRequest } from '@/test/session'
import { GET } from '@/app/api/profile/route'
import { issueSessionToken } from '@/lib/session-token'
import { PLAYER_HEADER, SESSION_HEADER } from '@/lib/session'

const PLAYER = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const OTHER = 'NQ07 1111 1111 1111 1111 1111 1111 1111 1111'

let net: FakeNet
afterEach(() => net?.restore())

function playerRow() {
  return {
    address: PLAYER,
    display_name: 'Hero',
    avatar: 'hero',
    level: 3,
    xp: 120,
    rating: 1010,
    bracket: 'bronze',
    current_balance_luna: 5_000_000,
    streak_current: 2,
    streak_best: 4,
    shields: 1,
    shields_earned: 1,
    check_in_count: 3,
    wins: 1,
    losses: 0,
    ties: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  }
}

function handler() {
  return (c: { resource: string | null }) => {
    if (c.resource === 'players') return rows(playerRow())
    if (c.resource === 'player_items') return rows({ item_key: 'ledger_scroll' })
    if (c.resource === 'player_badges') return rows({ badge_key: 'first_steps', revoked_at: null })
    if (c.resource === 'vaults') return rows({ card_token: 'card-token' })
    return undefined
  }
}

test('a bare player header is rejected before any query', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })

  const res = await GET(
    new Request('http://test/api/profile', {
      headers: { [PLAYER_HEADER]: PLAYER },
    }),
  )

  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'session_required' })
  assert.equal(net.calls.length, 0)
})

test('a valid session reads only that player', async () => {
  net = installFakeNet(handler())

  const res = await GET(
    authRequest('http://test/api/profile', {
      headers: { [PLAYER_HEADER]: PLAYER },
    }),
  )

  assert.equal(res.status, 200)
  const body = (await res.json()) as { player: { address: string } }
  assert.equal(body.player.address, PLAYER)

  for (const call of net.calls.filter((c) => c.resource && c.resource !== 'api_rate_limits')) {
    const scope = call.query.get('address') ?? call.query.get('player_address')
    assert.equal(scope, `eq.${PLAYER}`, `${call.resource} was not scoped to the caller`)
  }
})

test('a token for one wallet cannot read another wallet with its header', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  process.env.SESSION_SECRET ||= 'test-session-secret-with-at-least-32-bytes'
  const { token } = issueSessionToken(PLAYER)

  const res = await GET(
    new Request('http://test/api/profile', {
      headers: { [PLAYER_HEADER]: OTHER, [SESSION_HEADER]: token },
    }),
  )

  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: 'session_mismatch' })
  assert.equal(net.calls.length, 0)
})

/**
 * GET /api/leaderboards - rank and name stay public, numbers can be hidden.
 *
 * A player who sets `show_stats = false` still appears (name and rank) but
 * their level, bracket, score, wins and streak are null for everyone else.
 * The caller always sees their own row.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, type FakeNet } from '@/test/fake-net'
import { authRequest } from '@/test/session'
import { GET } from '@/app/api/leaderboards/route'

const PLAYER = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const OTHER = 'NQ07 1111 1111 1111 1111 1111 1111 1111 1111'

let net: FakeNet
afterEach(() => net?.restore())

function stat(address: string, overrides: Record<string, unknown> = {}) {
  return {
    player_address: address,
    display_name: address === PLAYER ? 'Me' : 'Them',
    level: 5,
    bracket: 'silver',
    rating: 1200,
    wins: 3,
    losses: 1,
    ties: 0,
    streak_current: 4,
    streak_best: 4,
    growth_luna: 1_000_000,
    has_vault: true,
    show_stats: true,
    ...overrides,
  }
}

test('a hidden row keeps its rank and name but masks every number', async () => {
  net = installFakeNet((c) =>
    c.rpc === 'leaderboard_stats'
      ? {
          json: [
            stat(PLAYER, { rating: 1300 }),
            stat(OTHER, { show_stats: false, rating: 1200 }),
          ],
        }
      : undefined,
  )

  const res = await GET(
    authRequest('http://test/api/leaderboards?board=ranked', {
      headers: { 'X-Player-Address': PLAYER },
    }),
  )

  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    rows: Array<Record<string, unknown>>
    you: Record<string, unknown> | null
  }

  const mine = body.rows.find((r) => r.isMe)
  assert.ok(mine)
  assert.equal(mine?.score, 1300)
  assert.equal(mine?.statsHidden, false)

  const theirs = body.rows.find((r) => r.displayName === 'Them')
  assert.ok(theirs)
  assert.equal(theirs?.statsHidden, true)
  assert.equal(theirs?.score, null)
  assert.equal(theirs?.level, null)
  assert.equal(theirs?.bracket, null)
  assert.equal(theirs?.wins, null)
  assert.equal(theirs?.streak, null)
})

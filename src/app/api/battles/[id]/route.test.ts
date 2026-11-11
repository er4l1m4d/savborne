/**
 * GET /api/battles/[id] - additive arena fields.
 *
 * The Battle UI needs levels, brackets, the full owned set and the viewer's
 * current move. These are additions only; the existing fields stay the same.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeNet } from '@/test/fake-net'
import { authRequest } from '@/test/session'
import { GET } from './route'

const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const OPP = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'

let net: FakeNet
afterEach(() => net?.restore())

function battle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    mode: 'ranked',
    status: 'active',
    player_a: PLAYER,
    player_b: OPP,
    current_turn: 2,
    turn_deadline: new Date(Date.now() + 30_000).toISOString(),
    player_a_hp: 78,
    player_b_hp: 62,
    winner: null,
    created_at: '2026-11-09T10:00:00.000Z',
    started_at: '2026-11-09T10:00:00.000Z',
    completed_at: null,
    ...overrides,
  }
}

function moves() {
  return [
    { player_address: PLAYER, turn_number: 1, move_type: 'attack', item_key: null, resolved_damage: 15 },
    { player_address: OPP, turn_number: 1, move_type: 'defend', item_key: null, resolved_damage: 0 },
    { player_address: PLAYER, turn_number: 2, move_type: 'attack', item_key: null, resolved_damage: 0 },
    { player_address: OPP, turn_number: 2, move_type: 'defend', item_key: null, resolved_damage: 0 },
  ]
}

function req(): Request {
  return authRequest('http://test/api/battles/b1', {
    headers: { 'X-Player-Address': PLAYER },
  })
}

const ctx = { params: Promise.resolve({ id: 'b1' }) }

test('the battle GET adds viewer and opponent levels, brackets and owned items', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'battles') return rows(battle())
    if (c.resource === 'battle_moves') return rows(...moves())
    if (c.resource === 'player_items') return rows({ item_key: 'cloth_purse' }, { item_key: 'silver_blade' })
    if (c.resource === 'players') {
      return rows(
        { address: PLAYER, display_name: 'Kemi', level: 7, bracket: 'silver' },
        { address: OPP, display_name: 'Tobi', level: 5, bracket: 'bronze' },
      )
    }
    return undefined
  })

  const res = await GET(req(), ctx)
  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    battle: { opponentName: string; opponentLevel: number; opponentBracket: string }
    viewer: {
      level: number
      bracket: string
      ownedItems: string[]
      ownedInactiveItems: string[]
      currentMove: { move: string; itemKey: string | null } | null
    }
  }

  assert.equal(body.battle.opponentName, 'Tobi')
  assert.equal(body.battle.opponentLevel, 5)
  assert.equal(body.battle.opponentBracket, 'bronze')
  assert.equal(body.viewer.level, 7)
  assert.equal(body.viewer.bracket, 'silver')
  assert.deepEqual(body.viewer.ownedItems.sort(), ['cloth_purse', 'silver_blade'])
  assert.deepEqual(body.viewer.ownedInactiveItems.sort(), ['cloth_purse', 'silver_blade'])
  assert.deepEqual(body.viewer.currentMove, { move: 'attack', itemKey: null })
})

test('an AI battle has no opponent level or bracket', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'battles') return rows(battle({ mode: 'ai', player_b: 'ai-savborne' }))
    if (c.resource === 'battle_moves') return rows(...moves().slice(0, 2))
    if (c.resource === 'player_items') return rows()
    if (c.resource === 'players') {
      return rows({ address: PLAYER, display_name: 'Kemi', level: 7, bracket: 'silver' })
    }
    return undefined
  })

  const res = await GET(req(), ctx)
  assert.equal(res.status, 200)
  const body = (await res.json()) as {
    battle: { opponentName: string; opponentLevel: number | null; opponentBracket: string | null }
    viewer: { currentMove: unknown }
  }
  assert.equal(body.battle.opponentName, 'Savborne AI')
  assert.equal(body.battle.opponentLevel, null)
  assert.equal(body.battle.opponentBracket, null)
  assert.equal(body.viewer.currentMove, null)
})

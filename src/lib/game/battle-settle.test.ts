/**
 * settleBattle - one transaction, no direct reward writes.
 *
 * The battle row, both players and every reward must go through the
 * `settle_battle` RPC. A regression that writes a player row directly would
 * reintroduce the partial-settlement risk this test exists to prevent.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeCall, type FakeNet, type FakeReply } from '@/test/fake-net'
import { supabaseAdmin } from '@/lib/supabase'
import { settleBattle, type BattleRow } from './battleServer'

const A = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const B = 'NQ07 1111 1111 1111 1111 1111 1111 1111 1111'
const NOW = new Date('2026-11-11T12:00:00.000Z')

let net: FakeNet
afterEach(() => net?.restore())

function playerRow(address: string) {
  return {
    address,
    xp: 100,
    level: 3,
    rating: 1000,
    wins: 0,
    losses: 0,
    ties: 0,
    streak_current: 0,
    bracket: 'bronze',
    check_in_count: 1,
  }
}

function battle(): BattleRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    mode: 'ranked',
    status: 'active',
    player_a: A,
    player_b: B,
    current_turn: 5,
    turn_deadline: null,
    player_a_hp: 20,
    player_b_hp: 0,
    winner: null,
    created_at: NOW.toISOString(),
    started_at: NOW.toISOString(),
    completed_at: null,
  }
}

test('a finished battle calls settle_battle once and writes no rows directly', async () => {
  net = installFakeNet((c: FakeCall): FakeReply | undefined => {
    if (c.rpc === 'settle_battle') return { json: { settled: true } }
    if (c.resource === 'players' && c.method === 'GET') {
      const eq = c.query.get('address')
      if (eq?.startsWith('eq.')) return rows(playerRow(eq.slice(3)))
      return rows(playerRow(A), playerRow(B))
    }
    if (c.resource === 'battle_moves') return rows({ move_type: 'attack' })
    if (c.resource === 'daily_battles') return rows({ count: 1 })
    if (c.resource === 'player_missions') return rows()
    if (c.resource === 'daily_xp') return rows()
    if (c.resource === 'player_badges') return rows()
    if (c.resource === 'battles') return rows()
    return undefined
  })

  await settleBattle(supabaseAdmin(), battle(), A, A, NOW, {
    playerAHp: 20,
    playerBHp: 0,
    currentTurn: 5,
  })

  const rpc = net.calls.filter((c) => c.rpc === 'settle_battle')
  assert.equal(rpc.length, 1)

  const payload = rpc[0].body as {
    p_battle: { winner: string; completed_at: string }
    p_players: Array<Record<string, unknown>>
  }
  assert.equal(payload.p_battle.winner, A)
  assert.equal(payload.p_battle.completed_at, NOW.toISOString())
  assert.equal(payload.p_players.length, 2)

  for (const player of payload.p_players) {
    assert.ok(typeof player.xp === 'number')
    assert.ok(typeof player.level === 'number')
    assert.ok(typeof player.wins === 'number')
    assert.ok(typeof player.losses === 'number')
    assert.ok(typeof player.ties === 'number')
    assert.ok(Array.isArray(player.missions))
    assert.ok(Array.isArray(player.badges))
  }

  assert.equal(net.to('players').filter((c) => c.method === 'PATCH').length, 0)
  assert.equal(net.to('daily_xp').filter((c) => c.method === 'POST' || c.method === 'PATCH').length, 0)
  assert.equal(
    net.to('player_missions').filter((c) => c.method === 'POST').length,
    0,
  )
  assert.equal(
    net.to('player_badges').filter((c) => c.method === 'POST' || c.method === 'PATCH').length,
    0,
  )
})

/**
 * planMissions - the read-only half of settlement.
 *
 * Battle rewards are computed here and applied by one SQL transaction, so the
 * plan must (a) contain the right rows and final XP and (b) write nothing.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeNet } from '@/test/fake-net'
import { supabaseAdmin } from '@/lib/supabase'
import { planMissions } from './settle'

const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const NOW = new Date('2026-11-11T12:00:00.000Z')

let net: FakeNet
afterEach(() => net?.restore())

test('a new daily mission is planned with final XP and no writes', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'player_missions' && c.method === 'GET') return rows()
    if (c.resource === 'daily_xp' && c.method === 'GET') return rows({ xp_earned: 10 })
    return undefined
  })

  const plan = await planMissions(
    supabaseAdmin(),
    PLAYER,
    { xp: 100, level: 3, wins: 0 },
    [{ key: 'quick_duel', xp: 15, isOnetime: false }],
    NOW,
  )

  assert.equal(plan.appliedTotal, 15)
  assert.equal(plan.newXp, 115)
  assert.equal(plan.newLevel, 2)
  assert.equal(plan.rows.length, 1)
  assert.equal(plan.rows[0].mission_key, 'quick_duel')
  assert.ok(plan.rows[0].reset_at)

  assert.equal(net.to('players').filter((c) => c.method === 'PATCH').length, 0)
  assert.equal(net.to('daily_xp').filter((c) => c.method !== 'GET').length, 0)
  assert.equal(net.to('player_missions').filter((c) => c.method !== 'GET').length, 0)
})

test('a mission already credited this week is not planned again', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'player_missions' && c.method === 'GET') {
      return rows({ mission_key: 'quick_duel', completed_at: NOW.toISOString() })
    }
    if (c.resource === 'daily_xp' && c.method === 'GET') return rows()
    if (c.resource === 'missions') {
      return rows({ key: 'quick_duel', type: 'daily', xp_reward: 15 })
    }
    return undefined
  })

  const plan = await planMissions(
    supabaseAdmin(),
    PLAYER,
    { xp: 100, level: 3, wins: 0 },
    [{ key: 'quick_duel', xp: 15, isOnetime: false }],
    NOW,
  )

  assert.equal(plan.appliedTotal, 0)
  assert.equal(plan.newXp, 100)
  assert.deepEqual(plan.rows, [])
})

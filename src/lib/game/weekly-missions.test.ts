/**
 * Exact weekly mission XP and human-win accounting.
 *
 * The pure core is tested with a fixed week so the Monday 00:00 UTC boundary,
 * dedupe and cap are deterministic. The two readers are tested through the
 * fake network so their table and filter contract is pinned as well.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { installFakeNet, rows, type FakeNet } from '@/test/fake-net'
import { supabaseAdmin } from '@/lib/supabase'
import {
  sumWeeklyMissionXp,
  weeklyHumanWins,
  weeklyMissionXp,
  type MissionXpDef,
  type WeeklyCredit,
} from './weekly-missions'

const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const NOW = new Date('2026-11-11T12:00:00.000Z') // Wednesday
const WEEK_START = '2026-11-09T00:00:00.000Z' // Monday
const IN_WEEK = '2026-11-11T10:00:00.000Z'
const BEFORE_WEEK = '2026-11-08T23:59:00.000Z'

const DEFS: MissionXpDef[] = [
  { key: 'weekly_check_in', type: 'weekly', xp_reward: 25 },
  { key: 'steady_saver', type: 'weekly', xp_reward: 35 },
  { key: 'weekly_strategist', type: 'weekly', xp_reward: 40 },
  { key: 'daily_check_in', type: 'daily', xp_reward: 10 },
  { key: 'quick_duel', type: 'daily', xp_reward: 15 },
  { key: 'first_steps', type: 'onetime', xp_reward: 20 },
  { key: 'first_deposit', type: 'onetime', xp_reward: 20 },
]

const credit = (mission_key: string, completed_at = IN_WEEK): WeeklyCredit => ({
  mission_key,
  completed_at,
})

let net: FakeNet
afterEach(() => net?.restore())

// ─── Pure core ──────────────────────────────────────────────────────────────

test('sums the exact rewards of every weekly mission', () => {
  const total = sumWeeklyMissionXp(
    [
      credit('weekly_check_in'),
      credit('steady_saver'),
      credit('weekly_strategist'),
    ],
    DEFS,
    NOW,
  )
  assert.equal(total, 100)
})

test('counts one entry per mission key', () => {
  const total = sumWeeklyMissionXp(
    [credit('weekly_check_in'), credit('weekly_check_in'), credit('weekly_check_in')],
    DEFS,
    NOW,
  )
  assert.equal(total, 25)
})

test('ignores daily and one-time keys', () => {
  const total = sumWeeklyMissionXp(
    [
      credit('weekly_check_in'),
      credit('daily_check_in'),
      credit('quick_duel'),
      credit('first_steps'),
      credit('first_deposit'),
    ],
    DEFS,
    NOW,
  )
  assert.equal(total, 25)
})

test('uses the UTC week window', () => {
  const before = sumWeeklyMissionXp([credit('weekly_check_in', BEFORE_WEEK)], DEFS, NOW)
  const atStart = sumWeeklyMissionXp([credit('steady_saver', WEEK_START)], DEFS, NOW)
  assert.equal(before, 0)
  assert.equal(atStart, 35)
})

test('ignores a credited key with no weekly definition', () => {
  const total = sumWeeklyMissionXp(
    [credit('mystery_mission'), credit('weekly_check_in')],
    DEFS,
    NOW,
  )
  assert.equal(total, 25)
})

test('clamps the exact sum to the weekly cap', () => {
  const defs: MissionXpDef[] = [
    { key: 'weekly_a', type: 'weekly', xp_reward: 60 },
    { key: 'weekly_b', type: 'weekly', xp_reward: 60 },
  ]
  assert.equal(sumWeeklyMissionXp([credit('weekly_a'), credit('weekly_b')], defs, NOW), 100)
})

test('an empty week is zero', () => {
  assert.equal(sumWeeklyMissionXp([], DEFS, NOW), 0)
})

// ─── Readers ────────────────────────────────────────────────────────────────

test('weeklyMissionXp filters by player and week, then reads only those definitions', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'player_missions') {
      return rows(
        credit('weekly_check_in'),
        credit('steady_saver'),
        credit('weekly_check_in'),
        credit('daily_check_in'),
      )
    }
    if (c.resource === 'missions') return rows(...DEFS)
    return undefined
  })

  const total = await weeklyMissionXp(supabaseAdmin(), PLAYER, NOW)
  assert.equal(total, 60)

  const credits = net.to('player_missions')[0]
  assert.equal(credits.query.get('player_address'), `eq.${PLAYER}`)
  assert.equal(credits.query.get('completed_at'), `gte.${WEEK_START}`)

  const defs = net.to('missions')[0]
  const keyFilter = defs.query.get('key') ?? ''
  assert.match(keyFilter, /^in\.\(/)
  assert.ok(keyFilter.includes('weekly_check_in'))
  assert.ok(keyFilter.includes('steady_saver'))
  assert.ok(keyFilter.includes('daily_check_in'))
  assert.equal(keyFilter.includes('weekly_strategist'), false)
})

test('weeklyHumanWins counts this week\'s ranked and unranked wins only', async () => {
  net = installFakeNet((c) => {
    if (c.resource === 'battles') return rows({ id: 'b1' }, { id: 'b2' })
    return undefined
  })

  const wins = await weeklyHumanWins(supabaseAdmin(), PLAYER, NOW)
  assert.equal(wins, 2)

  const call = net.to('battles')[0]
  assert.equal(call.query.get('winner'), `eq.${PLAYER}`)
  const mode = call.query.get('mode') ?? ''
  assert.match(mode, /^in\.\(/)
  assert.ok(mode.includes('ranked'))
  assert.ok(mode.includes('unranked'))
  assert.equal(mode.includes('ai'), false)

  const completedAt = call.query.getAll('completed_at')
  assert.ok(completedAt.includes(`gte.${WEEK_START}`))
  assert.ok(completedAt.includes(`lt.${NOW.toISOString()}`))
})

// ─── Source contracts ───────────────────────────────────────────────────────

const MISSIONS_ROUTE = readFileSync(
  new URL('../../app/api/missions/route.ts', import.meta.url),
  'utf8',
)
const PLAYERS_ROUTE = readFileSync(
  new URL('../../app/api/players/me/route.ts', import.meta.url),
  'utf8',
)
const CHECK_INS_ROUTE = readFileSync(
  new URL('../../app/api/check-ins/route.ts', import.meta.url),
  'utf8',
)
const SETTLE = readFileSync(new URL('./settle.ts', import.meta.url), 'utf8')
const BATTLE_SERVER = readFileSync(new URL('./battleServer.ts', import.meta.url), 'utf8')

test('every weekly XP consumer calls the shared helper', () => {
  for (const source of [MISSIONS_ROUTE, PLAYERS_ROUTE, CHECK_INS_ROUTE, SETTLE]) {
    assert.match(source, /weeklyMissionXp\(/)
  }
})

test('no count-times-33 approximation remains', () => {
  assert.doesNotMatch(CHECK_INS_ROUTE, /\*\s*33/)
  assert.doesNotMatch(SETTLE, /\*\s*33/)
})

test('battle settlement uses the shared human-win count', () => {
  assert.match(BATTLE_SERVER, /weeklyHumanWins\(db, address, now\)/)
  assert.doesNotMatch(BATTLE_SERVER, /\['ranked', 'unranked', 'ai'\]/)
})

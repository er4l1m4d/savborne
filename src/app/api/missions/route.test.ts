/**
 * GET /api/missions contract.
 *
 * The endpoint now reports the exact weekly mission XP and an additive
 * `progress` object on Weekly Strategist. These tests pin the old field names
 * and status codes, the exact reward sum (not a credit-row count), the human
 * win count and its clamp, and the absence of AI wins from the query.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { installFakeNet, rows, type FakeHandler, type FakeNet } from '@/test/fake-net'
import { authRequest } from '@/test/session'
import { GET } from '@/app/api/missions/route'
import { utcWeekStart } from '@/lib/game/time'

const PLAYER = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'

const WEEK_START = utcWeekStart(new Date())
const IN_WEEK = new Date(WEEK_START.getTime() + 60_000).toISOString()
const BEFORE_WEEK = new Date(WEEK_START.getTime() - 60_000).toISOString()

const DEFS = [
  ['daily_check_in', 'Daily Check-in', 'Check in today', 'daily', 10],
  ['quick_duel', 'Quick Duel', 'Start one battle today', 'daily', 15],
  ['weekly_check_in', 'Weekly Check-in', 'Record a check-in this week', 'weekly', 25],
  ['steady_saver', 'Steady Saver', 'Balance held this week', 'weekly', 35],
  ['weekly_strategist', 'Weekly Strategist', 'Win two battles this week', 'weekly', 40],
  ['first_steps', 'First Steps', 'Record your first check-in', 'onetime', 20],
  ['rising_tide', 'Rising Tide', 'Balance increases', 'onetime', 30],
  ['first_blood', 'First Blood', 'Win one battle', 'onetime', 30],
  ['tactician', 'Tactician', 'Use Defend and Special', 'onetime', 25],
  ['bracket_climb', 'Bracket Climb', 'Reach Bronze', 'onetime', 50],
  ['first_deposit', 'Vault Opened', 'Make your first deposit', 'onetime', 20],
].map(([key, name, description, type, xp_reward]) => ({
  key,
  name,
  description,
  type,
  xp_reward,
  bracket_required: key === 'bracket_climb' ? 'bronze' : null,
}))

const CREDITS = [
  { mission_key: 'weekly_check_in', completed_at: IN_WEEK },
  { mission_key: 'steady_saver', completed_at: IN_WEEK },
  // A duplicate weekly credit must not add XP twice.
  { mission_key: 'weekly_check_in', completed_at: IN_WEEK },
  { mission_key: 'daily_check_in', completed_at: IN_WEEK },
  { mission_key: 'first_steps', completed_at: IN_WEEK },
]

const BATTLE_KEYS = [
  'key',
  'name',
  'description',
  'type',
  'xpReward',
  'bracketRequired',
  'completed',
  'completedAt',
  'nextResetAt',
]

let net: FakeNet
afterEach(() => net?.restore())

function req(headers: Record<string, string> = { 'X-Player-Address': PLAYER }): Request {
  return authRequest('http://test/api/missions', { headers })
}

function fixture({
  wins = 0,
  credits = CREDITS,
}: {
  wins?: number
  credits?: { mission_key: string; completed_at: string }[]
} = {}): FakeHandler {
  return (call) => {
    if (call.resource === 'missions') return rows(...DEFS)
    if (call.resource === 'player_missions') return rows(...credits)
    if (call.resource === 'daily_xp') return rows({ xp_earned: 10 })
    if (call.resource === 'battles') {
      return rows(...Array.from({ length: wins }, (_, i) => ({ id: `battle-${i}` })))
    }
    return undefined
  }
}

async function getMissions(options: Parameters<typeof fixture>[0] = {}) {
  net = installFakeNet(fixture(options))
  const res = await GET(req())
  assert.equal(res.status, 200)
  return (await res.json()) as {
    missions: Array<Record<string, unknown> & { key: string; progress?: unknown }>
    counters: Record<string, number>
  }
}

// ─── Boundary and counters ──────────────────────────────────────────────────

test('without a player header it is 401 and queries nothing', async () => {
  net = installFakeNet(() => {
    throw new Error('should not query')
  })
  const res = await GET(req({}))
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
  assert.deepEqual(await res.json(), { error: 'session_required' })
})

test('counters keep their names and report exact weekly XP, not a row count', async () => {
  const body = await getMissions()
  assert.deepEqual(Object.keys(body.counters).sort(), [
    'dailyXpCap',
    'dailyXpEarned',
    'weeklyXpCap',
    'weeklyXpEarned',
  ])
  assert.equal(body.counters.dailyXpEarned, 10)
  assert.equal(body.counters.dailyXpCap, 25)
  assert.equal(body.counters.weeklyXpEarned, 60)
  assert.equal(body.counters.weeklyXpCap, 100)
})

test('a weekly credit before the UTC week start is ignored', async () => {
  const body = await getMissions({
    credits: [
      ...CREDITS,
      { mission_key: 'weekly_strategist', completed_at: BEFORE_WEEK },
    ],
  })
  assert.equal(body.counters.weeklyXpEarned, 60)
})

// ─── Mission shape and progress ─────────────────────────────────────────────

test('every mission keeps its existing fields; progress is only on Weekly Strategist', async () => {
  const body = await getMissions({ wins: 1 })
  assert.equal(body.missions.length, 11)

  const strategist = body.missions.find((m) => m.key === 'weekly_strategist')!
  assert.deepEqual(Object.keys(strategist).sort(), [...BATTLE_KEYS, 'progress'].sort())
  assert.deepEqual(strategist.progress, { current: 1, target: 2 })

  for (const mission of body.missions.filter((m) => m.key !== 'weekly_strategist')) {
    assert.deepEqual(Object.keys(mission).sort(), [...BATTLE_KEYS].sort())
    assert.equal('progress' in mission, false)
  }
})

test('progress is 0 of 2 before any human win', async () => {
  const body = await getMissions({ wins: 0 })
  const strategist = body.missions.find((m) => m.key === 'weekly_strategist')!
  assert.deepEqual(strategist.progress, { current: 0, target: 2 })
  assert.equal(strategist.completed, false)
})

test('progress is 1 of 2 after one human win', async () => {
  const body = await getMissions({ wins: 1 })
  const strategist = body.missions.find((m) => m.key === 'weekly_strategist')!
  assert.deepEqual(strategist.progress, { current: 1, target: 2 })
  assert.equal(strategist.completed, false)
})

test('progress is 2 of 2 after two human wins and the mission is completed', async () => {
  const body = await getMissions({
    wins: 2,
    credits: [
      ...CREDITS,
      { mission_key: 'weekly_strategist', completed_at: IN_WEEK },
    ],
  })
  const strategist = body.missions.find((m) => m.key === 'weekly_strategist')!
  assert.deepEqual(strategist.progress, { current: 2, target: 2 })
  assert.equal(strategist.completed, true)
  assert.equal(body.counters.weeklyXpEarned, 100)
})

test('progress clamps at 2 rather than showing 3 of 2', async () => {
  const body = await getMissions({
    wins: 3,
    credits: [
      ...CREDITS,
      { mission_key: 'weekly_strategist', completed_at: IN_WEEK },
    ],
  })
  const strategist = body.missions.find((m) => m.key === 'weekly_strategist')!
  assert.deepEqual(strategist.progress, { current: 2, target: 2 })
  assert.equal(strategist.completed, true)
})

test('the human-win query excludes AI battles', async () => {
  await getMissions({ wins: 2 })
  const call = net.to('battles')[0]
  assert.equal(call.query.get('winner'), `eq.${PLAYER}`)
  const mode = call.query.get('mode') ?? ''
  assert.equal(mode, 'in.(ranked,unranked)')
  assert.equal(mode.includes('ai'), false)
})

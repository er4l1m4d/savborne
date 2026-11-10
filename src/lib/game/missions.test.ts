/**
 * Mission evaluation for battles.
 *
 * Weekly Strategist is a human-only mission: two wins against players in the
 * current UTC week. The settlement layer supplies `weeklyWinsBefore` from the
 * shared human-win count, and this evaluator must never credit an AI win even
 * when the count is high.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { evaluateForBattle, type BattleSnapshot } from './missions'

const BASE: BattleSnapshot = {
  isHumanOpponent: true,
  outcome: 'win',
  usedDefend: false,
  usedSpecial: false,
  weeklyWinsBefore: 0,
  firstBattleToday: false,
}

test('a second human win credits Weekly Strategist', () => {
  const keys = evaluateForBattle({ ...BASE, weeklyWinsBefore: 1 }).map((m) => m.key)
  assert.ok(keys.includes('weekly_strategist'))
})

test('the first human win does not credit Weekly Strategist', () => {
  const keys = evaluateForBattle({ ...BASE, weeklyWinsBefore: 0 }).map((m) => m.key)
  assert.equal(keys.includes('weekly_strategist'), false)
})

test('an AI win never credits a human mission', () => {
  const keys = evaluateForBattle({
    ...BASE,
    isHumanOpponent: false,
    weeklyWinsBefore: 9,
  }).map((m) => m.key)
  assert.equal(keys.includes('weekly_strategist'), false)
  assert.equal(keys.includes('first_blood'), false)
})

test('a human tie or loss does not progress Weekly Strategist', () => {
  for (const outcome of ['tie', 'loss'] as const) {
    const keys = evaluateForBattle({ ...BASE, outcome, weeklyWinsBefore: 1 }).map((m) => m.key)
    assert.equal(keys.includes('weekly_strategist'), false)
  }
})

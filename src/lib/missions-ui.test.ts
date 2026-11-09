import { test } from 'node:test'
import assert from 'node:assert/strict'
import { earnedXp, xpCounter } from './missions-ui'

const row = (xpReward: number, completed: boolean) => ({ xpReward, completed })

test('earned XP sums only completed rows', () => {
  assert.equal(earnedXp([row(10, true), row(15, false)], 25), 10)
})

test('earned XP reaches the cap when everything is done', () => {
  assert.equal(earnedXp([row(10, true), row(15, true)], 25), 25)
})

test('earned XP clamps to a smaller cap', () => {
  assert.equal(earnedXp([row(30, true)], 25), 25)
})

test('an empty slate earns nothing and a zero cap does not clamp', () => {
  assert.equal(earnedXp([], 25), 0)
  assert.equal(earnedXp([row(10, true)], 0), 10)
})

test('the counter copy matches the handoff', () => {
  assert.equal(xpCounter(10, 25), '10 of 25 XP')
  assert.equal(xpCounter(0, 100), '0 of 100 XP')
})

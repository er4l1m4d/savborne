/**
 * hasBattleEffect - the ItemSheet's honesty check.
 *
 * The engine's `modsForItems` switch is the source of truth for which items do
 * something in the arena. This test pins the two that do not (Ledger Scroll
 * earns its +5% at check-in, the Golden Crown is a status badge) so the sheet
 * can never again offer them as a turn action.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { hasBattleEffect, modsForItems, NO_MODS } from './battle'
import { ITEMS, type ItemKey } from './items'

test('every item key is classified, and only the engine-modified ones battle', () => {
  for (const item of ITEMS) {
    const expected =
      JSON.stringify(modsForItems([item.key])) !== JSON.stringify(NO_MODS)
    assert.equal(
      hasBattleEffect(item.key),
      expected,
      `hasBattleEffect(${item.key}) must agree with modsForItems`,
    )
  }
})

test('the two out-of-battle items are exactly Ledger Scroll and Golden Crown', () => {
  const passive = ITEMS.filter((item) => !hasBattleEffect(item.key)).map(
    (item) => item.key,
  )
  assert.deepEqual(passive, ['ledger_scroll', 'golden_crown'])
})

test('the six battle items keep their modifiers', () => {
  const battleItems: ItemKey[] = [
    'cloth_purse',
    'bronze_shield',
    'copper_compass',
    'silver_blade',
    'silver_charm',
    'gold_gauntlet',
  ]
  for (const key of battleItems) {
    assert.equal(hasBattleEffect(key), true)
  }
})

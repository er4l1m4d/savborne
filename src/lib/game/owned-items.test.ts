import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownedItemKeys } from './owned-items'

test('a revoked Golden Crown badge still owns the crown item', () => {
  assert.deepEqual(
    ownedItemKeys(['cloth_purse'], [
      { badge_key: 'golden_crown', revoked_at: '2026-11-09T00:00:00.000Z' },
    ]),
    ['cloth_purse', 'golden_crown'],
  )
})

test('no crown badge row means no crown item', () => {
  assert.deepEqual(ownedItemKeys(['cloth_purse'], [{ badge_key: 'week_warrior' }]), [
    'cloth_purse',
  ])
})

test('the crown is not duplicated when it is already an item row', () => {
  assert.deepEqual(
    ownedItemKeys(['golden_crown'], [{ badge_key: 'golden_crown' }]),
    ['golden_crown'],
  )
})

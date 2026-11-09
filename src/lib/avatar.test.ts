import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AVATARS, DEFAULT_AVATAR, isAvatar, normaliseAvatar } from './avatar'

test('the two shipped avatars are hero and heroine', () => {
  assert.deepEqual([...AVATARS], ['hero', 'heroine'])
  assert.equal(DEFAULT_AVATAR, 'hero')
})

test('isAvatar accepts only the two drawings', () => {
  assert.equal(isAvatar('hero'), true)
  assert.equal(isAvatar('heroine'), true)
  assert.equal(isAvatar('male'), false)
  assert.equal(isAvatar('female'), false)
  assert.equal(isAvatar(undefined), false)
  assert.equal(isAvatar(null), false)
})

test('normaliseAvatar falls back to Hero', () => {
  assert.equal(normaliseAvatar('heroine'), 'heroine')
  assert.equal(normaliseAvatar('hero'), 'hero')
  assert.equal(normaliseAvatar('other'), 'hero')
  assert.equal(normaliseAvatar(undefined), 'hero')
})

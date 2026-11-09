import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DISPLAY_NAME_MAX,
  normaliseDisplayName,
  validateDisplayName,
} from './display-name'

test('the new-name limit is 16', () => {
  assert.equal(DISPLAY_NAME_MAX, 16)
})

test('names are trimmed before validation', () => {
  assert.equal(normaliseDisplayName('  Ada  '), 'Ada')
  assert.deepEqual(validateDisplayName('  Ada  '), { ok: true, value: 'Ada' })
})

test('1 to 16 characters pass', () => {
  assert.deepEqual(validateDisplayName('A'), { ok: true, value: 'A' })
  assert.deepEqual(validateDisplayName('Ada the Saver 16'), {
    ok: true,
    value: 'Ada the Saver 16',
  })
})

test('empty, whitespace, 17 and 32 characters fail', () => {
  const message = 'Display name must be 1-16 characters.'
  assert.deepEqual(validateDisplayName(''), { ok: false, error: message })
  assert.deepEqual(validateDisplayName('   '), { ok: false, error: message })
  assert.deepEqual(validateDisplayName('a'.repeat(17)), { ok: false, error: message })
  assert.deepEqual(validateDisplayName('a'.repeat(32)), { ok: false, error: message })
})

import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

test('the player route and the onboarding draft share the 16-character rule', () => {
  const route = source('../app/api/players/route.ts')
  const provider = source('../components/onboarding/OnboardingProvider.tsx')
  assert.match(route, /import \{ validateDisplayName \} from '@\/lib\/display-name'/)
  assert.match(route, /const name = validateDisplayName\(displayName\)/)
  assert.doesNotMatch(route, /displayName\.trim\(\)\.length > 32/)
  assert.match(provider, /validateDisplayName\(name\)/)
})

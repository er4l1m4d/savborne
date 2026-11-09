import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sessionFromProfile, reconnectDecision, disconnectPlan } from './reconnect'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const SETUP = source('../app/setup/page.tsx')

test('Setup renders the shared privacy notice', () => {
  assert.match(SETUP, /from '@\/components\/PrivacyNotice'/)
  assert.match(SETUP, /<PrivacyNotice \/>/)
  assert.doesNotMatch(SETUP, /What we collect/)
})

test('a profile maps to exactly the session fields', () => {
  const result = sessionFromProfile({
    address: 'NQ07 0000',
    displayName: 'Ada',
    savingsAddress: 'NQ57 1111',
  })
  assert.deepEqual(result, {
    playerAddress: 'NQ07 0000',
    displayName: 'Ada',
    savingsAddress: 'NQ57 1111',
  })
  assert.deepEqual(Object.keys(result).sort(), [
    'displayName',
    'playerAddress',
    'savingsAddress',
  ])
})

test('only a 200 reconnects and only a 404 creates', () => {
  assert.equal(reconnectDecision(200), 'reconnect')
  assert.equal(reconnectDecision(404), 'create')
  assert.equal(reconnectDecision(401), 'error')
  assert.equal(reconnectDecision(500), 'error')
})

test('disconnect clears the vault only when one is on this device', () => {
  assert.equal(disconnectPlan(true), 'vault-and-session')
  assert.equal(disconnectPlan(false), 'session-only')
})

test('Setup checks for an existing profile before creating a vault', () => {
  assert.match(SETUP, /reconnectDecision/)
  assert.match(SETUP, /\/api\/players\/me/)
  const choose = SETUP.indexOf('async function chooseAccount')
  const create = SETUP.indexOf('async function createVault')
  assert.ok(choose >= 0, 'chooseAccount is missing')
  assert.ok(create > choose, 'createVault must come after chooseAccount')
  assert.match(SETUP, /onPick=\{chooseAccount\}/)
  assert.match(SETUP, /We reconnect it instead of creating a second vault/)
})

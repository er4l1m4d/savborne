import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sessionFromProfile, reconnectDecision, disconnectPlan, reconnectProfile } from './reconnect'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const SETUP = source('../app/setup/page.tsx')
const SETTINGS = source('../app/settings/page.tsx')
const DELETE_ROUTE = source('../app/settings/delete/page.tsx')
const FLOW = source('../components/settings/DeleteAccountFlow.tsx')
const PROFILE = source('../app/(tabs)/profile/page.tsx')

test('Setup redirects to the new welcome route', () => {
  assert.match(SETUP, /redirect\('\/welcome'\)/)
  assert.doesNotMatch(SETUP, /<PrivacyNotice \/>/)
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

test('a malformed reconnect payload is rejected before it can become a session', () => {
  assert.equal(reconnectProfile(null), null)
  assert.equal(reconnectProfile({}), null)
  assert.equal(
    reconnectProfile({ address: 'NQ07 0000', displayName: '', savingsAddress: 'NQ57 1111' }),
    null,
  )
  assert.deepEqual(
    reconnectProfile({
      address: 'NQ07 0000',
      displayName: 'Ada',
      savingsAddress: 'NQ57 1111',
      level: 4,
    }),
    { address: 'NQ07 0000', displayName: 'Ada', savingsAddress: 'NQ57 1111' },
  )
})

test('disconnect clears the vault only when one is on this device', () => {
  assert.equal(disconnectPlan(true), 'vault-and-session')
  assert.equal(disconnectPlan(false), 'session-only')
})

test('Onboarding checks for an existing profile before creating a vault', () => {
  const PROVIDER = source('../components/onboarding/OnboardingProvider.tsx')
  assert.match(PROVIDER, /reconnectDecision/)
  assert.match(PROVIDER, /\/api\/players\/me/)
  assert.match(PROVIDER, /reconnectProfile\(body\.player\)/)
  assert.match(PROVIDER, /sameAddress\(profile\.address, identity\)/)
  assert.match(PROVIDER, /writeSession\(sessionFromProfile\(profile\)\)/)
  const reconnect = PROVIDER.indexOf('reconnectDecision(res.status)')
  const create = PROVIDER.indexOf('generatePhrase()')
  assert.ok(reconnect >= 0, 'reconnectDecision is missing')
  assert.ok(create > reconnect, 'a new vault must only start after the reconnect probe')
})

test('the delete route keeps the proof gate and the signed request', () => {
  assert.match(DELETE_ROUTE, /<DeleteAccountFlow/)
  assert.match(FLOW, /deletionGate/)
  assert.match(FLOW, /signMessage/)
  assert.match(FLOW, /deleteAuthHeaders/)
  assert.match(FLOW, /<BottomSheet/)
  assert.doesNotMatch(FLOW, /phase === 'closed'/)

  const deleteAt = FLOW.indexOf("method: 'DELETE'")
  const clearAt = FLOW.indexOf('clearVault(')
  assert.ok(deleteAt >= 0, 'DELETE request is missing')
  assert.ok(clearAt > deleteAt, 'local state must clear only after the DELETE request')
  assert.match(FLOW, /finally \{[\s\S]*?window\.location\.replace\('\/setup'\)/)
  assert.match(FLOW, /onClick=\{deleteAccount\}/)
  assert.match(FLOW, /onClick=\{\(\) => setConfirmOpen\(true\)\}/)
  assert.match(FLOW, /res\.status === 401/)
  assert.match(FLOW, /if \(busy\) return/)
  assert.match(FLOW, /phase === 'type-words'\s*\?\s*0/)
})

test('Disconnect clears local state defensively and still leaves for setup', () => {
  assert.match(SETTINGS, /try \{[\s\S]{0,200}clearVault\(playerAddress\)/)
  assert.doesNotMatch(SETTINGS, /function disconnect\(\)[\s\S]{0,600}TOUR_FLAG_KEY/)
  assert.match(SETTINGS, /window\.location\.replace\('\/setup'\)/)
})

test('Settings is a pushed screen with both destructive actions', () => {
  assert.match(SETTINGS, /variant="pushed"/)
  assert.match(SETTINGS, /backHref="\/profile"/)
  assert.match(SETTINGS, /Disconnect savings account/)
  assert.match(SETTINGS, /href="\/settings\/delete"/)
  assert.match(SETTINGS, /<BottomSheet/)
  assert.match(SETTINGS, /<PrivacyNotice \/>/)
  assert.match(SETTINGS, /Vault unavailable/)
  assert.match(SETTINGS, /Unavailable/)
})

test('Profile links to Settings and no longer owns account deletion', () => {
  assert.match(PROFILE, /href="\/settings"/)
  assert.match(PROFILE, /aria-label="Settings"/)
  assert.doesNotMatch(PROFILE, /DeleteAccount/)
  assert.doesNotMatch(PROFILE, /BackupSettings/)
  assert.doesNotMatch(PROFILE, /Show tour again/)
})

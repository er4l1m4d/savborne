import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkInDestination,
  takeBracketHandoff,
  takeWithdrawalHandoff,
  writeBracketHandoff,
  writeWithdrawalHandoff,
} from './checkin-handoff'

test('a withdrawal wins over a bracket change', () => {
  assert.equal(
    checkInDestination({
      firstCheckIn: false,
      withdrawalDetected: true,
      bracketChanged: true,
      bracket: 'bronze',
      previousBracket: 'entry',
    }),
    'withdrawal',
  )
})

test('a bracket rise lands on the climb screen', () => {
  assert.equal(
    checkInDestination({
      firstCheckIn: false,
      withdrawalDetected: false,
      bracketChanged: true,
      bracket: 'bronze',
      previousBracket: 'entry',
    }),
    'bracket-climb',
  )
})

test('a drop below the entry floor has no climb screen', () => {
  assert.equal(
    checkInDestination({
      firstCheckIn: false,
      withdrawalDetected: false,
      bracketChanged: true,
      bracket: null,
      previousBracket: 'entry',
    }),
    'home',
  )
})

test('a demotion is not a climb', () => {
  assert.equal(
    checkInDestination({
      firstCheckIn: false,
      withdrawalDetected: false,
      bracketChanged: true,
      bracket: 'silver',
      previousBracket: 'gold',
    }),
    'home',
  )
})

test('an ordinary check-in stays on home', () => {
  assert.equal(
    checkInDestination({
      firstCheckIn: false,
      withdrawalDetected: false,
      bracketChanged: false,
      bracket: 'silver',
      previousBracket: 'silver',
    }),
    'home',
  )
})

test('the first check-in wins over every other celebration', () => {
  assert.equal(
    checkInDestination({
      firstCheckIn: true,
      withdrawalDetected: true,
      bracketChanged: true,
      bracket: 'entry',
      previousBracket: null,
    }),
    'first-checkin',
  )
})

function installWindow(setItem?: (key: string, value: string) => void) {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: setItem ?? ((key: string, value: string) => store.set(key, value)),
        removeItem: (key: string) => store.delete(key),
      },
    },
  })
}

test('a bracket handoff is consumed once', () => {
  installWindow()
  assert.equal(writeBracketHandoff({ bracket: 'bronze', xp: 50, items: [] }), true)
  assert.deepEqual(takeBracketHandoff(), { bracket: 'bronze', xp: 50, items: [] })
  assert.equal(takeBracketHandoff(), null)
})

test('a withdrawal handoff is consumed once', () => {
  installWindow()
  assert.equal(
    writeWithdrawalHandoff({ fromLuna: 10, toLuna: 5, revoked: ['week_warrior'] }),
    true,
  )
  assert.equal(takeWithdrawalHandoff()?.toLuna, 5)
  assert.equal(takeWithdrawalHandoff(), null)
})

test('a blocked storage API reports a failed write', () => {
  installWindow(() => {
    throw new Error('blocked')
  })
  assert.equal(
    writeWithdrawalHandoff({ fromLuna: 10, toLuna: 5, revoked: [] }),
    false,
  )
})

import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'

type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const map = new Map<string, string>()
const storage: StorageLike = {
  getItem: (key) => map.get(key) ?? null,
  setItem: (key, value) => void map.set(key, value),
  removeItem: (key) => void map.delete(key),
}

const globals = globalThis as unknown as { window?: { sessionStorage: StorageLike } }

beforeEach(async () => {
  map.clear()
  globals.window = { sessionStorage: storage }
  const { takeBalanceRetry } = await import('./balance-retry')
  takeBalanceRetry()
})

test('a retry flag is consumed exactly once', async () => {
  const { writeBalanceRetry, takeBalanceRetry } = await import('./balance-retry')
  assert.equal(writeBalanceRetry(), true)
  assert.equal(takeBalanceRetry(), true)
  assert.equal(takeBalanceRetry(), false)
})

test('a flag written before a reload is still consumed', async () => {
  map.set('savborne.balance-retry.v1', '1')
  const { takeBalanceRetry } = await import('./balance-retry')
  assert.equal(takeBalanceRetry(), true)
  assert.equal(takeBalanceRetry(), false)
  assert.equal(map.has('savborne.balance-retry.v1'), false)
})

test('a blocked write returns false and leaves no flag', async () => {
  globals.window = {
    sessionStorage: {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {},
    },
  }
  const { writeBalanceRetry, takeBalanceRetry } = await import('./balance-retry')
  assert.equal(writeBalanceRetry(), false)
  assert.equal(takeBalanceRetry(), false)
})

test('a blocked read is safe', async () => {
  globals.window = {
    sessionStorage: {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {},
      removeItem: () => {
        throw new Error('blocked')
      },
    },
  }
  const { takeBalanceRetry } = await import('./balance-retry')
  assert.equal(takeBalanceRetry(), false)
})

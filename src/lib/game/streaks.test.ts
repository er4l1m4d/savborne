/**
 * Harness smoke test.
 *
 * The point of this file is the import: `@/lib/constants` only resolves if
 * tsx reads `tsconfig.json`'s paths. Every later test imports real app
 * modules across directory boundaries, so this proves the harness before the
 * logic tests rely on it.
 *
 * Replaced by the real streak tests in the shields task.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LUNA_PER_NIM } from '@/lib/constants'

test('tsx resolves the @/ alias', () => {
  assert.equal(LUNA_PER_NIM, 100_000)
})

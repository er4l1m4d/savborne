import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const FIRST = source('../app/first-checkin/page.tsx')

test('First check-in uses the badge and item art', () => {
  assert.match(FIRST, /<BadgeArt/)
  assert.match(FIRST, /<ItemArt/)
  assert.match(FIRST, /Go to Home/)
  assert.match(FIRST, /First Steps/)
})

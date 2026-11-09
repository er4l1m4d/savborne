import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const PAGE = source('../app/balance-error/page.tsx')
const HOME = source('../app/(tabs)/page.tsx')

test('the balance error screen promises the balance was not zero', () => {
  assert.match(PAGE, /Couldn&apos;t read your balance/)
  assert.doesNotMatch(PAGE, /sv-number-m/)
  assert.match(PAGE, /wasn&apos;t recorded/)
  assert.match(PAGE, /wasn&apos;t counted as\s+zero/)
  assert.match(PAGE, /streak and XP are safe/)
  assert.match(PAGE, /Try again/)
  assert.match(PAGE, /Go back to Home/)
})

test('the screen uses the coral warning panel and the alert glyph', () => {
  assert.match(PAGE, /tone="coral"/)
  assert.match(PAGE, /<Glyph name="alert" size=\{72\} className="text-coral" \/>/)
  assert.match(PAGE, /sv-shake/)
})

test('Try again leaves a one-shot flag for Home', () => {
  assert.match(PAGE, /writeBalanceRetry\(\)/)
  assert.match(PAGE, /router\.replace\('\/'\)/)
})

test('Home routes only rpc_unreachable to the screen', () => {
  assert.match(HOME, /res\.status === 503/)
  assert.match(HOME, /code === 'rpc_unreachable'/)
  assert.match(HOME, /router\.push\('\/balance-error'\)/)
  assert.match(HOME, /throw new Error\(`Check-in failed/)
})

test('Home consumes the retry flag once after the player loads', () => {
  assert.match(HOME, /takeBalanceRetry\(\)/)
  assert.match(
    HOME,
    /if \(loading \|\| !session \|\| !player\) return\n\s+const timer = setTimeout\(\(\) => \{/,
  )
  assert.match(HOME, /if \(!takeBalanceRetry\(\)\) return\n\s+void onCheckIn\(\)/)
  assert.match(HOME, /return \(\) => clearTimeout\(timer\)/)
})

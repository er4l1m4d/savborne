import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const PAGE = readFileSync(
  new URL('../app/battle/queue/page.tsx', import.meta.url),
  'utf8',
)

test('the queue joins, polls and leaves through the existing APIs', () => {
  assert.match(PAGE, /\/api\/queue\/join/)
  assert.match(PAGE, /\/api\/queue\/poll/)
  assert.match(PAGE, /\/api\/queue\/leave/)
  assert.match(PAGE, /RANKED\.pollIntervalMs/)
  assert.match(PAGE, /pagehide/)
})

test('the searching state has the VS cards, timer and range', () => {
  assert.match(PAGE, /VersusCards/)
  assert.match(PAGE, /Searching for a ranked opponent/)
  assert.match(PAGE, /Time in queue/)
  assert.match(PAGE, /Rating range/)
  assert.match(PAGE, /queueTimeLabel/)
  assert.match(PAGE, /Leave queue/)
})

test('the timeout keeps searching and offers AI, friend and leave', () => {
  assert.match(PAGE, /RANKED\.queueTimeoutSeconds/)
  assert.match(PAGE, /No match yet\./)
  assert.match(PAGE, /Battle the AI/)
  assert.match(PAGE, /Challenge a friend/)
  assert.match(PAGE, /\/api\/battles\/ai/)
  assert.match(PAGE, /\/api\/battles\/friend/)
  assert.match(PAGE, /We&apos;ll keep searching/)
})

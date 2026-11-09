import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = (name: string) =>
  readFileSync(new URL(`../components/battle/${name}`, import.meta.url), 'utf8')

test('ModeCard is a real button when available and an off panel otherwise', () => {
  const src = component('ModeCard.tsx')
  assert.match(src, /Button/)
  assert.match(src, /variant=\{primary \? 'primary' : 'secondary'\}/)
  assert.match(src, /size="mode"/)
  assert.match(src, /PixelPanel tone="off"/)
  assert.match(src, /sv-subheading/)
  assert.match(src, /sv-label/)
  assert.match(src, /min-h-\[96px\]/)
})

test('VersusCards pairs the fighter cards with a VS label', () => {
  const src = component('VersusCards.tsx')
  assert.match(src, /PixelPanel tone="mint"/)
  assert.match(src, /PixelPanel tone="off"/)
  assert.match(src, />\s*VS\s*</)
  assert.match(src, /sv-subheading/)
  assert.match(src, /UnknownFighter/)
})

test('Arena owns both plates, meters and status labels', () => {
  const src = component('Arena.tsx')
  assert.match(src, /PixelPanel/)
  assert.match(src, /Meter/)
  assert.match(src, /sv-section-label/)
  assert.match(src, /h-\[380px\]/)
  assert.match(src, /min-\[390px\]:h-\[410px\]/)
  assert.match(src, /h-\[250px\]/)
  assert.match(src, /YOUR MOVE/)
  assert.match(src, /OFFLINE/)
  assert.match(src, /ACTED/)
  assert.match(src, /items-end/)
  assert.match(src, /justify-center/)
  assert.match(src, /gap-4/)
  assert.match(src, /pb-\[32px\]/)
})

test('ItemSheet uses the bottom sheet and the three item states', () => {
  const src = component('ItemSheet.tsx')
  assert.match(src, /BottomSheet/)
  assert.match(src, /title="Use an item"/)
  assert.match(src, /size="item"/)
  assert.match(src, /ItemArt/)
  assert.match(src, /'Use'/)
  assert.match(src, /'Used'/)
  assert.match(src, /'Locked'/)
  assert.match(src, /border-mint/)
  assert.match(src, /border-dashed/)
})

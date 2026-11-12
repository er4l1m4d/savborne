import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { earnedXp, xpCounter } from './missions-ui'

const PAGE = readFileSync(
  new URL('../app/(tabs)/missions/page.tsx', import.meta.url),
  'utf8',
)

const row = (xpReward: number, completed: boolean) => ({ xpReward, completed })

test('earned XP sums only completed rows', () => {
  assert.equal(earnedXp([row(10, true), row(15, false)], 25), 10)
})

test('earned XP reaches the cap when everything is done', () => {
  assert.equal(earnedXp([row(10, true), row(15, true)], 25), 25)
})

test('earned XP clamps to a smaller cap', () => {
  assert.equal(earnedXp([row(30, true)], 25), 25)
})

test('an empty slate earns nothing and a zero cap does not clamp', () => {
  assert.equal(earnedXp([], 25), 0)
  assert.equal(earnedXp([row(10, true)], 0), 10)
})

test('the counter copy matches the handoff', () => {
  assert.equal(xpCounter(10, 25), '10 of 25 XP')
  assert.equal(xpCounter(0, 100), '0 of 100 XP')
})

test('the page uses tabs and the shared primitives only', () => {
  for (const part of [
    '<Tabs',
    '<PixelPanel',
    '<Row',
    '<Banner',
    '<Button',
    '<LoadingState />',
    '<Meter',
  ]) {
    assert.ok(PAGE.includes(part), part)
  }
  assert.doesNotMatch(PAGE, /vpx|CapMeters|function Cap\(/)
})

test('the page ports the handoff groups and copy', () => {
  assert.match(PAGE, /Repeating/)
  assert.match(PAGE, /One-time/)
  assert.match(PAGE, /Never expires/)
  assert.match(PAGE, /Resets 00:00 UTC/)
  assert.match(PAGE, /Resets Monday 00:00 UTC/)
  assert.match(PAGE, /xpCounter\(/)
  assert.match(PAGE, /earnedXp\(/)
})

test('the one-time tab is a progress list, not a flat archive', () => {
  assert.match(PAGE, /Milestones/)
  assert.match(PAGE, /oneTimeDone/)
  assert.match(PAGE, /oneTimeXp/)
  assert.match(PAGE, /progress=\{\{ value: oneTimeDone, max: oneTime\.length \}\}/)
  assert.match(PAGE, /Number\(a\.completed\) - Number\(b\.completed\)/)
  assert.match(PAGE, /px-4 py-2/)
})

test('the row shows a 24px status box, mint XP and open-row descriptions', () => {
  assert.match(PAGE, /w-6 h-6/)
  assert.match(PAGE, /<Glyph name="check"/)
  assert.match(PAGE, /sv-figure/)
  assert.match(PAGE, /m\.completed \? 'text-fg-muted' : 'text-mint'/)
  assert.match(PAGE, /\) : !m\.completed \? \(/)
  assert.match(PAGE, /\(completed\)/)
})

test('Weekly Strategist renders the handoff progress meter', () => {
  assert.match(PAGE, /m\.progress \? \(/)
  assert.match(PAGE, /<Meter/)
  assert.match(PAGE, /height=\{14\}/)
  assert.match(PAGE, /w-\[90px\] shrink-0/)
  assert.match(PAGE, /m\.progress\.current/)
  assert.match(PAGE, /of \{m\.progress\.target\} wins/)
  assert.match(PAGE, /label=\{`/)
})

test('the row type fits the handoff and clears the divider', () => {
  assert.match(PAGE, /text-\[15px\] leading-\[1\.35\] font-semibold/)
  assert.match(PAGE, /sv-caption font-medium leading-\[1\.35\]/)
  assert.match(PAGE, /flex flex-col gap-0\.5 py-2/)
})

test('groups keep the shell rhythm and use a wider group gap', () => {
  assert.match(PAGE, /function GroupList/)
  assert.match(PAGE, /flex flex-col gap-9/)
  assert.match(PAGE, /bodyClassName="gap-3\.5"/)
})

test('the page keeps the states and drops the cap cards', () => {
  assert.match(PAGE, /Couldn't load missions\./)
  assert.match(PAGE, /Try again/)
  assert.match(PAGE, /No missions right now\./)
  assert.match(PAGE, /Check back after the next reset\./)
  assert.match(PAGE, /One-time missions appear as you play\./)
  assert.doesNotMatch(PAGE, /<Chip/)
})

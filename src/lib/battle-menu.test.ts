import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const PAGE = readFileSync(
  new URL('../app/(tabs)/battle/page.tsx', import.meta.url),
  'utf8',
)

test('the menu is the handoff three-mode card screen', () => {
  assert.match(PAGE, /title="Battle"/)
  assert.match(PAGE, /battles left today/)
  assert.match(PAGE, /<ModeCard/)
  assert.match(PAGE, /title="Ranked"/)
  assert.match(PAGE, /title="Friend"/)
  assert.match(PAGE, /title="AI Opponent"/)
  assert.match(PAGE, /Choose opponent|Find a ranked match/)
})

test('ranked locked shows both requirement meters and the Missions link', () => {
  assert.match(PAGE, /Ranked · Locked/)
  assert.match(PAGE, /rankedProgress/)
  assert.match(PAGE, /RankedBar/)
  assert.match(PAGE, /<Meter/)
  assert.match(PAGE, /Go to Missions/)
  assert.match(PAGE, /Add at least 1 NIM/)
})

test('the daily limit shows the reset countdown and three off cards', () => {
  assert.match(PAGE, /DailyLimit/)
  assert.match(PAGE, /nextUtcMidnight/)
  assert.match(PAGE, /formatCountdown/)
  assert.match(PAGE, /New battles unlock at 00:00 UTC/)
  assert.match(PAGE, /BATTLE\.dailyLimit/)
})

test('the old inline queue, challenge code and how-it-works block are gone', () => {
  assert.doesNotMatch(PAGE, /queued/)
  assert.doesNotMatch(PAGE, /sharePath/)
  assert.doesNotMatch(PAGE, /How battles work/)
  assert.doesNotMatch(PAGE, /Copy challenge link/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const ART = source('../components/CharacterArt.tsx')
const PICKER = source('../components/CharacterPicker.tsx')
const NAME = source('../app/(onboarding)/name/page.tsx')
const HOME = source('../app/(tabs)/page.tsx')
const PROFILE = source('../app/(tabs)/profile/page.tsx')
const SETTINGS = source('../app/settings/page.tsx')
const QUEUE = source('../app/battle/queue/page.tsx')
const FRIEND = source('../app/battle/friend/[id]/page.tsx')
const ARENA = source('../app/battle/[id]/page.tsx')
const RESULT = source('../app/battle/[id]/result/page.tsx')

test('CharacterArt maps Hero and Heroine for every bracket, default Hero', () => {
  assert.match(ART, /const KEY: Record<Avatar, Record<Bracket, keyof typeof art>>/)
  assert.match(ART, /hero: \{/)
  assert.match(ART, /heroine: \{/)
  assert.match(ART, /'Heroine · Entry'/)
  assert.match(ART, /character = 'hero'/)
  assert.match(ART, /character\?: Avatar/)
})

test('the picker is two 56px toggles with 32px art', () => {
  assert.match(PICKER, /role="group" aria-label="Character"/)
  assert.match(PICKER, /grid grid-cols-2 gap-3/)
  assert.match(PICKER, /aria-pressed=\{selected\}/)
  assert.match(PICKER, /<CharacterArt bracket=\{bracket\} character=\{option\} size=\{32\} \/>/)
  assert.match(PICKER, /variant="secondary"/)
  assert.match(PICKER, /border-mint text-mint/)
  assert.match(PICKER, /const LABELS: Record<Avatar, string> = \{ hero: 'Hero', heroine: 'Heroine' \}/)
})

test('the Name step previews and picks the chosen character', () => {
  assert.match(NAME, /<CharacterArt bracket=\{null\} character=\{avatar\} size=\{128\} \/>/)
  assert.match(NAME, /<CharacterPicker value=\{avatar\} onChange=\{setAvatar\} \/>/)
  assert.match(NAME, /<OnboardingScreen step=\{5\}/)
})

test('the player sprites carry the avatar; Home and Profile included', () => {
  assert.match(HOME, /character=\{player\.avatar\}/)
  assert.match(PROFILE, /character=\{data\.player\.avatar\}/)
  assert.match(QUEUE, /character=\{player\?\.avatar\}/)
  assert.match(FRIEND, /character=\{player\?\.avatar\}/)
  assert.match(ARENA, /character=\{viewer\.avatar as Avatar\}/)
  assert.match(RESULT, /character=\{viewer\.avatar as Avatar\}/)
})

test('Settings has the picker and saves through PATCH /api/players/me', () => {
  assert.match(SETTINGS, /<CharacterPicker/)
  assert.match(SETTINGS, /async function changeAvatar/)
  assert.match(SETTINGS, /method: 'PATCH'/)
  assert.match(SETTINGS, /apiFetch\('\/api\/players\/me'/)
  assert.match(SETTINGS, /body: JSON\.stringify\(\{ avatar: next \}\)/)
})

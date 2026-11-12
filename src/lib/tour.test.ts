import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const TOUR = readFileSync(
  new URL('../components/VaultTour.tsx', import.meta.url),
  'utf8',
)
const PLACEMENT = readFileSync(
  new URL('./tour-placement.ts', import.meta.url),
  'utf8',
)
const NAV = readFileSync(
  new URL('../components/PixelNav.tsx', import.meta.url),
  'utf8',
)
const HOME = readFileSync(
  new URL('../app/(tabs)/page.tsx', import.meta.url),
  'utf8',
)
const SETTINGS = readFileSync(
  new URL('../app/settings/page.tsx', import.meta.url),
  'utf8',
)
const DELETE = readFileSync(
  new URL('../components/settings/DeleteAccountFlow.tsx', import.meta.url),
  'utf8',
)

test('two tours have two flags and their own screens', () => {
  assert.match(TOUR, /APP_TOUR_FLAG_KEY = 'savborne\.tour\.app\.v1'/)
  assert.match(TOUR, /TOUR_FLAG_KEY = 'savborne\.tour\.v1'/)
  assert.match(TOUR, /pathname === '\/'/)
  assert.match(TOUR, /pathname === '\/vault'/)
  assert.match(TOUR, /lastLabel: 'Start playing'/)
  assert.match(TOUR, /lastLabel: 'Deposit now'/)
  assert.match(
    TOUR,
    /if \(kind === 'app'\) window\.localStorage\.setItem\(TOUR_FLAG_KEY, 'done'\)/,
  )
})

test('the app tour anchors exist on Home and in the nav', () => {
  for (const anchor of [
    'home-savings',
    'checkin',
    'nav-missions',
    'nav-battle',
    'nav-ranks',
    'nav-profile',
    'vault-link',
  ]) {
    assert.match(TOUR, new RegExp(`data-tour="${anchor}"`), anchor)
  }
  assert.match(HOME, /tourAnchor="home-savings"/)
  assert.match(HOME, /data-tour="checkin"/)
  assert.match(HOME, /data-tour="vault-link"/)
  assert.match(NAV, /'nav-missions'/)
  assert.match(NAV, /'nav-battle'/)
  assert.match(NAV, /'nav-ranks'/)
  assert.match(NAV, /'nav-profile'/)
  assert.match(NAV, /'nav-home'/)
})

test('async anchors are watched, not measured once against a skeleton', () => {
  assert.match(TOUR, /MutationObserver/)
  assert.match(TOUR, /requestAnimationFrame/)
  assert.match(TOUR, /sameRect/)
  assert.match(TOUR, /Date\.now\(\) - startedAt > 2000/)
})

test('the card stays inside the app frame and the viewport', () => {
  assert.match(TOUR, /querySelector\('\.sv-frame'\)/)
  assert.match(PLACEMENT, /frame\.left \+ half/)
  assert.match(PLACEMENT, /frame\.right - half/)
})

test('replay and delete clear both tour flags', () => {
  assert.match(SETTINGS, /removeItem\(APP_TOUR_FLAG_KEY\)/)
  assert.match(SETTINGS, /removeItem\(TOUR_FLAG_KEY\)/)
  assert.match(SETTINGS, /router\.push\('\/'\)/)
  assert.match(DELETE, /removeItem\(APP_TOUR_FLAG_KEY\)/)
  assert.match(DELETE, /removeItem\(TOUR_FLAG_KEY\)/)
})

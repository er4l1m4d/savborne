import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const LOADER = source('../components/ui/LoadingState.tsx')
const CSS = source('../app/globals.css')

const PAGES = [
  '../app/(tabs)/page.tsx',
  '../app/(tabs)/profile/page.tsx',
  '../app/(tabs)/missions/page.tsx',
  '../app/(tabs)/leaderboard/page.tsx',
  '../app/(tabs)/vault/page.tsx',
  '../app/(tabs)/battle/page.tsx',
  '../app/items/page.tsx',
  '../app/receipts/page.tsx',
  '../app/battle/queue/page.tsx',
  '../app/battle/[id]/page.tsx',
  '../app/battle/[id]/result/page.tsx',
  '../app/battle/friend/[id]/page.tsx',
  '../app/bracket-climb/page.tsx',
  '../app/first-checkin/page.tsx',
  '../app/withdrawal/page.tsx',
  '../app/settings/page.tsx',
  '../app/settings/delete/page.tsx',
]

test('the loader is the brand, three pixel dots and one label', () => {
  assert.match(LOADER, /<BrandMark \/>/)
  assert.match(LOADER, /className="sv-loader" aria-hidden/)
  assert.match(LOADER, /role="status"/)
  assert.match(LOADER, /aria-live="polite"/)
  assert.match(LOADER, /Loading Savborne\.\.\./)
  assert.match(LOADER, /setTimeout\(\(\) => setVisible\(true\), 150\)/)
})

test('the dots are 8px mint and stop under reduced motion', () => {
  assert.match(CSS, /\.sv-loader span \{[^}]*width:\s*8px[^}]*background:\s*var\(--mint\)/s)
  assert.match(CSS, /\.sv-loader span:nth-child\(2\) \{ animation-delay: 0\.15s; \}/)
  assert.match(CSS, /\.sv-loader span:nth-child\(3\) \{ animation-delay: 0\.3s; \}/)
  const reduce = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduce, /\.sv-loader span \{ animation: none; \}/)
})

test('every data-loading screen uses the shared loader', () => {
  for (const rel of PAGES) {
    const src = source(rel)
    assert.match(src, /LoadingState/, rel)
    assert.match(src, /<LoadingState \/>/, rel)
    assert.doesNotMatch(src, /Loading…|Loading your |Loading missions|Loading items|Loading settings|Loading ranked|Loading battle|Loading result|Loading challenge/, rel)
  }
})

test('paired PixelPanels fill their grid row', () => {
  assert.match(CSS, /\.grid > \.pxw \{ height: 100%; \}/)
  assert.match(CSS, /\.grid > \.pxw > \.px \{ height: 100%; \}/)
})

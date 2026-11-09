import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const CSS = source('../app/globals.css')
const BRAND = JSON.parse(source('../../assets/brand.json')) as {
  logo: { viewBox: string; paths: string }
  wordmark: { viewBox: string; paths: string }
}
const GLYPHS = JSON.parse(source('../../assets/glyphs.json')) as Record<
  string,
  { viewBox: string; paths: string; source?: string }
>
const MARK = source('../components/BrandMark.tsx')
const STEPS = source('../components/ui/StepBars.tsx')

function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{`).exec(CSS)
  assert.ok(match, `${selector} is missing`)
  const open = match.index + match[0].length - 1
  const close = CSS.indexOf('}', open)
  return CSS.slice(open + 1, close)
}

test('the brand asset is the handoff logo and wordmark', () => {
  assert.equal(BRAND.logo.viewBox, '0 0 24 24')
  assert.equal(BRAND.wordmark.viewBox, '0 0 82 7')
  assert.match(BRAND.logo.paths, /fill="#0C3B35"/)
  assert.match(BRAND.logo.paths, /fill="#FF6A4D"/)
  assert.match(BRAND.wordmark.paths, /fill="#F6EFD9"/)
  assert.match(BRAND.wordmark.paths, /M80 5h2v2h-2z/)
})

test('BrandMark renders the 36px mark and the 164x14 wordmark', () => {
  assert.match(MARK, /import brand from '\.\.\/\.\.\/assets\/brand\.json'/)
  assert.match(MARK, /width=\{36\}/)
  assert.match(MARK, /width=\{164\}/)
  assert.match(MARK, /height=\{14\}/)
  assert.match(MARK, /aria-label="Savborne"/)
  assert.match(MARK, /aria-hidden/)
})

test('StepBars fills up to the current step and stays decorative', () => {
  assert.match(STEPS, /data-fill=\{index < current \? 'true' : 'false'\}/)
  assert.match(STEPS, /aria-hidden/)
  assert.match(STEPS, /Math\.max\(1, Math\.min\(safeTotal, step\)\)/)
})

test('the onboarding type roles use the handoff sizes', () => {
  assert.match(block('.sv-display-sm'), /font-size:\s*36px/)
  assert.match(block('.sv-display-sm'), /font-family:\s*var\(--font-silkscreen\)/)
  assert.match(block('.sv-heading-lg'), /font-size:\s*32px/)
  assert.match(block('.sv-heading-lg'), /font-family:\s*var\(--font-silkscreen\)/)
  assert.match(block('.sv-subheading-lg'), /font-size:\s*32px/)
  assert.match(block('.sv-subheading-lg'), /font-family:\s*var\(--font-jakarta\)/)
  assert.match(block('.sv-subheading-lg'), /letter-spacing:\s*-0\.02em/)
})

test('the name field is 56px of 18px text with a mint focus border', () => {
  const input = block('.sv-input')
  assert.match(input, /height:\s*56px/)
  assert.match(input, /font-size:\s*18px/)
  assert.match(input, /border:\s*2px solid var\(--bevel\)/)
  assert.match(CSS, /\.sv-input:focus-visible\s*\{[^}]*border-color:\s*var\(--mint\)/s)
})

test('the step bars are 8px and gap 6px', () => {
  assert.match(block('.sv-steps'), /display:\s*flex/)
  assert.match(block('.sv-steps'), /gap:\s*6px/)
  assert.match(block('.sv-steps > li'), /height:\s*8px/)
  assert.match(block(".sv-steps > li[data-fill='true']"), /background:\s*var\(--mint\)/)
})

test('the gate phone glyph is a 24x24 handoff drawing', () => {
  assert.ok(GLYPHS.phone, 'phone glyph is missing')
  assert.equal(GLYPHS.phone.viewBox, '0 0 24 24')
  assert.match(GLYPHS.phone.source ?? '', /Savborne-handoff A_Gate/)
  assert.match(GLYPHS.phone.paths, /fill="#6FD0AE"/)
  assert.match(GLYPHS.phone.paths, /fill="#F2735A"/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

function block(selector: string): string {
  // Match the selector at the start of a line so `.px` does not match `.pxw`.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{`).exec(CSS)
  assert.ok(match, `${selector} is missing`)
  const open = match.index + match[0].length - 1
  const close = CSS.indexOf('}', open)
  return CSS.slice(open + 1, close)
}

test('stepped panel geometry exists', () => {
  const pxw = block('.pxw')
  assert.match(pxw, /drop-shadow\(2px 0 0 var\(--o\)\)/)
  assert.match(pxw, /drop-shadow\(0 4px 0 var\(--s\)\)/)
  const px = block('.px')
  assert.match(px, /clip-path:\s*polygon\(/)
  assert.match(px, /3px 6px/)
  assert.match(px, /calc\(100% - 6px\)/)
})

test('.vpx survives for square controls and is marked deprecated for panels', () => {
  assert.match(block('.vpx'), /border:\s*2px solid var\(--bevel\)/)
  assert.match(CSS, /deprecated for panel containers/i)
})

test('the sv type scale meets the floor except sv-state', () => {
  const sizes: Record<string, number> = {
    '.sv-display': 44,
    '.sv-heading': 28,
    '.sv-subheading': 20,
    '.sv-body': 16,
    '.sv-label': 13,
    '.sv-figure': 13,
    '.sv-number-xl': 36,
    '.sv-number-m': 24,
    '.sv-section-label': 12,
    '.sv-state': 10,
  }
  for (const [selector, size] of Object.entries(sizes)) {
    assert.match(block(selector), new RegExp(`font-size:\\s*${size}px`), selector)
  }
  assert.match(block('.sv-break'), /overflow-wrap:\s*anywhere/)
})

test('the global focus ring is present', () => {
  assert.match(
    CSS,
    /:where\(a, button, input, textarea, select, \[tabindex\]\):focus-visible\s*\{[^}]*outline:\s*2px solid var\(--mint\)/s,
  )
  assert.match(CSS, /outline-offset:\s*2px/)
})

test('every motion class has a reduced-motion path', () => {
  for (const selector of ['.sv-press', '.sv-sheet', '.sv-dots', '.sv-shake', '.sv-pop']) {
    assert.match(CSS, new RegExp(selector.replace('.', '\\.')), selector)
  }
  // The file already has one reduced-motion block near the tokens; the
  // Foundation 2 block is the last one and is the one under test.
  const media = CSS.slice(CSS.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(media, /\.sv-sheet/)
  assert.match(media, /\.sv-dots span[^}]*animation:\s*none/)
  assert.match(media, /\.sv-shake/)
  assert.match(media, /\.sv-pop/)
  assert.match(media, /\.sv-press:active/)
  assert.match(media, /--t-dots/)
})

test('the shell body leaves inline room for the panel side outlines', () => {
  const body = block('.sv-shell__body')
  assert.match(body, /padding-inline:\s*4px/)
  assert.match(body, /margin-inline:\s*-4px/)
  assert.match(body, /overflow-y:\s*auto/)
})

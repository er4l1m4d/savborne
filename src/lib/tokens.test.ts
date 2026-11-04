/**
 * The palette swap is a value-only change, which is exactly why it needs a test:
 * every class name stays identical, so nothing in the component tree can fail to
 * compile when a token silently becomes unreadable.
 *
 * Two specific things are pinned here:
 *  - --fg-faint must NOT become #4B5A56. The handoff labels that colour
 *    "Disabled outline" and it measures 2.32:1 on --surface; adopting it for
 *    caption text would have shipped a WCAG failure that no build step catches.
 *  - every text token clears 4.5:1 on every surface, measured not assumed.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

function hexTokens(css: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    out[m[1]] = m[2].toUpperCase()
  }
  return out
}

const luminance = (hex: string) => {
  const c = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const T = hexTokens(CSS)

test('the palette adopts the handoff values', () => {
  assert.equal(T['--shell'], '#0C1211')
  assert.equal(T['--surface'], '#151F1D')
  assert.equal(T['--surface-low'], '#101A18')
  assert.equal(T['--sprite-well'], '#101A18')
  assert.equal(T['--line'], '#2E4642')
  assert.equal(T['--bevel'], '#C9C1A8')
  assert.equal(T['--fg'], '#F3EEDD')
  assert.equal(T['--fg-soft'], '#C9C1A8')
  assert.equal(T['--fg-muted'], '#A9B8B2')
  assert.equal(T['--mint'], '#6FD0AE')
  assert.equal(T['--mint-tint'], '#0C3B35')
  assert.equal(T['--coral-text'], '#FF9C86')
  assert.equal(T['--bevel-shadow'], '#2E4642')
})

test('tokens the handoff has and the app lacked are added', () => {
  assert.equal(T['--track'], '#243532')
  assert.equal(T['--cream'], '#F6EFD9')
  assert.equal(T['--ember'], '#FF6A4D')
  assert.equal(T['--coral-edge'], '#A8452F')
  assert.equal(T['--off'], '#4B5A56')
})

test('tokens with no handoff counterpart keep their values', () => {
  assert.equal(T['--surface-hi'], '#274438')
  assert.equal(T['--butter'], '#F2B544')
  assert.equal(T['--butter-text'], '#FFD37A')
  assert.equal(T['--butter-tint'], '#35280F')
  assert.equal(T['--entry'], '#D9C98A')
  assert.equal(T['--bronze'], '#E08A5B')
  assert.equal(T['--silver'], '#C9D3DC')
})

test('--fg-faint keeps a readable value rather than the handoff disabled-outline colour', () => {
  assert.equal(T['--fg-faint'], '#7A9187')
  assert.notEqual(T['--fg-faint'], '#4B5A56')
})

test('every text token clears 4.5:1 on every surface', () => {
  const surfaces = ['--shell', '--surface', '--surface-low']
  const textTokens = ['--fg', '--fg-soft', '--fg-muted', '--fg-faint', '--cream', '--mint', '--coral-text']
  for (const text of textTokens) {
    for (const surface of surfaces) {
      const ratio = contrast(T[text], T[surface])
      assert.ok(
        ratio >= 4.5,
        `${text} on ${surface} is ${ratio.toFixed(2)}:1, below 4.5:1`
      )
    }
  }
})

/** Extract the body of a CSS at-rule block by balancing braces. */
function block(css: string, header: string): string {
  const start = css.indexOf(header)
  if (start < 0) return ''
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  return ''
}

test('motion tokens are the art bible values', () => {
  assert.match(CSS, /--ease:\s*cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/)
  assert.match(CSS, /--t-press:\s*80ms/)
  assert.match(CSS, /--t-enter:\s*180ms/)
  assert.match(CSS, /--t-fill:\s*700ms/)
  assert.match(CSS, /--t-pop:\s*900ms/)
})

test('every motion duration is neutralised under prefers-reduced-motion', () => {
  const reduce = block(CSS, '@media (prefers-reduced-motion: reduce)')
  assert.notEqual(reduce, '', 'no prefers-reduced-motion block found')
  for (const token of ['--t-press', '--t-enter', '--t-fill', '--t-pop']) {
    assert.match(reduce, new RegExp(`${token}:\\s*0\\.01ms`), `${token} not neutralised`)
  }
})

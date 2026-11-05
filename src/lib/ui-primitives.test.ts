import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const ui = (name: string) => readFileSync(new URL(`../components/ui/${name}`, import.meta.url), 'utf8')

test('Button exposes the approved variants and press/loading states', () => {
  const src = ui('Button.tsx')
  for (const variant of ['primary', 'secondary', 'destructive', 'ghost', 'icon']) {
    assert.match(src, new RegExp(variant))
  }
  assert.match(src, /ButtonLink/)
  assert.match(src, /sv-dots/)
  assert.match(src, /sv-press/)
  assert.match(src, /loading\?: boolean/)
  assert.match(CSS, /\.sv-link\s*\{[^}]*min-height:\s*44px/)
  assert.match(CSS, /\.sv-btn--primary\s*\{[^}]*height:\s*64px/)
  assert.match(CSS, /\.sv-btn--move\s*\{[^}]*height:\s*84px/)
})

test('PixelPanel composes the stepped panel and tone variables', () => {
  const src = ui('PixelPanel.tsx')
  assert.match(src, /wrapperClassName\?:\s*string/)
  assert.match(src, /data-tone=\{tone\}/)
  assert.match(src, /className=\{`pxw/)
  assert.match(src, /className=\{`px sv-panel/)
  assert.match(CSS, /\.pxw\[data-tone='coral'\]\s*>\s*\.px/)
  assert.match(CSS, /\.pxw\[data-tone='off'\]\s*>\s*\.px/)
})

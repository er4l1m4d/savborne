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

test('ScreenShell owns the header, the scroll body and the back icon', () => {
  const src = ui('ScreenShell.tsx')
  assert.match(src, /variant\?:\s*'tab'\s*\|\s*'pushed'/)
  assert.match(src, /backHref\?:\s*string/)
  assert.match(src, /sv-shell__body/)
  assert.match(src, /ButtonLink/)
  assert.match(CSS, /\.sv-shell--tab\s*\{[^}]*100dvh/)
  assert.match(CSS, /\.sv-shell--pushed\s*\{[^}]*100dvh/)
  assert.match(CSS, /\.sv-shell__title\s*\{[^}]*min-width:\s*0/)
  assert.match(CSS, /\.sv-shell__title\s*\{[^}]*overflow-wrap:\s*anywhere/)
  assert.match(CSS, /\.sv-shell__body\s*\{[^}]*scroll-padding-top/)
  assert.match(CSS, /\.sv-shell__body\s*\{[^}]*scroll-padding-bottom/)
})

test('Chip is 24px high with outline and fill variants', () => {
  const src = ui('Chip.tsx')
  assert.match(src, /variant\?:\s*'outline'\s*\|\s*'fill'/)
  assert.match(src, /color\?:\s*string/)
  assert.match(CSS, /\.sv-chip\s*\{[^}]*height:\s*24px/)
  assert.match(CSS, /\.sv-chip--fill\s*\{[^}]*background:\s*var\(--mint\)/)
})

test('Row supports 56/58 heights and dividers', () => {
  const src = ui('Row.tsx')
  assert.match(src, /minHeight\?:\s*56\s*\|\s*58/)
  assert.match(src, /divider\?:\s*boolean/)
  assert.match(CSS, /\.sv-row\s*\{[^}]*min-height:\s*58px/)
  assert.match(CSS, /\.sv-row--56\s*\{[^}]*min-height:\s*56px/)
  assert.match(CSS, /\.sv-row--divider\s*\{[^}]*border-bottom:\s*2px solid var\(--track\)/)
})

test('Tabs is a controlled, accessible tablist', () => {
  const src = ui('Tabs.tsx')
  assert.match(src, /role="tablist"/)
  assert.match(src, /aria-selected/)
  assert.match(src, /ariaLabel/)
  assert.match(src, /onChange/)
  assert.match(CSS, /\.sv-tab\s*\{[^}]*height:\s*44px/)
  assert.match(CSS, /\.sv-tab\[aria-selected='true'\]/)
})

test('Banner has error and info tones', () => {
  const src = ui('Banner.tsx')
  assert.match(src, /tone\?:\s*'error'\s*\|\s*'info'/)
  assert.match(src, /role="alert"/)
  assert.match(CSS, /\.sv-banner--error\s*\{[^}]*background:\s*var\(--coral-tint\)/)
  assert.match(CSS, /\.sv-banner--info\s*\{[^}]*border-color:\s*var\(--mint\)/)
})

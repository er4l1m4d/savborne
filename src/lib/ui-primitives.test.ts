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
  assert.match(CSS, /\.sv-btn\s*\{[^}]*padding:\s*0 16px/)
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
  assert.match(src, /className="shrink-0"/)
  assert.match(CSS, /\.sv-shell--tab\s*\{[^}]*100dvh/)
  assert.match(CSS, /\.sv-shell--pushed\s*\{[^}]*100dvh/)
  assert.match(CSS, /\.sv-shell__title\s*\{[^}]*min-width:\s*0/)
  assert.match(CSS, /\.sv-shell__title\s*\{[^}]*overflow-wrap:\s*anywhere/)
  assert.match(CSS, /\.sv-shell__body:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--mint\)/)
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
  assert.match(src, /className\?:\s*string/)
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
  assert.match(CSS, /\.sv-banner\s*\{[^}]*display:\s*flex/)
  assert.match(CSS, /\.sv-banner\s*\{[^}]*flex-direction:\s*column/)
  assert.match(CSS, /\.sv-banner\s*\{[^}]*gap:\s*8px/)
  assert.match(CSS, /\.sv-banner\s*>\s*\.sv-btn\s*\{[^}]*margin-top:\s*8px/)
})

test('BottomSheet traps focus, closes on Escape and locks scroll', () => {
  const src = ui('BottomSheet.tsx')
  assert.match(src, /aria-modal="true"/)
  assert.match(src, /Escape/)
  assert.match(src, /document\.body\.style\.overflow\s*=\s*'hidden'/)
  assert.match(src, /focusable\.length === 0/)
  assert.match(src, /panel\.focus\(\)/)
  assert.match(src, /onCloseRef/)
  assert.match(src, /\}, \[open\]\)/)
  assert.match(CSS, /\.sv-scrim\s*\{[^}]*position:\s*fixed/)
  assert.match(CSS, /\.sv-sheet-panel\s*\{[^}]*max-height:\s*80dvh/)
})

test('ResultPanel renders a display headline, tiles and actions', () => {
  const src = ui('ResultPanel.tsx')
  assert.match(src, /tone:\s*'mint'\s*\|\s*'coral'\s*\|\s*'cream'/)
  assert.match(src, /tiles:\s*ResultTile\[\]/)
  assert.match(src, /header\?:\s*ReactNode/)
  assert.match(src, /unlocks\?/)
  assert.match(src, /titleAlign\?:\s*'left'\s*\|\s*'center'/)
  assert.match(src, /titleSize\?:\s*'display'\s*\|\s*'compact'/)
  assert.match(src, /sv-display/)
  assert.match(src, /fontSize: 36/)
  assert.match(src, /fontFamily: 'var\(--font-silkscreen\)'/)
  assert.match(src, /text-center text-balance/)
  assert.match(src, /vpx-soft/)
  assert.match(src, /sv-number-m/)
  assert.match(src, /tiles\.length === 2 \? 'grid-cols-2' : 'grid-cols-3'/)
  assert.match(src, /actions/)
})

test('Meter is a bevelled fill with an optional progressbar role', () => {
  const src = ui('Meter.tsx')
  assert.match(src, /value:\s*number/)
  assert.match(src, /max:\s*number/)
  assert.match(src, /type MeterTone = 'mint' \| 'coral' \| 'butter'/)
  assert.match(src, /tone = 'mint'/)
  assert.match(src, /role=\{label \? 'progressbar' : undefined\}/)
  assert.match(src, /aria-valuenow/)
  assert.match(src, /sv-meter/)
  assert.match(src, /sv-meter__fill/)
  assert.match(CSS, /\.sv-meter\s*\{[^}]*border:\s*2px solid var\(--bevel\)/)
  assert.match(CSS, /\.sv-meter__fill\s*\{[^}]*height:\s*100%/)
})

test('Button exposes the mode and item sizes', () => {
  const src = ui('Button.tsx')
  assert.match(src, /'mode'\s*\|\s*'item'/)
  assert.match(CSS, /\.sv-btn--mode\s*\{[^}]*min-height:\s*96px/)
  assert.match(CSS, /\.sv-btn--mode\s*\{[^}]*text-align:\s*left/)
  assert.match(CSS, /\.sv-btn--item\s*\{[^}]*min-height:\s*64px/)
})

test('BottomSheet can render a header action beside its title', () => {
  const src = ui('BottomSheet.tsx')
  assert.match(src, /headerAction\?:\s*ReactNode/)
  assert.match(src, /\{headerAction\}/)
})

test('ScreenShell accepts a custom back label', () => {
  const src = ui('ScreenShell.tsx')
  assert.match(src, /backLabel\?:\s*string/)
  assert.match(src, /aria-label=\{backLabel \?\? 'Back'\}/)
})

test('FilterBar is one 32px track with 44px pressed segments', () => {
  const src = ui('FilterBar.tsx')
  assert.match(src, /role="group"/)
  assert.match(src, /aria-pressed=\{value === option\.value\}/)
  assert.match(src, /sv-filterbar/)
  assert.match(CSS, /\.sv-filterbar\s*\{[^}]*height:\s*32px/)
  assert.match(CSS, /\.sv-filterbar\s*\{[^}]*border:\s*2px solid var\(--bevel\)/)
  assert.match(CSS, /\.sv-filterbar__btn\s*\{[^}]*height:\s*44px/)
  assert.match(CSS, /\.sv-filterbar__btn\s*\{[^}]*margin-block:\s*-8px/)
  assert.match(CSS, /\.sv-filterbar__seg\s*\{[^}]*height:\s*28px/)
  assert.match(
    CSS,
    /\.sv-filterbar__btn\[aria-pressed='true'\] \.sv-filterbar__seg\s*\{[^}]*background:\s*var\(--fg\)/,
  )
  assert.match(
    CSS,
    /\.sv-filterbar__btn\[aria-pressed='true'\] \.sv-filterbar__seg\s*\{[^}]*color:\s*var\(--shell\)/,
  )
  const pressed = CSS.slice(CSS.indexOf(".sv-filterbar__btn[aria-pressed='true']"))
  assert.doesNotMatch(pressed.slice(0, 220), /var\(--mint\)/)
})

test('Row has a mint-bordered You variant that bleeds through the panel padding', () => {
  const src = ui('Row.tsx')
  assert.match(src, /variant\?:\s*'default'\s*\|\s*'you'/)
  assert.match(src, /sv-row--you/)
  assert.match(CSS, /--you-surface:\s*#1B2E29/)
  assert.match(CSS, /\.sv-row--you\s*\{[^}]*min-height:\s*60px/)
  assert.match(CSS, /\.sv-row--you\s*\{[^}]*margin-block:\s*0 4px/)
  assert.match(CSS, /\.sv-row--you\s*\{[^}]*margin-inline:\s*-14px/)
  assert.match(CSS, /\.sv-row--you\s*\{[^}]*padding-inline:\s*14px/)
  assert.match(CSS, /\.sv-row--you\s*\{[^}]*border-top:\s*2px solid var\(--mint\)/)
  assert.match(CSS, /\.sv-row--you\s*\{[^}]*border-bottom:\s*2px solid var\(--mint\)/)
  assert.match(CSS, /\.sv-row--you\s*\{[^}]*background:\s*var\(--you-surface\)/)
})

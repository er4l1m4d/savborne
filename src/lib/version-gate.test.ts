import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const GATE = readFileSync(
  new URL('../components/VersionGate.tsx', import.meta.url),
  'utf8',
)

test('the gate keeps its three designed states', () => {
  assert.match(GATE, /phase: 'checking'/)
  assert.match(GATE, /phase: 'outside_nimiq'/)
  assert.match(GATE, /phase: 'update_required'/)
  assert.match(GATE, /isInsideNimiqPay\(\)/)
  assert.match(GATE, /isGetBalanceAvailable\(\)/)
})

test('Preparing is the brand mark and one line, with no spinner', () => {
  const checking = GATE.slice(
    GATE.indexOf("phase === 'checking'"),
    GATE.indexOf("phase === 'outside_nimiq'"),
  )
  assert.match(checking, /<BrandMark \/>/)
  assert.match(checking, /Preparing Savborne/)
  assert.doesNotMatch(checking, /sv-dots|animate-spin/)
})

const PREVIEW = readFileSync(
  new URL('../components/OutsideNimiqPay.tsx', import.meta.url),
  'utf8',
)

const OUTSIDE = GATE.slice(
  GATE.indexOf("phase === 'outside_nimiq'"),
  GATE.indexOf("phase === 'update_required'"),
)

test('the outside state hands off to the preview page', () => {
  assert.match(OUTSIDE, /<OutsideNimiqPay \/>/)
  // Still not the update screen's job: that one belongs to a wallet that
  // answered but is too old, and offering the site link here would be wrong.
  assert.doesNotMatch(OUTSIDE, /href="https:\/\/nimiq.com"/)
})

test('the preview page offers the deeplink, the video and the QR', () => {
  assert.match(PREVIEW, /nimiqpay:\/\/miniapp\?url=https:\/\/savborne\.vercel\.app/)
  assert.match(PREVIEW, /https:\/\/vimeo\.com\/user265760449\/savborne-demo-video/)
  assert.match(PREVIEW, /\/deeplink-qr\.png/)
  assert.match(PREVIEW, /href=\{DEEPLINK\}/)
})

test('the preview page claims nothing it cannot do', () => {
  // It renders outside the wallet, so it must not reach for the bridge: the
  // gate exists precisely because those calls are unavailable here.
  assert.doesNotMatch(PREVIEW, /from '@\/lib\/nimiq'/)
  assert.doesNotMatch(PREVIEW, /isInsideNimiqPay|isGetBalanceAvailable|sendBasicTransaction/)
  // And the custody claim the rest of the app makes has to survive on the one
  // page a browser-only visitor reads.
  assert.match(PREVIEW, /never holds your NIM/)
  assert.match(PREVIEW, /unrecoverable/)
  // The screenshots are the shipped screens with fixture data, and the page
  // says so rather than implying a live player.
  assert.match(PREVIEW, /sample data/)
})

test('Update Nimiq Pay offers the site link and a retry', () => {
  const update = GATE.slice(GATE.indexOf("phase === 'update_required'"))
  assert.match(update, /Update Nimiq Pay to continue/)
  assert.match(update, /href="https:\/\/nimiq.com"/)
  assert.match(update, /target="_blank"/)
  assert.match(update, /I&apos;ve updated, try again/)
  assert.match(update, /<Glyph name="update" size=\{72\} className="text-mint" \/>/)
  assert.match(update, /setAttempt\(\(n\) => n \+ 1\)/)
})

test('the gate has no Silkscreen header above the centred headline', () => {
  assert.doesNotMatch(GATE, /sv-number-m/)
  assert.doesNotMatch(GATE, /title="Open inside Nimiq Pay"/)
  assert.doesNotMatch(GATE, /title="Update Nimiq Pay"/)
})

test('a wallet error reason is a muted diagnostic line', () => {
  assert.match(GATE, /\{reason && <p className="sv-label text-fg-faint">\{reason\}<\/p>\}/)
})

test('the shared card route stays public', () => {
  assert.match(GATE, /const PUBLIC_PREFIXES = \['\/card\/'\]/)
  const prefix = GATE.indexOf('PUBLIC_PREFIXES.some')
  const checking = GATE.indexOf("phase === 'checking'")
  assert.ok(prefix >= 0 && prefix < checking, 'the card exemption must run first')
})

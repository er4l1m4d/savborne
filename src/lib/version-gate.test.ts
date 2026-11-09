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

test('the outside state has the phone panel and no CTA', () => {
  const outside = GATE.slice(
    GATE.indexOf("phase === 'outside_nimiq'"),
    GATE.indexOf("phase === 'update_required'"),
  )
  assert.match(outside, /<Glyph name="phone" size=\{72\} \/>/)
  assert.match(outside, /Savborne lives inside Nimiq Pay/)
  assert.doesNotMatch(outside, /<Button/)
  assert.doesNotMatch(outside, /href="https:\/\/nimiq.com"/)
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

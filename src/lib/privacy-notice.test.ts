import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PRIVACY_CARDS,
  PRIVACY_CONSENT_LINE,
  PRIVACY_NOTICE_VERSION,
  PRIVACY_RISK,
  PRIVACY_SHORT_VERSION,
} from './privacy'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const NOTICE = source('../components/PrivacyNotice.tsx')
const PAGE = source('../app/(onboarding)/privacy/page.tsx')

test('the notice version is a date and the four cards are stable', () => {
  assert.equal(PRIVACY_NOTICE_VERSION, '2026-11-09')
  assert.deepEqual(
    PRIVACY_CARDS.map((card) => card.title),
    ['What we collect', "What we don't", "What's public", "Where it's stored"],
  )
  assert.deepEqual(
    PRIVACY_CARDS.map((card) => card.tone),
    ['mint', 'coral', 'muted', 'muted'],
  )
})

test('the copy is vault-specific and says what is never collected', () => {
  assert.match(PRIVACY_SHORT_VERSION, /never holds, moves, or controls your money/)
  assert.match(PRIVACY_SHORT_VERSION, /24 words/)
  assert.match(PRIVACY_CONSENT_LINE, /vault address, balance snapshots and game data/)
  assert.match(PRIVACY_RISK, /unrecoverable/)
  const notCollected = PRIVACY_CARDS.find((card) => card.key === 'not-collect')
  assert.ok(notCollected)
  assert.match(notCollected.body, /24 words/)
  assert.match(notCollected.body, /passphrase/)
  assert.match(notCollected.body, /move or lock your funds/)
})

test('the compact copy has no mojibake arrow', () => {
  assert.doesNotMatch(NOTICE, /ΓåÆ/)
  assert.doesNotMatch(NOTICE, /â/)
})

test('the full variant renders the short version and four cards', () => {
  assert.match(NOTICE, /PRIVACY_CARDS\.slice\(0, 2\)/)
  assert.match(NOTICE, /PRIVACY_CARDS\.slice\(2\)/)
  assert.match(NOTICE, /The short version/)
  assert.match(NOTICE, /PRIVACY_NOTICE_VERSION/)
  assert.match(NOTICE, /<PixelPanel tone="mint"/)
})

test('the privacy page is step 2 and records the accepted version', () => {
  assert.match(PAGE, /<OnboardingScreen step=\{2\} backHref="\/connect">/)
  assert.match(PAGE, /acceptPrivacy\(PRIVACY_NOTICE_VERSION\)/)
  assert.match(PAGE, /router\.push\('\/name'\)/)
  assert.match(PAGE, /PRIVACY_CONSENT_LINE/)
  assert.match(PAGE, /router\.replace\('\/connect'\)/)
})

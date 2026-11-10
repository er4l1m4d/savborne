import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const VAULT = page('../app/(tabs)/vault/page.tsx')

test('Vault has no legacy panels', () => {
  assert.doesNotMatch(VAULT, /\.vpx|vpx-soft|\bvpx\b/)
})

test('Vault uses .sv-input for both amounts and the passphrase', () => {
  assert.equal((VAULT.match(/className="sv-input/g) ?? []).length, 2)
  assert.match(VAULT, /type="password"/)
  assert.match(VAULT, /sv-input/)
})

test('Vault section headings are the 20px sub-heading, not mint labels', () => {
  assert.match(VAULT, /<h2 className="sv-subheading">Recent movements<\/h2>/)
  assert.doesNotMatch(VAULT, /<h2[^>]*text-mint/)
})

test('Vault switches Deposit and Withdraw with Tabs, one form at a time', () => {
  assert.match(VAULT, /import \{ Tabs \} from '@\/components\/ui\/Tabs'/)
  assert.match(VAULT, /ariaLabel="Vault action"/)
  assert.match(VAULT, /value: 'deposit', label: 'Deposit'/)
  assert.match(VAULT, /value: 'withdraw', label: 'Withdraw'/)
  assert.match(VAULT, /\{tab === 'deposit' \? \(/)
  assert.match(VAULT, /setTab\('withdraw'\)/)
})

test('Vault opens Withdraw from an expired withdrawal link', () => {
  assert.match(VAULT, /direction === 'out'/)
  assert.match(VAULT, /setWithdrawNim\(amount\)\s*setTab\('withdraw'\)/s)
})

test('Vault movements are one grouped panel of Rows', () => {
  assert.match(VAULT, /import \{ Row \} from '@\/components\/ui\/Row'/)
  assert.match(VAULT, /<PixelPanel className="px-3\.5 py-0\.5">/)
  assert.match(VAULT, /<Row/)
})

test('Vault has one h1: the shell owns it', () => {
  assert.doesNotMatch(VAULT, /<h1/)
  assert.match(VAULT, /<h2 className="sv-subheading">No vault yet<\/h2>/)
})

test('Vault balance skeleton is static under reduced motion', () => {
  assert.match(VAULT, /animate-pulse motion-reduce:animate-none/)
})

test('Vault load error is friendly and recoverable', () => {
  assert.match(VAULT, /const LOAD_ERROR = "Couldn't load your vault\."/)
  assert.match(VAULT, /\{LOAD_ERROR\}/)
  assert.match(VAULT, /Try again in a moment\./)
  assert.doesNotMatch(VAULT, /\(\$\{res\.status\}\)/)
})

const RECEIPTS = page('../app/receipts/page.tsx')

test('Receipts has no legacy panels and keeps the transfer anatomy', () => {
  assert.doesNotMatch(RECEIPTS, /\.vpx|vpx-soft|\bvpx\b/)
  for (const text of ['Check again', 'Try again', 'explorerUrl', "'included'"]) {
    assert.match(RECEIPTS, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('Receipts snapshots are off-tone panels with no hash', () => {
  assert.match(RECEIPTS, /<PixelPanel[^>]*tone="off"/)
  const snapshot = RECEIPTS.slice(RECEIPTS.indexOf('function SnapshotRow'))
  assert.doesNotMatch(snapshot, /txHash|explorerUrl/)
})

test('Receipts load error is friendly, recoverable and redirects 401', () => {
  assert.match(RECEIPTS, /const LOAD_ERROR = "Couldn't load receipts\."/)
  assert.match(RECEIPTS, /res\.status === 401/)
  assert.match(RECEIPTS, /router\.replace\('\/setup'\)/)
  assert.match(RECEIPTS, /<Button[^>]*variant="secondary"[^>]*size="sm"[^>]*fullWidth=\{false\}/)
  assert.match(RECEIPTS, /Try again/)
  assert.doesNotMatch(RECEIPTS, /\(\$\{res\.status\}\)/)
})

const CARD = page('../app/card/[token]/page.tsx')
const CARDS = page('../lib/vault/cards.ts')

test('Card has no legacy panels and no ScreenShell', () => {
  assert.doesNotMatch(CARD, /\.vpx|vpx-soft|\bvpx\b/)
  assert.doesNotMatch(CARD, /ScreenShell/)
})

test('Card keeps the public contract and the nested off-tone box', () => {
  assert.match(CARD, /<PixelPanel tone="off"/)
  assert.equal((CARD.match(/tone="off"/g) ?? []).length, 2)
  assert.match(CARD, /notFound\(\)/)
  assert.doesNotMatch(CARD, /balanceLuna|balance_luna|walletAddress|playerAddress|player_wallet/)
  assert.match(CARD, /Balances are never public/)
})

test('getFlexCard still selects explicit columns only', () => {
  assert.match(CARDS, /select\('address, player_address, backup_verified_at'\)/)
  assert.match(CARDS, /select\('address, display_name, level, streak_current, bracket, shields'\)/)
  assert.doesNotMatch(CARDS, /\.select\('\*'\)/)
})

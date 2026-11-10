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
  for (const title of ['Deposit', 'Withdraw', 'Recent movements']) {
    assert.match(VAULT, new RegExp(`<h2 className="sv-subheading">${title}</h2>`))
  }
  assert.doesNotMatch(VAULT, /<h2[^>]*text-mint/)
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

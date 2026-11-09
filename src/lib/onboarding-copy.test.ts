import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BACKUP_RISK,
  PASSPHRASE_NOTE,
  VAULT_CAN,
  VAULT_CANNOT,
  VAULT_INTRO,
  VAULT_STEPS,
} from './onboarding-copy'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const CONNECT = source('../app/(onboarding)/connect/page.tsx')
const PHRASE = source('../components/vault/PhraseCeremony.tsx')
const PASSPHRASE = source('../components/vault/PassphraseField.tsx')

const sentences = (text: string) => (text.match(/\.(?:\s|$)/g) ?? []).length

test('the vault intro is one short paragraph and three steps', () => {
  assert.ok(VAULT_INTRO.length < 180)
  assert.equal(VAULT_STEPS.length, 3)
  assert.equal(VAULT_CAN, 'Read the vault balance')
  assert.equal(VAULT_CANNOT, 'Move, lock or spend your NIM')
})

test('the backup warning and passphrase note are two sentences', () => {
  assert.equal(sentences(BACKUP_RISK), 2)
  assert.equal(sentences(PASSPHRASE_NOTE), 2)
  assert.match(BACKUP_RISK, /only key/)
  assert.match(BACKUP_RISK, /cannot recover/)
})

test('the screens use the shared copy', () => {
  assert.match(CONNECT, /from '@\/lib\/onboarding-copy'/)
  assert.match(CONNECT, /\{VAULT_INTRO\}/)
  assert.match(CONNECT, /\{VAULT_STEPS\.map/)
  assert.match(CONNECT, /<details>/)
  assert.match(PHRASE, /import \{ BACKUP_RISK \} from '@\/lib\/onboarding-copy'/)
  assert.match(PHRASE, /\{BACKUP_RISK\}/)
  assert.match(PASSPHRASE, /import \{ PASSPHRASE_NOTE \} from '@\/lib\/onboarding-copy'/)
  assert.match(PASSPHRASE, /\{PASSPHRASE_NOTE\}/)
})

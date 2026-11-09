import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const PAGE = source('../app/settings/how-it-works/page.tsx')
const SETTINGS = source('../app/settings/page.tsx')

test('How Savborne works is a pushed reference reached from Settings Help', () => {
  assert.match(PAGE, /variant="pushed"/)
  assert.match(PAGE, /backHref="\/settings"/)
  assert.match(PAGE, /title="How Savborne works"/)
  assert.match(SETTINGS, /href="\/settings\/how-it-works"/)
  assert.match(SETTINGS, /How Savborne works/)
})

test('the page covers vault, backup, privacy and Nimiq Pay', () => {
  assert.match(PAGE, /Your vault/)
  assert.match(PAGE, /Backup and recovery/)
  assert.match(PAGE, /Privacy and data/)
  assert.match(PAGE, /Nimiq Pay/)
  assert.match(PAGE, /balance read fails/)
  assert.match(PAGE, /streak and\s+XP are safe/)
})

test('the reference uses the same copy as onboarding', () => {
  assert.match(PAGE, /from '@\/lib\/onboarding-copy'/)
  assert.match(PAGE, /\{VAULT_INTRO\}/)
  assert.match(PAGE, /\{VAULT_STEPS\.map/)
  assert.match(PAGE, /\{BACKUP_RISK\}/)
  assert.match(PAGE, /\{BACKUP_QUIZ_NOTE\}/)
  assert.match(PAGE, /\{PASSPHRASE_NOTE\}/)
  assert.match(PAGE, /\{PASSPHRASE_RESET_NOTE\}/)
  assert.match(PAGE, /<PrivacyNotice variant="full" \/>/)
})

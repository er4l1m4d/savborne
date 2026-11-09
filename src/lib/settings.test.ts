import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const SETUP = source('../app/setup/page.tsx')

test('Setup renders the shared privacy notice', () => {
  assert.match(SETUP, /from '@\/components\/PrivacyNotice'/)
  assert.match(SETUP, /<PrivacyNotice \/>/)
  assert.doesNotMatch(SETUP, /What we collect/)
})

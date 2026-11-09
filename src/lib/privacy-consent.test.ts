import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const SQL = source('../../supabase/FINAL-SCHEMA.sql')
const TYPES = source('./database.types.ts')
const ROUTE = source('../app/api/players/route.ts')
const ME = source('../app/api/players/me/route.ts')
const PROFILE = source('../app/api/profile/route.ts')
const BATTLE = source('../app/api/battles/[id]/route.ts')

test('players stores the consent timestamp and notice version', () => {
  assert.match(SQL, /privacy_consent_at\s+timestamptz,/)
  assert.match(SQL, /privacy_notice_version\s+text\n\);/)
  assert.match(SQL, /add column if not exists privacy_consent_at\s+timestamptz/)
  assert.match(SQL, /add column if not exists privacy_notice_version text/)
})

test('the RPC gains the notice version and drops the old signature', () => {
  assert.match(
    SQL,
    /drop function if exists create_player_with_vault\(text,text,text,text,text,boolean\);/,
  )
  assert.match(
    SQL,
    /drop function if exists create_player_with_vault\(text,text,text,text,text,boolean,text\);/,
  )
  assert.match(SQL, /p_privacy_notice_version text/)
  assert.match(SQL, /p_avatar\s+text/)
  assert.match(
    SQL,
    /grant execute on function create_player_with_vault\(text,text,text,text,text,boolean,text,text\) to service_role;/,
  )
})

test('consent is written atomically with the player row', () => {
  assert.match(SQL, /privacy_notice_version, privacy_consent_at/)
  assert.match(SQL, /case when p_privacy_notice_version is null then null else now\(\) end/)
})

test('the route validates and forwards the version', () => {
  assert.match(ROUTE, /privacyNoticeVersion\?: unknown/)
  assert.match(ROUTE, /Invalid privacy notice version/)
  assert.match(ROUTE, /privacyNoticeVersion\.trim\(\)\.length > 32/)
  assert.match(ROUTE, /p_privacy_notice_version:/)
  assert.match(ROUTE, /typeof privacyNoticeVersion === 'string' \? privacyNoticeVersion\.trim\(\) : null/)
})

test('the avatar column is bounded and defaults to Hero', () => {
  assert.match(SQL, /avatar\s+text not null default 'hero' check \(avatar in \('hero','heroine'\)\)/)
  assert.match(SQL, /add column if not exists avatar text not null default 'hero'/)
  assert.match(SQL, /players_avatar_check/)
})

test('the route forwards a validated avatar', () => {
  assert.match(ROUTE, /avatar\?: unknown/)
  assert.match(ROUTE, /Invalid avatar/)
  assert.match(ROUTE, /p_avatar: isAvatar\(avatar\) \? avatar : DEFAULT_AVATAR/)
})

test('the profile and battle readers return the avatar, and PATCH changes it', () => {
  assert.match(ME, /avatar: player\.avatar/)
  assert.match(ME, /export async function PATCH/)
  assert.match(ME, /\.update\(\{ avatar: body\.avatar \}\)/)
  assert.match(PROFILE, /avatar: player\.avatar/)
  assert.match(BATTLE, /avatar: viewerInfo\?\.avatar \?\? 'hero'/)
})

test('the database types mirror the new columns', () => {
  assert.match(TYPES, /privacy_consent_at: string \| null/)
  assert.match(TYPES, /privacy_notice_version: string \| null/)
  assert.match(TYPES, /avatar: Avatar/)
})

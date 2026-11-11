/**
 * Check-in integrity release gate - SQL contract.
 *
 * These assertions do not execute Postgres. They pin the single file the user
 * pastes, so a later edit cannot quietly remove the unique day, the derived
 * count, the atomic commit or the rate limit. The live five-POST and
 * concurrency checks are deployment steps.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SQL = readFileSync(
  new URL('../../supabase/FINAL-SCHEMA.sql', import.meta.url),
  'utf8',
)
const QUEUE = readFileSync(
  new URL('../app/api/queue/join/route.ts', import.meta.url),
  'utf8',
)

test('check-ins carry a generated UTC day and one row per player per day', () => {
  assert.match(
    SQL,
    /add column if not exists utc_date date\s+generated always as \(\(\(recorded_at at time zone 'utc'\)\)::date\) stored/i,
  )
  assert.match(
    SQL,
    /create unique index if not exists check_ins_player_day_uidx\s+on check_ins \(player_address, utc_date\)/i,
  )
})

test('players.check_in_count is rebuilt from distinct days, not POST count', () => {
  assert.match(
    SQL,
    /update players p\s+set check_in_count = coalesce\(\s*\(select count\(\*\) from check_ins c\s+where c\.player_address = p\.address and c\.claimed_at is not null\),\s*0\s*\)/i,
  )
  assert.doesNotMatch(SQL, /check_in_count\s*=\s*check_in_count\s*\+\s*1/i)
})

test('the commit inserts with ON CONFLICT DO NOTHING and returns claimed=false', () => {
  assert.match(
    SQL,
    /insert into check_ins[^;]*on conflict \(player_address, utc_date\) do nothing/is,
  )
  assert.match(SQL, /if v_inserted_id is null then[\s\S]*?'claimed', false/is)
  assert.match(
    SQL,
    /select count\(\*\) into v_count\s+from check_ins\s+where player_address = p_address and claimed_at is not null/i,
  )
  assert.match(SQL, /check_in_count = v_count/)
})

test('the commit owns the player, rewards and badge writes in one function', () => {
  for (const table of ['players', 'daily_xp', 'player_missions', 'player_items', 'player_badges']) {
    assert.match(SQL, new RegExp(`(insert into|update) ${table}`, 'i'))
  }
  assert.match(SQL, /grant execute on function commit_check_in\([\s\S]*?\) to service_role/i)
  assert.match(SQL, /revoke execute on function commit_check_in\([\s\S]*?\) from anon, authenticated/i)
})

test('the endpoint rate limit is a service-role fixed window', () => {
  assert.match(SQL, /create table if not exists api_rate_limits/i)
  assert.match(SQL, /create or replace function consume_rate_limit/i)
  assert.match(SQL, /make_interval\(secs => p_window_seconds\)/i)
  assert.match(SQL, /'allowed', v_count <= p_limit/i)
  assert.match(SQL, /grant execute on function consume_rate_limit\(text, int, int\) to service_role/i)
  assert.match(
    SQL,
    /revoke execute on function consume_rate_limit\(text, int, int\)\s+from anon, authenticated/i,
  )
})

test('the ranked gate reads the derived check-in count', () => {
  assert.match(QUEUE, /p\.level < RANKED\.minLevel/)
  assert.match(QUEUE, /p\.check_in_count < RANKED\.minCheckIns/)
})

// ─── Standing freshness (2026-11-11) ────────────────────────────────────────

test('readings carry source, claim time and the bracket at read time', () => {
  for (const column of ['source', 'claimed_at', 'bracket']) {
    assert.match(SQL, new RegExp(`alter table check_ins add column if not exists ${column}`, 'i'))
  }
  assert.match(SQL, /source\s+text not null default 'player'/i)
  assert.match(SQL, /set claimed_at = recorded_at\s+where source = 'player' and claimed_at is null/i)
})

test('a cron reading never unlocks ranked and never awards the ritual', () => {
  assert.match(SQL, /create or replace function record_reading\(/i)
  const body = SQL.slice(SQL.indexOf('create or replace function record_reading('))
  assert.match(body, /values \(p_address, p_balance_luna, p_recorded_at, 'cron'/i)
  assert.doesNotMatch(body, /daily_xp/i)
  assert.doesNotMatch(body, /player_missions/i)
  assert.doesNotMatch(body, /streak_current/i)
  assert.doesNotMatch(body, /check_in_count/i)
})

test('a snapshot can revoke the crown and withdrawal badges', () => {
  const body = SQL.slice(SQL.indexOf('create or replace function record_reading('))
  assert.match(body, /badge_key = 'golden_crown'/i)
  assert.match(body, /badge_key in \('week_warrior', 'iron_saver'\)/i)
})

test('commit_check_in claims an existing cron row exactly once', () => {
  const body = SQL.slice(
    SQL.indexOf('create or replace function commit_check_in('),
    SQL.indexOf('grant execute on function commit_check_in('),
  )
  assert.match(body, /update check_ins[\s\S]*?set claimed_at = p_recorded_at/i)
  assert.match(body, /and claimed_at is null/i)
  assert.match(body, /returning id into v_inserted_id/i)
})

test('the leaderboard bracket comes from the latest reading, not players.bracket', () => {
  const body = SQL.slice(SQL.indexOf('create or replace function leaderboard_stats()'))
  assert.match(body, /select ci\.bracket::bracket_name\s+from check_ins ci/i)
  assert.match(body, /order by ci\.recorded_at desc/i)
  assert.match(body, /and ci\.claimed_at is not null/i)
})

test('record_reading is service-role only', () => {
  assert.match(
    SQL,
    /revoke execute on function record_reading\(text, bigint, timestamptz, text\)\s+from anon, authenticated/i,
  )
  assert.match(
    SQL,
    /grant execute on function record_reading\(text, bigint, timestamptz, text\)\s+to service_role/i,
  )
})

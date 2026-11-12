/**
 * Schema version contract - one version, two places.
 *
 * The SQL file records the schema version in `schema_meta` and the app compares
 * it with `EXPECTED_SCHEMA_VERSION` from GET /api/health. If those two drift,
 * health would either fail forever (app ahead) or pass against an old database
 * (SQL ahead) - both defeats the point. This test pins them together, and pins
 * the marker's own shape so a schema edit cannot forget the bump.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { EXPECTED_SCHEMA_VERSION } from '@/lib/schema'

const SQL = readFileSync(
  new URL('../../supabase/FINAL-SCHEMA.sql', import.meta.url),
  'utf8',
)

test('the SQL marker and the app expect the same schema version', () => {
  const inserted = SQL.match(
    /insert into schema_meta \(id, version\)\s+values \('singleton', '([^']+)'\)/i,
  )
  assert.ok(inserted, 'schema_meta insert is missing from FINAL-SCHEMA.sql')
  assert.equal(inserted[1], EXPECTED_SCHEMA_VERSION)
})

test('the version contract is idempotent and service-role only', () => {
  assert.match(SQL, /create table if not exists schema_meta/i)
  assert.match(SQL, /on conflict \(id\) do update\s+set version = excluded\.version/i)
  assert.match(SQL, /alter table schema_meta\s+enable row level security/i)
  assert.match(SQL, /create or replace function schema_version\(\)/i)
  assert.match(SQL, /create or replace function schema_health\(\)/i)
  assert.match(SQL, /revoke all on schema_meta from public, anon, authenticated/i)
  assert.match(SQL, /revoke execute on function schema_health\(\) from anon, authenticated/i)
  assert.match(SQL, /grant execute on function schema_health\(\) to service_role/i)
})
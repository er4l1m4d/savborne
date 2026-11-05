/**
 * Account deletion is destructive and irreversible, so the things that can
 * silently go wrong are pinned here:
 *
 *  - The gate that decides how a player proves they can still reach their vault.
 *    A player with a local vault unlocks with the passphrase; one whose vault is
 *    registered server-side but not stored on this device must type all 24
 *    words; one with no vault at all has nothing to protect.
 *  - The migration's delete order. `battles.player_a`, `battles.player_b`,
 *    `battle_moves.player_address` and `queue.battle_id` are the player
 *    references without a cascading delete, so deleting `players` or `battles`
 *    first fails at runtime with a foreign-key error no TypeScript check sees.
 *  - FINAL-SCHEMA.sql is the file that gets pasted, so it must carry the same
 *    function and the repair that clears stale matched queue rows.
 *  - The route must verify the wallet signature before it runs the RPC.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { deletionGate } from './account-deletion'

const MIGRATION = readFileSync(
  new URL('../../supabase/migrations/20261104000000_delete_player.sql', import.meta.url),
  'utf8'
)
const FINAL_SCHEMA = readFileSync(
  new URL('../../supabase/FINAL-SCHEMA.sql', import.meta.url),
  'utf8'
)
const ROUTE = readFileSync(
  new URL('../app/api/players/me/route.ts', import.meta.url),
  'utf8'
)

test('a local vault unlocks with the passphrase', () => {
  assert.equal(deletionGate(true, true), 'unlock')
  assert.equal(deletionGate(true, false), 'unlock')
})

test('a server vault with no local copy must be proven by typing the words', () => {
  assert.equal(deletionGate(false, true), 'type-words')
})

test('no vault anywhere means there is nothing to protect', () => {
  assert.equal(deletionGate(false, false), 'confirm')
})

test('the migration clears queue rows before the battles they reference', () => {
  const queue = MIGRATION.indexOf('delete from queue')
  const battles = MIGRATION.indexOf('delete from battles')

  assert.ok(queue >= 0, 'no delete from queue')
  assert.ok(queue < battles, 'queue rows reference battles(id) without a cascade')

  // Both the player's own row and the opponent's matched row must go: leaving
  // the opponent's row pointing at a battle we delete fails the FK.
  assert.match(MIGRATION, /player_address = p_address/)
  assert.match(MIGRATION, /battle_id in \(\s*select id from battles/i)
  assert.match(MIGRATION, /player_a = p_address or player_b = p_address/)
})

test('the migration deletes moves, then battles, then the player', () => {
  const moves = MIGRATION.indexOf('delete from battle_moves')
  const battles = MIGRATION.indexOf('delete from battles')
  const players = MIGRATION.indexOf('delete from players')

  assert.ok(moves >= 0, 'no delete from battle_moves')
  assert.ok(battles >= 0, 'no delete from battles')
  assert.ok(players >= 0, 'no delete from players')
  assert.ok(moves < battles, 'battle_moves must be deleted before battles')
  assert.ok(battles < players, 'battles must be deleted before players')
})

test('the migration is privileged and executable only by the server', () => {
  assert.match(MIGRATION, /security definer/i)
  assert.match(MIGRATION, /revoke all on function delete_player\(text\) from public/i)
  assert.match(MIGRATION, /revoke execute on function delete_player\(text\) from anon, authenticated/i)
  assert.match(MIGRATION, /grant execute on function delete_player\(text\) to service_role/i)
})

test('the delete RPC only ever targets the address it is given', () => {
  assert.match(MIGRATION, /where player_address = p_address/i)
  assert.match(MIGRATION, /player_a = p_address or player_b = p_address/i)
  assert.match(MIGRATION, /from players where address = p_address/i)
})

test('FINAL-SCHEMA carries the same delete function, not just the migration', () => {
  // README calls FINAL-SCHEMA "the file you run"; a paste that lacks the
  // function makes DELETE 500 with "function does not exist".
  assert.match(FINAL_SCHEMA, /create or replace function delete_player\(p_address text\)/i)
  assert.match(FINAL_SCHEMA, /revoke execute on function delete_player\(text\) from anon, authenticated/i)
  assert.match(FINAL_SCHEMA, /grant execute on function delete_player\(text\) to service_role/i)

  const queue = FINAL_SCHEMA.indexOf('delete from queue q')
  const battles = FINAL_SCHEMA.indexOf('delete from battles')
  assert.ok(queue >= 0, 'no queue cleanup in FINAL-SCHEMA')
  assert.ok(queue < battles, 'queue must be cleared before battles in FINAL-SCHEMA')
})

test('FINAL-SCHEMA repairs matched queue rows left behind by finished battles', () => {
  // Those rows can never be consumed by match_me (it only pairs 'waiting'), so
  // without a repair they persist forever and block account deletion.
  assert.match(FINAL_SCHEMA, /delete from queue q[\s\S]*?using battles b/i)
  assert.match(FINAL_SCHEMA, /b\.status in \('completed', 'abandoned'\)/i)
})

test('the player endpoint verifies the delete proof before the RPC', () => {
  assert.match(ROUTE, /export async function DELETE/)
  assert.match(ROUTE, /verifyDeleteSignature/)
  assert.match(ROUTE, /rpc\('delete_player'/)

  const verify = ROUTE.indexOf('verifyDeleteSignature')
  const rpc = ROUTE.indexOf("rpc('delete_player'")
  assert.ok(verify >= 0 && rpc >= 0 && verify < rpc, 'the RPC must run only after verification')
})

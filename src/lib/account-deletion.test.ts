/**
 * Account deletion is destructive and irreversible, so the things that can
 * silently go wrong are pinned here:
 *
 *  - The gate that decides how a player proves they can still reach their vault.
 *    A player with a local vault unlocks with the passphrase; one whose vault is
 *    registered server-side but not stored on this device must type all 24
 *    words; one with no vault at all has nothing to protect.
 *  - The schema's delete order. `battles.player_a`, `battles.player_b`,
 *    `battle_moves.player_address` and `queue.battle_id` are the player
 *    references without a cascading delete, so deleting `players` or `battles`
 *    first fails at runtime with a foreign-key error no TypeScript check sees.
 *  - FINAL-SCHEMA.sql is the file that gets pasted, so it must carry the
 *    function and the repair that clears stale matched queue rows.
 *  - The route must verify the wallet signature before it runs the RPC.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { deletionGate } from './account-deletion'

const SCHEMA = readFileSync(
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

test('the delete function clears queue rows before the battles they reference', () => {
  const queue = SCHEMA.indexOf('delete from queue')
  const battles = SCHEMA.indexOf('delete from battles')

  assert.ok(queue >= 0, 'no delete from queue')
  assert.ok(queue < battles, 'queue rows reference battles(id) without a cascade')

  // Both the player's own row and the opponent's matched row must go: leaving
  // the opponent's row pointing at a battle we delete fails the FK.
  assert.match(SCHEMA, /player_address = p_address/)
  assert.match(SCHEMA, /battle_id in \(\s*select id from battles/i)
  assert.match(SCHEMA, /player_a = p_address or player_b = p_address/)
})

test('the delete function deletes moves, then battles, then the player', () => {
  const moves = SCHEMA.indexOf('delete from battle_moves')
  const battles = SCHEMA.indexOf('delete from battles')
  const players = SCHEMA.indexOf('delete from players')

  assert.ok(moves >= 0, 'no delete from battle_moves')
  assert.ok(battles >= 0, 'no delete from battles')
  assert.ok(players >= 0, 'no delete from players')
  assert.ok(moves < battles, 'battle_moves must be deleted before battles')
  assert.ok(battles < players, 'battles must be deleted before players')
})

test('the delete function is privileged and executable only by the server', () => {
  assert.match(SCHEMA, /security definer/i)
  assert.match(SCHEMA, /revoke all on function delete_player\(text\) from public/i)
  assert.match(SCHEMA, /revoke execute on function delete_player\(text\) from anon, authenticated/i)
  assert.match(SCHEMA, /grant execute on function delete_player\(text\) to service_role/i)
})

test('the delete RPC only ever targets the address it is given', () => {
  assert.match(SCHEMA, /where player_address = p_address/i)
  assert.match(SCHEMA, /player_a = p_address or player_b = p_address/i)
  assert.match(SCHEMA, /from players where address = p_address/i)
})

test('the delete function is in the file that gets pasted', () => {
  assert.match(SCHEMA, /create or replace function delete_player\(p_address text\)/i)
  assert.match(SCHEMA, /revoke execute on function delete_player\(text\) from anon, authenticated/i)
  assert.match(SCHEMA, /grant execute on function delete_player\(text\) to service_role/i)

  const queue = SCHEMA.indexOf('delete from queue q')
  const battles = SCHEMA.indexOf('delete from battles')
  assert.ok(queue >= 0, 'no queue cleanup in FINAL-SCHEMA')
  assert.ok(queue < battles, 'queue must be cleared before battles in FINAL-SCHEMA')
})

test('the schema repairs matched queue rows left behind by finished battles', () => {
  // Those rows can never be consumed by match_me (it only pairs 'waiting'), so
  // without a repair they persist forever and block account deletion.
  assert.match(SCHEMA, /delete from queue q[\s\S]*?using battles b/i)
  assert.match(SCHEMA, /b\.status in \('completed', 'abandoned'\)/i)
})

test('the player endpoint verifies the delete proof before the RPC', () => {
  assert.match(ROUTE, /export async function DELETE/)
  assert.match(ROUTE, /verifyDeleteSignature/)
  assert.match(ROUTE, /rpc\('delete_player'/)

  const verify = ROUTE.indexOf('verifyDeleteSignature')
  const rpc = ROUTE.indexOf("rpc('delete_player'")
  assert.ok(verify >= 0 && rpc >= 0 && verify < rpc, 'the RPC must run only after verification')
})

test('vaults, readings and transfers cascade from the deleted player row', () => {
  // `delete_player` removes the players row last. These FKs are what remove
  // the vault mapping (and therefore the public card token), every reading and
  // every receipt in the same statement.
  for (const table of ['vaults', 'check_ins', 'transfers']) {
    const start = SCHEMA.indexOf(`create table if not exists ${table} (`)
    assert.ok(start >= 0, `no ${table} table`)
    const body = SCHEMA.slice(start, SCHEMA.indexOf(');', start))
    assert.match(body, /references players\(address\) on delete cascade/i, `${table} must cascade`)
  }
})

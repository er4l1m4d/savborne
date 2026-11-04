/**
 * Account deletion is destructive and irreversible, so the two things that can
 * silently go wrong are pinned here:
 *
 *  - The gate that decides how a player proves they can still reach their vault.
 *    A player with a local vault unlocks with the passphrase; one whose vault is
 *    registered server-side but not stored on this device must type all 24
 *    words; one with no vault at all has nothing to protect.
 *  - The migration's delete order. `battles.player_a` and
 *    `battle_moves.player_address` are the only player references without
 *    `on delete cascade`, so deleting `players` first fails at runtime with a
 *    foreign-key error that no TypeScript check can catch.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { deletionGate } from './account-deletion'

const MIGRATION = readFileSync(
  new URL('../../supabase/migrations/20261104000000_delete_player.sql', import.meta.url),
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
  assert.match(MIGRATION, /grant execute on function delete_player\(text\) to service_role/i)
})

test('the delete RPC only ever targets the address it is given', () => {
  assert.match(MIGRATION, /where player_address = p_address/i)
  assert.match(MIGRATION, /player_a = p_address or player_b = p_address/i)
  assert.match(MIGRATION, /from players where address = p_address/i)
})

test('the player endpoint exposes DELETE', () => {
  assert.match(ROUTE, /export async function DELETE/)
  assert.match(ROUTE, /rpc\('delete_player'/)
})

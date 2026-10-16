-- ═════════════════════════════════════════════════════════════════════════════
-- Savborne — RLS hardening retrofit
--
-- Run this ONLY if you already applied the original
-- 20261015000000_init.sql (before the hardening fix). It converges an
-- already-created database to the same final security posture as the updated
-- init file. Every statement is idempotent (IF EXISTS guards / re-creates),
-- so running it even after the updated init is harmless.
--
-- What it changes:
--   1. Drops the forgeable header-based read policies and the blanket
--      players_public_read. anon/authenticated now get ZERO access to
--      personal tables; all reads go through the API routes (service_role).
--   2. Enables RLS on the catalog tables (missions, items, badges) with
--      read-only policies — previously they were writable by the anon key.
--   3. Revokes direct REST execution of match_me from anon/authenticated.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Remove legacy policies (all IF EXISTS → safe on a fresh DB).
drop policy if exists "players_public_read" on players;
drop policy if exists "own_check_ins" on check_ins;
drop policy if exists "own_player_missions" on player_missions;
drop policy if exists "own_player_items" on player_items;
drop policy if exists "own_player_badges" on player_badges;
drop policy if exists "own_battles" on battles;
drop policy if exists "own_battle_moves" on battle_moves;
drop policy if exists "own_queue" on queue;
drop policy if exists "own_daily_battles" on daily_battles;
drop policy if exists "own_daily_xp" on daily_xp;

-- 2. Catalog tables: RLS on, read-only for browser roles.
alter table missions enable row level security;
alter table items    enable row level security;
alter table badges   enable row level security;

drop policy if exists "catalog_read_missions" on missions;
create policy "catalog_read_missions" on missions
  for select to anon, authenticated using (true);

drop policy if exists "catalog_read_items" on items;
create policy "catalog_read_items" on items
  for select to anon, authenticated using (true);

drop policy if exists "catalog_read_badges" on badges;
create policy "catalog_read_badges" on badges
  for select to anon, authenticated using (true);

-- 3. match_me: service_role only (API routes drive matchmaking).
revoke all on function match_me(text) from public;
revoke execute on function match_me(text) from anon, authenticated;
grant execute on function match_me(text) to service_role;

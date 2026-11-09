-- ═════════════════════════════════════════════════════════════════════════════
-- SAVBORNE — COMPLETE DATABASE (single file, fully idempotent)
--
-- THIS IS THE ONLY FILE YOU PASTE. Run it in Dashboard → SQL Editor as many
-- times as needed on any state of this project's database: fresh, partially
-- applied, or already applied. Every statement is safe to re-run:
--   • types/tables/indexes are created only if missing
--   • catalog seeds are re-asserted (ON CONFLICT DO UPDATE)
--   • policies are dropped-then-created
--   • the RPC is CREATE OR REPLACE, with an old signature dropped first
--   • grants are idempotent by nature
--
-- Whenever the schema changes, edit this file and re-paste it. This is the only
-- SQL file in the repo. The old timestamped migrations were removed on
-- 2026-11-09; git history still has them. There is no `supabase db push` path
-- on this machine because the pooler connection drops.
--
-- Postgres 15+ / Supabase. Owner role: postgres. App access path: service-role
-- client via API routes ONLY (see RLS notes below).
-- ═════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── Enums (create-if-missing via exception trap) ───────────────────────────
do $$ begin create type bracket_name as enum ('entry','bronze','silver','gold'); exception when duplicate_object then null; end $$;
do $$ begin create type mission_type   as enum ('daily','weekly','onetime');    exception when duplicate_object then null; end $$;
do $$ begin create type battle_mode    as enum ('ranked','unranked','ai');      exception when duplicate_object then null; end $$;
do $$ begin create type battle_status  as enum ('pending','active','completed','abandoned'); exception when duplicate_object then null; end $$;
do $$ begin create type queue_status   as enum ('waiting','matched','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type move_type      as enum ('attack','defend','special','item'); exception when duplicate_object then null; end $$;

-- ─── Tables ──────────────────────────────────────────────────────────────────
create table if not exists players (
  address                 text primary key,
  savings_account_address text not null,
  display_name            text not null check (char_length(display_name) between 1 and 32),
  avatar                  text not null default 'hero' check (avatar in ('hero','heroine')),
  created_at              timestamptz not null default now(),
  last_check_in_at        timestamptz,
  level                   int not null default 1,
  xp                      int not null default 0,
  rating                  int not null default 1000,
  bracket                 bracket_name,
  current_balance_luna    bigint not null default 0,
  streak_current          int not null default 0,
  streak_best             int not null default 0,
  grace_used_this_week    boolean not null default false,
  week_started_at         timestamptz,
  check_in_count          int not null default 0,
  wins                    int not null default 0,
  losses                  int not null default 0,
  ties                    int not null default 0,
  withdrawal_in_progress  boolean not null default false,
  last_withdrawal_at      timestamptz,
  steady_hand_started_at  timestamptz default now(),
  shields                 int not null default 1,
  shields_earned          int not null default 0,
  privacy_consent_at      timestamptz,
  privacy_notice_version  text
);

create table if not exists check_ins (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  balance_luna   bigint not null,
  recorded_at    timestamptz not null default now(),
  utc_date       date generated always as (((recorded_at at time zone 'utc'))::date) stored
);

create table if not exists missions (
  id               int generated always as identity primary key,
  key              text unique not null,
  name             text not null,
  description      text not null,
  type             mission_type not null,
  xp_reward        int not null,
  bracket_required bracket_name
);

create table if not exists player_missions (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  mission_key    text not null references missions(key),
  completed_at   timestamptz not null default now(),
  reset_at       timestamptz
);

create table if not exists items (
  id           int generated always as identity primary key,
  key          text unique not null,
  name         text not null,
  description  text not null,
  bracket      bracket_name not null,
  effect_type  text not null,
  effect_value numeric not null default 0,
  is_badge     boolean not null default false
);

create table if not exists player_items (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  item_key       text not null references items(key),
  unlocked_at    timestamptz not null default now(),
  unique (player_address, item_key)
);

create table if not exists badges (
  id                      text primary key,
  name                    text not null,
  description             text not null,
  revoked_on_withdrawal   boolean not null default false
);

create table if not exists player_badges (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  badge_key      text not null references badges(id),
  awarded_at     timestamptz not null default now(),
  revoked_at     timestamptz
);

-- player_b nullable = friend challenges exist as 'pending' before acceptance.
-- Written inline for fresh DBs; ALTER covers databases created before that.
create table if not exists battles (
  id            uuid primary key default gen_random_uuid(),
  mode          battle_mode not null,
  status        battle_status not null default 'pending',
  player_a      text not null references players(address),
  player_b      text references players(address),
  current_turn  int not null default 0,
  turn_deadline timestamptz,
  player_a_hp   int not null default 100,
  player_b_hp   int not null default 100,
  winner        text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  check (player_a <> player_b),
  check (current_turn between 0 and 5)
);
alter table battles alter column player_b drop not null;

create table if not exists battle_moves (
  id              bigint generated always as identity primary key,
  battle_id       uuid not null references battles(id) on delete cascade,
  player_address  text not null references players(address),
  turn_number     int not null,
  move_type       move_type not null,
  item_key        text references items(key),
  resolved_damage int not null default 0,
  created_at      timestamptz not null default now(),
  unique (battle_id, player_address, turn_number)
);

create table if not exists queue (
  player_address text primary key references players(address) on delete cascade,
  bracket        bracket_name not null,
  rating         int not null,
  entered_at     timestamptz not null default now(),
  last_poll_at   timestamptz not null default now(),
  status         queue_status not null default 'waiting',
  battle_id      uuid references battles(id)
);

create table if not exists daily_battles (
  player_address text not null references players(address) on delete cascade,
  utc_date       date not null,
  count          int not null default 0,
  primary key (player_address, utc_date)
);

create table if not exists daily_xp (
  player_address text not null references players(address) on delete cascade,
  utc_date       date not null,
  xp_earned      int not null default 0,
  primary key (player_address, utc_date)
);

-- Fixed-window endpoint rate limits. Service-role only; no browser policies.
create table if not exists api_rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);

-- ─── Vault and savings loop (additive, spec §5) ─────────────────────────────
-- The vault address is derived on the player's device from a 24-word phrase.
-- The server stores the mapping only: it never holds a key and never signs.
-- UNIQUE(player_address) makes a second vault, or a claim on someone else's,
-- structurally impossible.
create table if not exists vaults (
  address            text primary key,
  player_address     text not null unique
                       references players(address) on delete cascade,
  network            text not null check (network in ('mainnet','testnet')),
  card_token         text unique not null,
  backup_verified_at timestamptz,
  created_at         timestamptz not null default now()
);

-- A claimed transfer is only credited after the server verifies it on chain.
-- tx_hash is unique so a retried POST records the movement exactly once.
create table if not exists transfers (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  vault_address  text not null references vaults(address),
  direction      text not null check (direction in ('in','out')),
  amount_luna    bigint not null check (amount_luna > 0),
  fee_luna       bigint not null default 0,
  tx_hash        text unique not null,
  status         text not null default 'pending'
                   check (status in ('pending','included','expired')),
  block_height   int,
  failure_reason text,
  created_at     timestamptz not null default now(),
  confirmed_at   timestamptz
);

create index if not exists transfers_player_idx
  on transfers (player_address, created_at desc);

-- Streak shields replace the deprecated weekly grace (spec §7). The ALTER makes
-- this file safe on a database created before the vault build.
alter table players add column if not exists shields        int not null default 1;
alter table players add column if not exists shields_earned int not null default 0;

-- Privacy consent is recorded with the player row. The version is the notice
-- string the onboarding client accepted; the timestamp is server time at the
-- moment the row is created.
alter table players add column if not exists privacy_consent_at     timestamptz;
alter table players add column if not exists privacy_notice_version text;

-- The chosen Hero/Heroine drawing. Existing rows default to Hero.
alter table players add column if not exists avatar text not null default 'hero';
do $$ begin
  alter table players add constraint players_avatar_check check (avatar in ('hero','heroine'));
exception when duplicate_object then null; end $$;

-- ─── Check-in integrity (release gate) ─────────────────────────────────────
-- Ranked requires five check-ins. One reading per player per UTC day is the
-- rule; the counter is derived from those days, never from POST count.
-- Existing duplicates are collapsed to the earliest row before the unique
-- index is added. Every statement is safe to re-run.
delete from check_ins a
using check_ins b
where a.player_address = b.player_address
  and (a.recorded_at at time zone 'utc')::date
    = (b.recorded_at at time zone 'utc')::date
  and a.id > b.id;

alter table check_ins
  add column if not exists utc_date date
  generated always as (((recorded_at at time zone 'utc'))::date) stored;

create unique index if not exists check_ins_player_day_uidx
  on check_ins (player_address, utc_date);

update players p
set check_in_count = coalesce(
  (select count(*) from check_ins c where c.player_address = p.address),
  0
);

revoke all on api_rate_limits from public, anon, authenticated;
grant all on api_rate_limits to service_role;

-- One-time mission for the first settled vault deposit (spec §6.2).
insert into missions (key, name, description, type, xp_reward, bracket_required)
values ('first_deposit', 'Vault Opened', 'Make your first deposit into your vault.',
        'onetime', 20, null)
on conflict (key) do nothing;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists players_savings_account_idx on players (savings_account_address);
create index if not exists players_rating_idx          on players (rating desc);
create index if not exists players_level_idx           on players (level desc);
create index if not exists check_ins_player_time_idx   on check_ins (player_address, recorded_at desc);
create index if not exists player_missions_reset_idx   on player_missions (player_address, reset_at);
create unique index if not exists player_missions_once_per_key
  on player_missions (player_address, mission_key)
  where reset_at is null;
create unique index if not exists player_badges_active_idx
  on player_badges (player_address, badge_key)
  where revoked_at is null;
create index if not exists battles_open_idx on battles (status, turn_deadline)
  where status in ('pending', 'active');
create index if not exists battles_player_a_idx on battles (player_a, created_at desc);
create index if not exists battles_player_b_idx on battles (player_b, created_at desc);
create index if not exists battles_player_open_idx on battles (player_a, status)
  where status in ('pending', 'active');
create index if not exists battles_player_b_open_idx on battles (player_b, status)
  where status in ('pending', 'active') and player_b is not null;
create index if not exists queue_waiting_idx on queue (bracket, rating, entered_at)
  where status = 'waiting';

-- ─── Catalog seeds (re-asserted on every run) ───────────────────────────────
insert into missions (key, name, description, type, xp_reward, bracket_required) values
  ('first_steps',       'First Steps',       'Connect your savings account and record your first check-in', 'onetime', 20, null),
  ('rising_tide',       'Rising Tide',       'Balance increases between two check-ins (any amount)',           'onetime', 30, null),
  ('first_blood',       'First Blood',       'Win one battle against another player',                          'onetime', 30, null),
  ('tactician',         'Tactician',         'Use both Defend and a Special Move in a single battle',          'onetime', 25, null),
  ('bracket_climb',     'Bracket Climb',     'Reach the Bronze bracket (3 NIM)',                               'onetime', 50, 'bronze'),
  ('daily_check_in',    'Daily Check-in',    'Check in today',                                                 'daily',   10, null),
  ('quick_duel',        'Quick Duel',        'Start one battle today',                                         'daily',   15, null),
  ('weekly_check_in',   'Weekly Check-in',   'Record a check-in this week',                                    'weekly',  25, null),
  ('steady_saver',      'Steady Saver',      'Balance held or grew at every check-in this week',               'weekly',  35, null),
  ('weekly_strategist', 'Weekly Strategist', 'Win two battles this week',                                      'weekly',  40, null)
on conflict (key) do update
  set name = excluded.name, description = excluded.description,
      type = excluded.type, xp_reward = excluded.xp_reward,
      bracket_required = excluded.bracket_required;

insert into items (key, name, description, bracket, effect_type, effect_value, is_badge) values
  ('cloth_purse',    'Cloth Purse',    'Defend gets +1 for the battle',              'entry',  'defend_flat_bonus',     1,    false),
  ('ledger_scroll',  'Ledger Scroll',  '+5% XP from check-ins',                      'entry',  'checkin_xp_multiplier', 0.05, false),
  ('bronze_shield',  'Bronze Shield',  'Defend blocks 25% more damage',              'bronze', 'defend_percent',        0.25, false),
  ('copper_compass', 'Copper Compass', 'See opponent''s last move before choosing',  'bronze', 'reveal_last_move',      1,    false),
  ('silver_blade',   'Silver Blade',   '+10% Attack damage',                         'silver', 'attack_percent',        0.10, false),
  ('silver_charm',   'Silver Charm',   'Special Move cooldown one turn shorter',     'silver', 'special_cooldown',      1,    false),
  ('gold_gauntlet',  'Gold Gauntlet',  '+20% Special Move damage',                   'gold',   'special_percent',       0.20, false),
  ('golden_crown',   'Golden Crown',   'Status badge on profile and leaderboard',    'gold',   'status_badge',          1,    true)
on conflict (key) do update
  set name = excluded.name, description = excluded.description,
      bracket = excluded.bracket, effect_type = excluded.effect_type,
      effect_value = excluded.effect_value, is_badge = excluded.is_badge;

insert into badges (id, name, description, revoked_on_withdrawal) values
  ('first_steps',  'First Steps',  'First check-in',                      false),
  ('week_warrior', 'Week Warrior', 'One-week streak',                      true),
  ('iron_saver',   'Iron Saver',   'Four-week streak through 11 November', true),
  ('steady_hand',  'Steady Hand',  'No withdrawals for 30 UTC days',       false),
  ('first_blade',  'First Blade',  'First battle win',                     false),
  ('golden_crown', 'Golden Crown', 'Gold bracket status',                  false)
on conflict (id) do update
  set name = excluded.name, description = excluded.description,
      revoked_on_withdrawal = excluded.revoked_on_withdrawal;

-- The Savborne AI opponent (spec 11): a real players row so battles.player_b
-- can reference it. It never authenticates and its rating never changes.
insert into players (address, savings_account_address, display_name, level, xp, rating)
values ('ai-savborne', 'ai-savborne', 'Savborne AI', 1, 0, 0)
on conflict (address) do nothing;

-- ─── Row-Level Security ────────────────────────────────────────────────────
-- Posture: browser roles (anon, authenticated) can READ the three static
-- catalog tables and NOTHING else. All personal data flows through the
-- Next.js API routes using the service-role client (BYPASSRLS), which
-- validates the X-Player-Address header server-side.
-- Accepted v1 limitation: the header is self-declared — impersonation
-- through the API is possible; impact is game state only (no custody).
-- Closes with sign() challenge / device identifier (Phase 6 stretch).

alter table players         enable row level security;
alter table check_ins       enable row level security;
alter table missions        enable row level security;
alter table player_missions enable row level security;
alter table items           enable row level security;
alter table player_items    enable row level security;
alter table badges          enable row level security;
alter table player_badges   enable row level security;
alter table battles         enable row level security;
alter table battle_moves    enable row level security;
alter table queue           enable row level security;
alter table daily_battles   enable row level security;
alter table daily_xp        enable row level security;
alter table api_rate_limits enable row level security;
alter table vaults          enable row level security;
alter table transfers       enable row level security;

-- Drop every policy this file owns (legacy + current), then recreate current.
drop policy if exists "players_public_read"    on players;
drop policy if exists "own_check_ins"          on check_ins;
drop policy if exists "own_player_missions"    on player_missions;
drop policy if exists "own_player_items"       on player_items;
drop policy if exists "own_player_badges"      on player_badges;
drop policy if exists "own_battles"            on battles;
drop policy if exists "own_battle_moves"       on battle_moves;
drop policy if exists "own_queue"              on queue;
drop policy if exists "own_daily_battles"      on daily_battles;
drop policy if exists "own_daily_xp"           on daily_xp;
drop policy if exists "catalog_read_missions"  on missions;
drop policy if exists "catalog_read_items"     on items;
drop policy if exists "catalog_read_badges"    on badges;

create policy "catalog_read_missions" on missions
  for select to anon, authenticated using (true);
create policy "catalog_read_items" on items
  for select to anon, authenticated using (true);
create policy "catalog_read_badges" on badges
  for select to anon, authenticated using (true);

-- ─── Matchmaking function (spec Section 16.3) ──────────────────────────────
-- Atomically pair two waiting players. Bracket is re-checked at match time,
-- rating range widens with wait, FOR UPDATE SKIP LOCKED prevents double
-- pairing, stale (>30 s no poll) entries are cleaned on each pass.
create or replace function match_me(me_address text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me_row           queue%rowtype;
  wait_seconds     int;
  rating_range     int;
  candidate        queue%rowtype;
  new_battle_id    uuid;
  current_bracket  bracket_name;
begin
  -- 0. Sweep abandoned entries on EVERY call (spec 16.3 step 4: "deleted on
  --    next poll"). Cannot live only on the match path — with no candidate,
  --    abandoned rows would otherwise persist forever.
  delete from queue
    where status = 'waiting'
      and last_poll_at < now() - interval '30 seconds';

  select * into me_row from queue
    where player_address = me_address and status = 'waiting'
    for update;

  if not found then
    return null;
  end if;

  select bracket into current_bracket from players where address = me_address;
  if current_bracket is null then
    update queue set status = 'cancelled' where player_address = me_address;
    return null;
  end if;
  if current_bracket <> me_row.bracket then
    update queue set bracket = current_bracket where player_address = me_address;
    me_row.bracket := current_bracket;
  end if;

  wait_seconds := extract(epoch from (now() - me_row.entered_at))::int;
  rating_range := case
    when wait_seconds < 60  then 150
    when wait_seconds < 120 then 300
    when wait_seconds < 180 then 450
    else 600
  end;

  select * into candidate from queue q
    where q.status = 'waiting'
      and q.player_address <> me_address
      and q.bracket = me_row.bracket
      and abs(q.rating - me_row.rating) <= rating_range
      and q.last_poll_at > now() - interval '30 seconds'
    order by q.entered_at asc
    limit 1
    for update skip locked;

  if not found then
    update queue set last_poll_at = now() where player_address = me_address;
    return null;
  end if;

  insert into battles (mode, status, player_a, player_b, current_turn)
    values ('ranked', 'pending', me_address, candidate.player_address, 0)
    returning id into new_battle_id;

  update queue set status = 'matched', battle_id = new_battle_id
    where player_address in (me_address, candidate.player_address);

  return new_battle_id;
end;
$$;

revoke all on function match_me(text) from public;
revoke execute on function match_me(text) from anon, authenticated;
grant execute on function match_me(text) to service_role;

-- ─── Role privileges (THE MISSING PIECE on SQL-editor-created projects) ─────
-- The app's ONLY database path is the service-role client. Give it explicit
-- privileges; tables created via the SQL editor as `postgres` do not always
-- receive Supabase's default grants to the API roles (ERRORS.md 2026-10-16).
-- anon/authenticated receive NOTHING beyond the catalog policies above.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- ─── Leaderboard aggregation (Phase 5) ─────────────────────────────────────────────
-- One row per human player with everything both boards sort on.
-- growth_luna = current balance − the FIRST-ever check-in balance (spec 4.5
-- "balance growth between check-ins", net since joining). Normalisation to
-- 0–100 happens in the API route (it needs the whole cohort's max).
-- A function's return type cannot be changed by CREATE OR REPLACE, so the drop
-- is required for an already-applied database to gain the has_vault column.
drop function if exists leaderboard_stats();

create or replace function leaderboard_stats()
returns table (
  player_address  text,
  display_name    text,
  level           int,
  bracket         bracket_name,
  rating          int,
  wins            int,
  losses          int,
  ties            int,
  streak_current  int,
  streak_best     int,
  growth_luna     bigint,
  has_vault       boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.address,
    p.display_name,
    p.level,
    p.bracket,
    p.rating,
    p.wins,
    p.losses,
    p.ties,
    p.streak_current,
    p.streak_best,
    p.current_balance_luna - coalesce(
      (select ci.balance_luna
         from check_ins ci
        where ci.player_address = p.address
        order by ci.recorded_at asc
        limit 1),
      p.current_balance_luna
    ) as growth_luna,
    (v.address is not null) as has_vault
  from players p
  left join vaults v on v.player_address = p.address
  where p.address <> 'ai-savborne'
$$;

revoke all on function leaderboard_stats() from public;
grant execute on function leaderboard_stats() to service_role;

-- ─── Player + vault creation (atomic onboarding) ────────────────────────────
-- The Supabase JS client cannot span two inserts in one transaction, so
-- onboarding goes through one security-definer function. Any raised exception
-- rolls back the player insert too: a player and their vault exist together or
-- not at all. Both error paths use 23505 so the route can distinguish them by
-- message, not by inspecting Postgres internals.
--
-- The signature gained p_privacy_notice_version. An argument-list change is a
-- new overload for CREATE OR REPLACE, so drop the old signature first; re-running
-- this file is still safe.
drop function if exists create_player_with_vault(text,text,text,text,text,boolean);
drop function if exists create_player_with_vault(text,text,text,text,text,boolean,text);

create or replace function create_player_with_vault(
  p_address               text,
  p_display_name          text,
  p_vault_address         text,
  p_network               text,
  p_card_token            text,
  p_backup_verified       boolean,
  p_privacy_notice_version text,
  p_avatar                text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_existed boolean;
  v_player  players%rowtype;
  v_vault   vaults%rowtype;
begin
  select exists(select 1 from players p where p.address = p_address) into v_existed;

  insert into players (
    address, savings_account_address, display_name, avatar, current_balance_luna,
    privacy_notice_version, privacy_consent_at
  )
  values (
    p_address, p_vault_address, p_display_name, coalesce(p_avatar, 'hero'), 0,
    p_privacy_notice_version,
    case when p_privacy_notice_version is null then null else now() end
  )
  on conflict (address) do nothing;

  select * into v_player from players where address = p_address;

  if exists (select 1 from vaults v
              where v.player_address = p_address and v.address <> p_vault_address) then
    raise exception 'vault_exists' using errcode = '23505';
  end if;

  insert into vaults (address, player_address, network, card_token, backup_verified_at)
  values (p_vault_address, p_address, p_network, p_card_token,
          case when p_backup_verified then now() else null end)
  on conflict (address) do nothing;

  select * into v_vault
    from vaults v
   where v.address = p_vault_address and v.player_address = p_address;

  if v_vault.address is null then
    raise exception 'vault_taken' using errcode = '23505';
  end if;

  return jsonb_build_object(
    'player', to_jsonb(v_player),
    'vault',  to_jsonb(v_vault),
    'created', not v_existed
  );
end;
$$;

revoke all on function create_player_with_vault(text,text,text,text,text,boolean,text,text) from public;
grant execute on function create_player_with_vault(text,text,text,text,text,boolean,text,text) to service_role;

-- ─── Account deletion ────────────────────────────────────────────────────────
-- Deleting a profile does not touch the on-chain vault; the 24-word phrase
-- still controls it. The API route verifies a wallet signature before calling
-- this, so execute belongs to service_role only.
--
-- Order matters. `battles.player_a`, `battles.player_b`,
-- `battle_moves.player_address` and `queue.battle_id` do not cascade. Queue
-- rows are cleared first: both the player's own row and any matched row,
-- including the opponent's, that references a battle about to be removed.
create or replace function delete_player(p_address text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battles integer;
  v_players integer;
begin
  delete from queue q
   where q.player_address = p_address
      or q.battle_id in (
           select id from battles
            where player_a = p_address or player_b = p_address
         );

  delete from battle_moves
   where player_address = p_address;

  delete from battles
   where player_a = p_address or player_b = p_address;
  get diagnostics v_battles = row_count;

  delete from players where address = p_address;
  get diagnostics v_players = row_count;

  return jsonb_build_object(
    'deleted', v_players > 0,
    'battles', v_battles
  );
end;
$$;

revoke all on function delete_player(text) from public;
revoke execute on function delete_player(text) from anon, authenticated;
grant execute on function delete_player(text) to service_role;

-- One-time repair: a `matched` queue row whose battle has already finished or
-- been abandoned can never be consumed by match_me (it only pairs `waiting`),
-- so it would otherwise sit there forever and keep blocking account deletion.
-- Safe to re-run: the condition is never true for a fresh row.
delete from queue q
 using battles b
 where q.battle_id = b.id
   and b.status in ('completed', 'abandoned');

-- ─── Check-in RPCs (release gate) ────────────────────────────────────────
-- consume_rate_limit runs before any expensive work. commit_check_in writes
-- the reading, the player row and every reward in ONE transaction; a
-- duplicate UTC day returns claimed=false before anything else is written.

create or replace function consume_rate_limit(
  p_key          text,
  p_limit        int,
  p_window_seconds int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_start timestamptz;
  v_now   timestamptz := now();
begin
  insert into api_rate_limits (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case
          when api_rate_limits.window_start
               <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else api_rate_limits.count + 1
        end,
        window_start = case
          when api_rate_limits.window_start
               <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else api_rate_limits.window_start
        end
  returning count, window_start into v_count, v_start;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(0, p_limit - v_count),
    'retryAfterSeconds', greatest(
      0,
      ceil(extract(epoch from (
        v_start + make_interval(secs => p_window_seconds) - v_now
      )))::int
    )
  );
end;
$$;

revoke all on function consume_rate_limit(text, int, int) from public;
revoke execute on function consume_rate_limit(text, int, int)
  from anon, authenticated;
grant execute on function consume_rate_limit(text, int, int) to service_role;

-- 6. One transaction for the reading, the player row and every reward.
--    A duplicate day returns claimed=false before writing anything else.
create or replace function commit_check_in(
  p_address       text,
  p_balance_luna  bigint,
  p_recorded_at   timestamptz,
  p_player        jsonb,
  p_daily_xp      int,
  p_missions      jsonb,
  p_items         jsonb,
  p_badges        jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_id bigint;
  v_count       int;
  v_mission     jsonb;
  v_item        jsonb;
  v_badge       jsonb;
begin
  insert into check_ins (player_address, balance_luna, recorded_at)
  values (p_address, p_balance_luna, p_recorded_at)
  on conflict (player_address, utc_date) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select check_in_count into v_count
      from players where address = p_address;
    return jsonb_build_object(
      'claimed', false,
      'check_in_count', coalesce(v_count, 0)
    );
  end if;

  -- The unique index makes count(*) the number of distinct UTC days.
  select count(*) into v_count
    from check_ins where player_address = p_address;

  update players set
    current_balance_luna = case
      when p_player ? 'current_balance_luna'
        then (p_player->>'current_balance_luna')::bigint
      else current_balance_luna end,
    last_check_in_at = case
      when p_player ? 'last_check_in_at'
        then (p_player->>'last_check_in_at')::timestamptz
      else last_check_in_at end,
    check_in_count = v_count,
    xp = case
      when p_player ? 'xp' then (p_player->>'xp')::int else xp end,
    level = case
      when p_player ? 'level' then (p_player->>'level')::int else level end,
    streak_current = case
      when p_player ? 'streak_current'
        then (p_player->>'streak_current')::int
      else streak_current end,
    streak_best = case
      when p_player ? 'streak_best'
        then (p_player->>'streak_best')::int
      else streak_best end,
    shields = case
      when p_player ? 'shields' then (p_player->>'shields')::int else shields end,
    shields_earned = case
      when p_player ? 'shields_earned'
        then (p_player->>'shields_earned')::int
      else shields_earned end,
    bracket = case
      when p_player ? 'bracket'
        then nullif(p_player->>'bracket', '')::bracket_name
      else bracket end,
    withdrawal_in_progress = case
      when p_player ? 'withdrawal_in_progress'
        then (p_player->>'withdrawal_in_progress')::boolean
      else withdrawal_in_progress end,
    last_withdrawal_at = case
      when p_player ? 'last_withdrawal_at'
        then (p_player->>'last_withdrawal_at')::timestamptz
      else last_withdrawal_at end,
    steady_hand_started_at = case
      when p_player ? 'steady_hand_started_at'
        then (p_player->>'steady_hand_started_at')::timestamptz
      else steady_hand_started_at end
  where address = p_address;

  if p_daily_xp > 0 then
    insert into daily_xp (player_address, utc_date, xp_earned)
    values (
      p_address,
      (p_recorded_at at time zone 'utc')::date,
      p_daily_xp
    )
    on conflict (player_address, utc_date) do update
      set xp_earned = daily_xp.xp_earned + excluded.xp_earned;
  end if;

  for v_mission in
    select * from jsonb_array_elements(coalesce(p_missions, '[]'::jsonb))
  loop
    insert into player_missions (
      player_address, mission_key, completed_at, reset_at
    ) values (
      p_address,
      v_mission->>'mission_key',
      coalesce((v_mission->>'completed_at')::timestamptz, p_recorded_at),
      nullif(v_mission->>'reset_at', '')::timestamptz
    );
  end loop;

  for v_item in
    select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into player_items (player_address, item_key, unlocked_at)
    values (
      p_address,
      v_item->>'item_key',
      coalesce((v_item->>'unlocked_at')::timestamptz, p_recorded_at)
    )
    on conflict (player_address, item_key) do nothing;
  end loop;

  for v_badge in
    select * from jsonb_array_elements(coalesce(p_badges, '[]'::jsonb))
  loop
    if v_badge->>'action' = 'award' then
      insert into player_badges (
        player_address, badge_key, awarded_at, revoked_at
      ) values (
        p_address,
        v_badge->>'badge_key',
        coalesce((v_badge->>'at')::timestamptz, p_recorded_at),
        null
      )
      on conflict (player_address, badge_key) where revoked_at is null
        do nothing;
    elsif v_badge->>'action' = 'revoke' then
      update player_badges
        set revoked_at = coalesce(
          (v_badge->>'at')::timestamptz, p_recorded_at
        )
        where player_address = p_address
          and badge_key = v_badge->>'badge_key'
          and revoked_at is null;
    end if;
  end loop;

  return jsonb_build_object('claimed', true, 'check_in_count', v_count);
end;
$$;

revoke all on function commit_check_in(
  text, bigint, timestamptz, jsonb, int, jsonb, jsonb, jsonb
) from public;
revoke execute on function commit_check_in(
  text, bigint, timestamptz, jsonb, int, jsonb, jsonb, jsonb
) from anon, authenticated;
grant execute on function commit_check_in(
  text, bigint, timestamptz, jsonb, int, jsonb, jsonb, jsonb
) to service_role;

-- ─── Verification (optional — paste separately, expect 11|8|6|≥1|16|3|true) ─
-- select (select count(*) from missions) as missions,
--        (select count(*) from items) as items,
--        (select count(*) from badges) as badges,
--        (select count(*) from players) as players,
--        (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
--           where n.nspname='public' and c.relkind='r' and c.relrowsecurity) as rls_tables,
--        (select count(*) from pg_policies where schemaname='public') as policies,
--        (select exists(select 1 from pg_proc where proname='match_me')) as match_me;

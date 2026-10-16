-- ═════════════════════════════════════════════════════════════════════════════
-- SAVBORNE — COMPLETE DATABASE (single file, fully idempotent)
--
-- THIS IS THE ONLY FILE YOU PASTE. Run it in Dashboard → SQL Editor as many
-- times as needed on any state of this project's database: fresh, partially
-- applied, or already applied. Every statement is safe to re-run:
--   • types/tables/indexes are created only if missing
--   • catalog seeds are re-asserted (ON CONFLICT DO UPDATE)
--   • policies are dropped-then-created
--   • the function is CREATE OR REPLACE
--   • grants are idempotent by nature
--
-- Whenever the schema changes, the agent REGENERATES this file and you re-paste
-- it. Individual timestamped migrations in supabase/migrations/ remain the
-- historical record for `supabase db push` on other platforms.
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
  steady_hand_started_at  timestamptz default now()
);

create table if not exists check_ins (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  balance_luna   bigint not null,
  recorded_at    timestamptz not null default now()
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

  delete from queue
    where status = 'waiting'
      and last_poll_at < now() - interval '30 seconds';

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

-- ─── Verification (optional — paste separately, expect 10|8|6|≥1|13|3|true) ─
-- select (select count(*) from missions) as missions,
--        (select count(*) from items) as items,
--        (select count(*) from badges) as badges,
--        (select count(*) from players) as players,
--        (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
--           where n.nspname='public' and c.relkind='r' and c.relrowsecurity) as rls_tables,
--        (select count(*) from pg_policies where schemaname='public') as policies,
--        (select exists(select 1 from pg_proc where proname='match_me')) as match_me;

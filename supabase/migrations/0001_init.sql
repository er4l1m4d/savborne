-- ═════════════════════════════════════════════════════════════════════════════
-- Savborne — Initial schema (Phase 1.3)
--
-- Apply this to a fresh Supabase project (or via `supabase db push`).
-- All money is stored as Luna (1 NIM = 100,000 Luna). getBalance returns Luna.
-- Identity is the Nimiq address; there is no Supabase Auth linkage.
-- ═════════════════════════════════════════════════════════════════════════════

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type bracket_name as enum ('entry', 'bronze', 'silver', 'gold');
create type mission_type as enum ('daily', 'weekly', 'onetime');
create type battle_mode as enum ('ranked', 'unranked', 'ai');
create type battle_status as enum ('pending', 'active', 'completed', 'abandoned');
create type queue_status as enum ('waiting', 'matched', 'cancelled');
create type move_type as enum ('attack', 'defend', 'special', 'item');

-- ─── Players ───────────────────────────────────────────────────────────────
create table players (
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

create index players_savings_account_idx on players (savings_account_address);
create index players_rating_idx on players (rating desc);
create index players_level_idx on players (level desc);

-- ─── Check-ins ─────────────────────────────────────────────────────────────
create table check_ins (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  balance_luna   bigint not null,
  recorded_at    timestamptz not null default now()
);

create index check_ins_player_time_idx on check_ins (player_address, recorded_at desc);

-- ─── Missions (definitions) ────────────────────────────────────────────────
create table missions (
  id              int generated always as identity primary key,
  key             text unique not null,
  name            text not null,
  description     text not null,
  type            mission_type not null,
  xp_reward       int not null,
  bracket_required bracket_name
);

-- Seed the eight missions from spec Section 6.
insert into missions (key, name, description, type, xp_reward, bracket_required) values
  ('first_steps',        'First Steps',        'Connect your savings account and record your first check-in', 'onetime', 20, null),
  ('rising_tide',        'Rising Tide',        'Balance increases between two check-ins (any amount)',           'onetime', 30, null),
  ('first_blood',        'First Blood',        'Win one battle against another player',                          'onetime', 30, null),
  ('tactician',          'Tactician',          'Use both Defend and a Special Move in a single battle',          'onetime', 25, null),
  ('bracket_climb',      'Bracket Climb',      'Reach the Bronze bracket (3 NIM)',                               'onetime', 50, 'bronze'),
  ('daily_check_in',     'Daily Check-in',     'Check in today',                                                 'daily',   10, null),
  ('quick_duel',         'Quick Duel',         'Start one battle today',                                         'daily',   15, null),
  ('weekly_check_in',    'Weekly Check-in',    'Record a check-in this week',                                    'weekly',  25, null),
  ('steady_saver',       'Steady Saver',       'Balance held or grew at every check-in this week',               'weekly',  35, null),
  ('weekly_strategist',  'Weekly Strategist',  'Win two battles this week',                                      'weekly',  40, null);

-- ─── Player missions (completion record) ───────────────────────────────────
create table player_missions (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  mission_key    text not null references missions(key),
  completed_at   timestamptz not null default now(),
  reset_at       timestamptz
);

create unique index player_missions_once_per_key
  on player_missions (player_address, mission_key)
  where reset_at is null;

create index player_missions_reset_idx on player_missions (player_address, reset_at);

-- ─── Items (definitions) ───────────────────────────────────────────────────
create table items (
  id           int generated always as identity primary key,
  key          text unique not null,
  name         text not null,
  description  text not null,
  bracket      bracket_name not null,
  effect_type  text not null,
  effect_value numeric not null default 0,
  is_badge     boolean not null default false
);

insert into items (key, name, description, bracket, effect_type, effect_value, is_badge) values
  ('cloth_purse',    'Cloth Purse',    'Defend gets +1 for the battle',              'entry',  'defend_flat_bonus',    1,   false),
  ('ledger_scroll',  'Ledger Scroll',  '+5% XP from check-ins',                      'entry',  'checkin_xp_multiplier', 0.05, false),
  ('bronze_shield',  'Bronze Shield',  'Defend blocks 25% more damage',              'bronze', 'defend_percent',       0.25, false),
  ('copper_compass', 'Copper Compass', 'See opponent''s last move before choosing',  'bronze', 'reveal_last_move',     1,   false),
  ('silver_blade',   'Silver Blade',   '+10% Attack damage',                         'silver', 'attack_percent',       0.10, false),
  ('silver_charm',   'Silver Charm',   'Special Move cooldown one turn shorter',     'silver', 'special_cooldown',     1,   false),
  ('gold_gauntlet',  'Gold Gauntlet',  '+20% Special Move damage',                   'gold',   'special_percent',      0.20, false),
  ('golden_crown',   'Golden Crown',   'Status badge on profile and leaderboard',    'gold',   'status_badge',         1,   true);

-- ─── Player items (unlock record) ──────────────────────────────────────────
create table player_items (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  item_key       text not null references items(key),
  unlocked_at    timestamptz not null default now(),
  unique (player_address, item_key)
);

-- ─── Badges (definitions) ──────────────────────────────────────────────────
create table badges (
  id                      text primary key,
  name                    text not null,
  description             text not null,
  revoked_on_withdrawal   boolean not null default false
);

insert into badges (id, name, description, revoked_on_withdrawal) values
  ('first_steps',  'First Steps',  'First check-in',                             false),
  ('week_warrior', 'Week Warrior', 'One-week streak',                             true),
  ('iron_saver',   'Iron Saver',   'Four-week streak through 11 November',        true),
  ('steady_hand',  'Steady Hand',  'No withdrawals for 30 UTC days',              false),
  ('first_blade',  'First Blade',  'First ranked battle win',                     false),
  ('golden_crown', 'Golden Crown', 'Gold bracket status',                         false);

-- ─── Player badges (award record) ──────────────────────────────────────────
create table player_badges (
  id             bigint generated always as identity primary key,
  player_address text not null references players(address) on delete cascade,
  badge_key      text not null references badges(id),
  awarded_at     timestamptz not null default now(),
  revoked_at     timestamptz
);

create unique index player_badges_active_idx
  on player_badges (player_address, badge_key)
  where revoked_at is null;

-- ─── Battles ───────────────────────────────────────────────────────────────
create table battles (
  id            uuid primary key default gen_random_uuid(),
  mode          battle_mode not null,
  status        battle_status not null default 'pending',
  player_a      text not null references players(address),
  player_b      text not null references players(address),
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

create index battles_open_idx on battles (status, turn_deadline)
  where status in ('pending', 'active');
create index battles_player_a_idx on battles (player_a, created_at desc);
create index battles_player_b_idx on battles (player_b, created_at desc);

-- ─── Battle moves ──────────────────────────────────────────────────────────
create table battle_moves (
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

-- ─── Matchmaking queue ─────────────────────────────────────────────────────
create table queue (
  player_address text primary key references players(address) on delete cascade,
  bracket        bracket_name not null,
  rating         int not null,
  entered_at     timestamptz not null default now(),
  last_poll_at   timestamptz not null default now(),
  status         queue_status not null default 'waiting',
  battle_id      uuid references battles(id)
);

create index queue_waiting_idx on queue (bracket, rating, entered_at)
  where status = 'waiting';

-- ─── Daily counters ────────────────────────────────────────────────────────
create table daily_battles (
  player_address text not null references players(address) on delete cascade,
  utc_date       date not null,
  count          int not null default 0,
  primary key (player_address, utc_date)
);

create table daily_xp (
  player_address text not null references players(address) on delete cascade,
  utc_date       date not null,
  xp_earned      int not null default 0,
  primary key (player_address, utc_date)
);

-- ─── Row-Level Security ────────────────────────────────────────────────────
-- Savborne does not use Supabase Auth. Identity is the Nimiq address, which
-- the client passes via a request header. All writes go through server-side
-- API routes using the service-role client (bypasses RLS). Anon reads are
-- allowed only on the leaderboard-visible columns via policies that check a
-- `request.header ->> 'x-player-address'` claim, or fall back to public data.
--
-- Because anon writes are effectively disabled by these policies, the app
-- must never call .insert() / .update() / .delete() with the anon client.

alter table players          enable row level security;
alter table check_ins        enable row level security;
alter table player_missions  enable row level security;
alter table player_items     enable row level security;
alter table player_badges    enable row level security;
alter table battles          enable row level security;
alter table battle_moves     enable row level security;
alter table queue            enable row level security;
alter table daily_battles    enable row level security;
alter table daily_xp         enable row level security;
-- missions, items, badges are pure lookup tables — readable by anon, no RLS.

-- Public read of leaderboard-relevant player fields.
create policy "players_public_read" on players
  for select using (true);

-- Own rows readable for other tables.
create policy "own_check_ins" on check_ins
  for select using (player_address = current_setting('request.header.x-player-address', true));

create policy "own_player_missions" on player_missions
  for select using (player_address = current_setting('request.header.x-player-address', true));

create policy "own_player_items" on player_items
  for select using (player_address = current_setting('request.header.x-player-address', true));

create policy "own_player_badges" on player_badges
  for select using (player_address = current_setting('request.header.x-player-address', true));

create policy "own_battles" on battles
  for select using (
    player_address in (player_a, player_b)
    or current_setting('request.header.x-player-address', true) in (player_a, player_b)
  );

create policy "own_battle_moves" on battle_moves
  for select using (player_address = current_setting('request.header.x-player-address', true));

create policy "own_queue" on queue
  for select using (player_address = current_setting('request.header.x-player-address', true));

create policy "own_daily_battles" on daily_battles
  for select using (player_address = current_setting('request.header.x-player-address', true));

create policy "own_daily_xp" on daily_xp
  for select using (player_address = current_setting('request.header.x-player-address', true));

-- ─── Matchmaking function (spec Section 16.3) ──────────────────────────────
-- Atomically pair two waiting players, widen by wait time, honor bracket
-- re-check at match time.
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
  -- 1. Load my queue row (locked).
  select * into me_row from queue
    where player_address = me_address and status = 'waiting'
    for update;

  if not found then
    return null;
  end if;

  -- 2. Re-check bracket at match time (per spec 16.3, step 5).
  select bracket into current_bracket from players where address = me_address;
  if current_bracket is null then
    -- Player dropped below 1 NIM — cannot be in ranked queue.
    update queue set status = 'cancelled' where player_address = me_address;
    return null;
  end if;
  if current_bracket <> me_row.bracket then
    update queue set bracket = current_bracket where player_address = me_address;
    me_row.bracket := current_bracket;
  end if;

  -- 3. Widen rating range by wait time.
  wait_seconds := extract(epoch from (now() - me_row.entered_at))::int;
  rating_range := case
    when wait_seconds < 60  then 150
    when wait_seconds < 120 then 300
    when wait_seconds < 180 then 450
    else 600
  end;

  -- 4. Find a candidate: same bracket, in rating range, longest waiting,
  --    not stale (polled within the last 30 s).
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
    -- Update my last_poll_at so I am not cleaned up as stale.
    update queue set last_poll_at = now() where player_address = me_address;
    return null;
  end if;

  -- 5. Create the battle.
  insert into battles (mode, status, player_a, player_b, current_turn)
    values ('ranked', 'pending', me_address, candidate.player_address, 0)
    returning id into new_battle_id;

  -- 6. Mark both queue rows matched.
  update queue set status = 'matched', battle_id = new_battle_id
    where player_address in (me_address, candidate.player_address);

  -- 7. Clean up any stale entries (best-effort).
  delete from queue
    where status = 'waiting'
      and last_poll_at < now() - interval '30 seconds';

  return new_battle_id;
end;
$$;

revoke all on function match_me(text) from public;
grant execute on function match_me(text) to anon, authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- SAVBORNE — vault and savings loop (additive)
--
-- Source of truth: supabase/FINAL-SCHEMA.sql. That is the file the user pastes.
-- This timestamped migration exists so other environments can apply the same
-- statements with `supabase db push`. Every statement is safe to re-run.
--
-- Adds:
--   • vaults        — vault address -> player mapping, one per player
--   • transfers     — claimed movements, credited only after chain verification
--   • players.shields / shields_earned
--   • first_deposit mission
--   • leaderboard_stats().has_vault
--   • create_player_with_vault() — atomic player + vault onboarding
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table if not exists vaults (
  address            text primary key,
  player_address     text not null unique
                       references players(address) on delete cascade,
  network            text not null check (network in ('mainnet','testnet')),
  card_token         text unique not null,
  backup_verified_at timestamptz,
  created_at         timestamptz not null default now()
);

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

-- ─── Players: streak shields ────────────────────────────────────────────────
alter table players add column if not exists shields        int not null default 1;
alter table players add column if not exists shields_earned int not null default 0;

-- ─── First-deposit mission ──────────────────────────────────────────────────
insert into missions (key, name, description, type, xp_reward, bracket_required)
values ('first_deposit', 'Vault Opened', 'Make your first deposit into your vault.',
        'onetime', 20, null)
on conflict (key) do nothing;

-- ─── Row-level security ─────────────────────────────────────────────────────
-- No anon/authenticated policies: only the service-role client touches these.
alter table vaults    enable row level security;
alter table transfers enable row level security;

-- ─── Leaderboard aggregation: has_vault ─────────────────────────────────────
-- A function's return type cannot be changed by CREATE OR REPLACE, so drop first.
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

-- ─── Atomic player + vault creation ─────────────────────────────────────────
create or replace function create_player_with_vault(
  p_address         text,
  p_display_name    text,
  p_vault_address   text,
  p_network         text,
  p_card_token      text,
  p_backup_verified boolean
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_existed boolean;
  v_player  players%rowtype;
  v_vault   vaults%rowtype;
begin
  select exists(select 1 from players p where p.address = p_address) into v_existed;

  insert into players (address, savings_account_address, display_name, current_balance_luna)
  values (p_address, p_vault_address, p_display_name, 0)
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

revoke all on function create_player_with_vault(text,text,text,text,text,boolean) from public;
grant execute on function create_player_with_vault(text,text,text,text,text,boolean) to service_role;

-- Check-in integrity release gate.
--
-- Ranked requires five check-ins. Before this migration, check_in_count
-- incremented on every POST, so five requests in one UTC day unlocked ranked.
-- This migration makes one reading per player per UTC day the rule, derives the
-- counter from those readings, commits a reading and its rewards in one
-- transaction, and rate-limits the endpoint.
--
-- Apply manually in the Supabase SQL editor (or supabase db push) before ranked
-- is exposed. The app's route tests fake the RPCs; the live checks are listed in
-- docs/superpowers/backlog/2026-11-09-check-in-integrity.md.

-- 1. Deduplicate existing readings by UTC day, keeping the earliest one.
delete from check_ins a
using check_ins b
where a.player_address = b.player_address
  and (a.recorded_at at time zone 'utc')::date
    = (b.recorded_at at time zone 'utc')::date
  and a.id > b.id;

-- 2. The UTC day is derived from the server timestamp, never from the client.
alter table check_ins
  add column if not exists utc_date date
  generated always as (((recorded_at at time zone 'utc'))::date) stored;

-- 3. One reading per player per UTC day.
create unique index if not exists check_ins_player_day_uidx
  on check_ins (player_address, utc_date);

-- 4. Rebuild the counter from distinct days rather than POST count.
update players p
set check_in_count = coalesce(
  (select count(*) from check_ins c where c.player_address = p.address),
  0
);

-- 5. Fixed-window endpoint rate limits.
create table if not exists api_rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);

alter table api_rate_limits enable row level security;
revoke all on api_rate_limits from public;
revoke all on api_rate_limits from anon, authenticated;
grant all on api_rate_limits to service_role;

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

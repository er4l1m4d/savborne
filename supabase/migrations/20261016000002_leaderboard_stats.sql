-- ═════════════════════════════════════════════════════════════════════════════
-- Savborne — leaderboard aggregation (Phase 5)
-- Historical record; the operational path is re-pasting supabase/FINAL-SCHEMA.sql
-- ═════════════════════════════════════════════════════════════════════════════

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
  growth_luna     bigint
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
    ) as growth_luna
  from players p
  where p.address <> 'ai-savborne'
$$;

revoke all on function leaderboard_stats() from public;
grant execute on function leaderboard_stats() to service_role;

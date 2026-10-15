-- ═════════════════════════════════════════════════════════════════════════════
-- Savborne — Phase 4 schema additions (battles)
--
-- 1. A seeded AI opponent row so `battles.player_b` can reference a real
--    players row for AI battles (battles.player_b has an FK to players).
-- 2. `player_b` becomes nullable so friend challenges can exist as `pending`
--    before the challenged player joins.
-- 3. Index for looking up a player's open battles quickly (battle screen
--    polling + reconnect flow).
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. The Savborne AI opponent. Fixed address constant used by the app layer.
insert into players (address, savings_account_address, display_name, level, xp, rating)
values ('ai-savborne', 'ai-savborne', 'Savborne AI', 1, 0, 0)
on conflict (address) do nothing;

-- 2. Friend challenges: player_b is filled when the challenge is accepted.
alter table battles alter column player_b drop not null;

-- 3. Battle lookup for a player across open + recent rows.
create index battles_player_open_idx on battles (player_a, status)
  where status in ('pending', 'active');
create index battles_player_b_open_idx on battles (player_b, status)
  where status in ('pending', 'active') and player_b is not null;

-- RLS: the AI row is public-readable like any other player row (already
-- covered by players_public_read), and the AI never authenticates, so no
-- extra policies are needed.

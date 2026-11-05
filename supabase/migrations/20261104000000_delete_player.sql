-- Delete a player account and everything that belongs to it.
--
-- Applied manually. The API route calls this through the service-role client,
-- which is why execute is revoked from public and from anon/authenticated, and
-- granted to service_role only.
--
-- Order matters. Every player reference cascades except these three:
--   * battles.player_a / battles.player_b
--   * battle_moves.player_address
--   * queue.battle_id
-- so deleting `battles` while a queue row still points at one fails with a
-- foreign-key error, and deleting `players` first fails for anyone who has
-- ever battled. Queue rows go first — both the player's own row and the
-- opponent's matched row that references a battle we are about to remove —
-- then moves, then battles, then the player row. The last delete cascades
-- check_ins, player_missions, player_items, player_badges, queue,
-- daily_battles, daily_xp, vaults and transfers.
--
-- The on-chain vault is untouched: the 24-word phrase still controls it.

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
  -- queue.battle_id has no ON DELETE action, so any matched row (mine, or the
  -- opponent's row pointing at a battle I am in) blocks the battles delete.
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

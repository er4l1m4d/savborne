-- Delete a player account and everything that belongs to it.
--
-- Applied manually. The API route calls this through the service-role client,
-- which is why execute is revoked from public and granted to service_role only.
--
-- Order matters. Every player reference cascades except two:
--   * battles.player_a / battles.player_b
--   * battle_moves.player_address
-- so deleting `players` first fails with a foreign-key error for anyone who has
-- ever battled. Moves go first, then the battles they belong to, then the player
-- row — the last delete cascades check_ins, player_missions, player_items,
-- player_badges, queue, daily_battles, daily_xp, vaults and transfers.
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
grant execute on function delete_player(text) to service_role;

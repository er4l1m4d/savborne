/**
 * Savborne - Ranks display helpers
 *
 * Pure copy and decisions for the Ranks screen. The ranking rules, the Elo
 * sort and the unranked score stay in `/api/leaderboards`; nothing here
 * reorders or rescores a board.
 */

export type Board = 'ranked' | 'unranked'

/** Ranks 1-3 read as strong text, 4+ as muted, as the handoff draws them. */
export function rankTone(rank: number): 'strong' | 'muted' {
  return rank <= 3 ? 'strong' : 'muted'
}

export function boardFooter(board: Board): string {
  const line =
    board === 'ranked'
      ? 'Ranked points from human ranked battles.'
      : 'Savings score from check-in growth and consistency.'
  return `${line} Only display names are shown, never addresses or balances.`
}

/**
 * The API always includes the caller, so a Friends board with no other player
 * is a list of one. Treat it as empty rather than as a one-row list.
 */
export function isFriendsEmpty(rows: { isMe: boolean }[]): boolean {
  return rows.every((row) => row.isMe)
}

export function shouldPinYou(
  rows: { isMe: boolean }[],
  you: { rank: number } | null,
): boolean {
  return you !== null && !rows.some((row) => row.isMe)
}

export function footerLegend(total: number, anyVerified: boolean): string {
  const players = `${total} player${total === 1 ? '' : 's'}`
  return anyVerified ? `${players} · ⟡ verified saver` : players
}

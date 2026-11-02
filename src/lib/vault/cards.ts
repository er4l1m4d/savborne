/**
 * Savborne — public flex card data (server only)
 *
 * Reads exactly the columns the card renders, never `select('*')`. That is the
 * line of defence: a balance cannot leak into a public page if it is never
 * queried. The full player address is never selected either — only the vault
 * address, which is derived from the phrase and reveals no identity.
 *
 * A missing or unknown token returns null so both the page and the OG image
 * share one 404 decision.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { Bracket } from '@/lib/constants'

export type FlexCard = {
  displayName: string
  level: number
  streakCurrent: number
  shields: number
  bracket: Bracket | null
  /** Shortened, and only the vault address. Never the player's wallet address. */
  shortVaultAddress: string
  /** Whether the vault has a confirmed backup on record. */
  backupVerified: boolean
}

export async function getFlexCard(token: string): Promise<FlexCard | null> {
  // A token is minted as a UUID; reject anything else before a query, so the
  // endpoint is not a probe for arbitrary strings.
  if (!/^[0-9a-f-]{16,64}$/i.test(token)) return null

  const db = supabaseAdmin()

  // Explicit columns. No `balance`, no player wallet address.
  const { data: vault } = await db
    .from('vaults')
    .select('address, player_address, backup_verified_at')
    .eq('card_token', token)
    .maybeSingle()
  if (!vault) return null

  const { data: player } = await db
    .from('players')
    .select('address, display_name, level, streak_current, bracket, shields')
    .eq('address', vault.player_address)
    .maybeSingle()
  if (!player) return null

  return {
    displayName: player.display_name,
    level: player.level,
    streakCurrent: player.streak_current,
    shields: player.shields ?? 0,
    bracket: (player.bracket as Bracket | null) ?? null,
    shortVaultAddress: shorten(vault.address),
    backupVerified: vault.backup_verified_at !== null,
  }
}

/** `NQ57 2F6C … ELRL` — enough to recognise, not enough to target. */
export function shorten(address: string): string {
  const flat = address.replace(/\s/g, '')
  if (flat.length <= 12) return address
  return `${flat.slice(0, 8)}…${flat.slice(-4)}`
}

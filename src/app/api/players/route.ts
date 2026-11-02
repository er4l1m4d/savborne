/**
 * POST /api/players
 *
 * Creates the player row and the vault row in one atomic call at the end of
 * onboarding. The vault phrase never reaches the server; only the derived
 * address and the declared backup state do.
 *
 * Body:
 *   {
 *     address:       string   // the player's Nimiq address (identity key)
 *     displayName:   string   // 1–32 chars, shown on leaderboard
 *     vaultAddress:  string   // the vault the client generated on device
 *     network:       'mainnet' | 'testnet'
 *     backupVerified: boolean // a declared claim; the gate is enforced on deposit
 *   }
 *
 * Response:
 *   201 { player, vault, created: true }
 *   200 { player, vault, created: false }   // this wallet already had a vault
 *   400 { error }                           // bad inputs
 *   409 { error: 'vault_taken' | 'vault_exists' }
 *
 * The old `savingsAddress` / `initialBalanceLuna` fields are ignored, not
 * rejected: the client ships in the same build, but an in-flight tab must not 400.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isPlausibleAddress } from '@/lib/vault/address'
import { toVaultDto } from '@/lib/vault/dto'
import { isNetwork } from '@/lib/vault/network'
import type { PlayerRow, VaultRow } from '@/lib/database.types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  address?: unknown
  displayName?: unknown
  vaultAddress?: unknown
  network?: unknown
  backupVerified?: unknown
}

type CreateResult = {
  player: PlayerRow
  vault: VaultRow
  created: boolean
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { address, displayName, vaultAddress, network, backupVerified } = body

  if (typeof address !== 'string' || !isPlausibleAddress(address)) {
    return NextResponse.json({ error: 'Invalid player address' }, { status: 400 })
  }
  if (typeof vaultAddress !== 'string' || !isPlausibleAddress(vaultAddress)) {
    return NextResponse.json({ error: 'Invalid vault address' }, { status: 400 })
  }
  if (
    typeof displayName !== 'string' ||
    displayName.trim().length < 1 ||
    displayName.trim().length > 32
  ) {
    return NextResponse.json({ error: 'Display name must be 1–32 characters' }, { status: 400 })
  }
  if (!isNetwork(network)) {
    return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
  }
  if (typeof backupVerified !== 'boolean') {
    return NextResponse.json({ error: 'backupVerified must be a boolean' }, { status: 400 })
  }

  const db = supabaseAdmin()
  // Server-minted: nothing is persisted before this point anyway, and a
  // client-minted token buys no privacy while allowing two clients to collide.
  const cardToken = crypto.randomUUID()

  const { data, error } = await db.rpc('create_player_with_vault', {
    p_address: address,
    p_display_name: displayName.trim(),
    p_vault_address: vaultAddress,
    p_network: network,
    p_card_token: cardToken,
    p_backup_verified: backupVerified,
  })

  if (error) {
    if (error.message.includes('vault_taken')) {
      return NextResponse.json({ error: 'vault_taken' }, { status: 409 })
    }
    if (error.message.includes('vault_exists')) {
      return NextResponse.json({ error: 'vault_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result = data as CreateResult
  return NextResponse.json(
    { player: result.player, vault: toVaultDto(result.vault), created: result.created },
    { status: result.created ? 201 : 200 },
  )
}

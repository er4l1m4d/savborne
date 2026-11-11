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
 *     displayName:   string   // 1-16 chars, shown on leaderboard
 *     vaultAddress:  string   // the vault the client generated on device
 *     network:       'mainnet' | 'testnet'
 *     backupVerified: boolean // a declared claim; the gate is enforced on deposit
 *     privacyNoticeVersion?: string // the notice version accepted in onboarding
 *     avatar?:       'hero' | 'heroine' // the chosen character drawing
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
import { validateDisplayName } from '@/lib/display-name'
import { DEFAULT_AVATAR, isAvatar } from '@/lib/avatar'
import { isPlausibleAddress, sameAddress } from '@/lib/vault/address'
import { toVaultDto } from '@/lib/vault/dto'
import { isNetwork } from '@/lib/vault/network'
import type { PlayerRow, VaultRow } from '@/lib/database.types'
import { routeError } from '@/lib/report'
import { requirePlayer, isAuthResponse } from '@/lib/require-player'
import { rateLimitOrError } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  address?: unknown
  displayName?: unknown
  vaultAddress?: unknown
  network?: unknown
  backupVerified?: unknown
  privacyNoticeVersion?: unknown
  avatar?: unknown
}

type CreateResult = {
  player: PlayerRow
  vault: VaultRow
  created: boolean
}

export async function POST(req: Request) {
  const auth = requirePlayer(req)
  if (isAuthResponse(auth)) return auth

  const limited = await rateLimitOrError({
    req,
    route: '/api/players',
    key: `players-create:${auth.address}`,
    limit: 5,
    windowSeconds: 60,
  })
  if (limited) return limited

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    address,
    displayName,
    vaultAddress,
    network,
    backupVerified,
    privacyNoticeVersion,
    avatar,
  } = body

  if (typeof address !== 'string' || !isPlausibleAddress(address)) {
    return NextResponse.json({ error: 'Invalid player address' }, { status: 400 })
  }
  // The session is the authority. The body only confirms the same wallet.
  if (!sameAddress(auth.address, address)) {
    return NextResponse.json({ error: 'session_mismatch' }, { status: 401 })
  }
  if (typeof vaultAddress !== 'string' || !isPlausibleAddress(vaultAddress)) {
    return NextResponse.json({ error: 'Invalid vault address' }, { status: 400 })
  }
  if (typeof displayName !== 'string') {
    return NextResponse.json({ error: 'Display name must be 1-16 characters.' }, { status: 400 })
  }
  const name = validateDisplayName(displayName)
  if (!name.ok) {
    return NextResponse.json({ error: name.error }, { status: 400 })
  }
  if (!isNetwork(network)) {
    return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
  }
  if (typeof backupVerified !== 'boolean') {
    return NextResponse.json({ error: 'backupVerified must be a boolean' }, { status: 400 })
  }
  if (avatar !== undefined && !isAvatar(avatar)) {
    return NextResponse.json({ error: 'Invalid avatar' }, { status: 400 })
  }
  if (
    privacyNoticeVersion !== undefined &&
    privacyNoticeVersion !== null &&
    (typeof privacyNoticeVersion !== 'string' ||
      privacyNoticeVersion.trim().length < 1 ||
      privacyNoticeVersion.trim().length > 32)
  ) {
    return NextResponse.json({ error: 'Invalid privacy notice version' }, { status: 400 })
  }

  const db = supabaseAdmin()
  // Server-minted: nothing is persisted before this point anyway, and a
  // client-minted token buys no privacy while allowing two clients to collide.
  const cardToken = crypto.randomUUID()

  const { data, error } = await db.rpc('create_player_with_vault', {
    p_address: address,
    p_display_name: name.value,
    p_vault_address: vaultAddress,
    p_network: network,
    p_card_token: cardToken,
    p_backup_verified: backupVerified,
    p_privacy_notice_version:
      typeof privacyNoticeVersion === 'string' ? privacyNoticeVersion.trim() : null,
    p_avatar: isAvatar(avatar) ? avatar : DEFAULT_AVATAR,
  })

  if (error) {
    if (error.message.includes('vault_taken')) {
      return NextResponse.json({ error: 'vault_taken' }, { status: 409 })
    }
    if (error.message.includes('vault_exists')) {
      return NextResponse.json({ error: 'vault_exists' }, { status: 409 })
    }
    return routeError({
      req, route: '/api/players', code: 'db_error', status: 500, error,
    })
  }

  const result = data as CreateResult
  return NextResponse.json(
    { player: result.player, vault: toVaultDto(result.vault), created: result.created },
    { status: result.created ? 201 : 200 },
  )
}

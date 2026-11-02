/**
 * /api/vaults
 *
 * Registration and recovery for players who already have a row (that is, every
 * player who onboarded before the vault build). The caller is always taken
 * from the X-Player-Address header, never from the body.
 *
 *   GET   -> { vault: VaultDto | null }
 *   POST  -> 201 { vault }            body { vaultAddress, network, backupVerified }
 *            409 { error: 'has_vault' | 'vault_taken' | 'vault_exists' }
 *   PATCH -> 200 { vault }            body { backupVerified: true }
 *            404 { error: 'no_vault' }
 *
 * PATCH is the only mutation allowed after creation, and it can only move
 * backup_verified_at from null to now.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { PLAYER_HEADER } from '@/lib/session'
import { isPlausibleAddress } from '@/lib/vault/address'
import { toVaultDto } from '@/lib/vault/dto'
import { isNetwork } from '@/lib/vault/network'
import type { VaultRow } from '@/lib/database.types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing player header' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('vaults')
    .select('address, player_address, network, card_token, backup_verified_at, created_at')
    .eq('player_address', address)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ vault: data ? toVaultDto(data as VaultRow) : null })
}

export async function POST(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing player header' }, { status: 401 })
  }

  let body: { vaultAddress?: unknown; network?: unknown; backupVerified?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { vaultAddress, network, backupVerified } = body
  if (typeof vaultAddress !== 'string' || !isPlausibleAddress(vaultAddress)) {
    return NextResponse.json({ error: 'Invalid vault address' }, { status: 400 })
  }
  if (!isNetwork(network)) {
    return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
  }
  if (typeof backupVerified !== 'boolean') {
    return NextResponse.json({ error: 'backupVerified must be a boolean' }, { status: 400 })
  }

  const db = supabaseAdmin()

  const existing = await db.from('vaults').select('address').eq('player_address', address).maybeSingle()
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 500 })
  }
  if (existing.data) {
    return NextResponse.json({ error: 'has_vault' }, { status: 409 })
  }

  const { data, error } = await db
    .from('vaults')
    .insert({
      address: vaultAddress,
      player_address: address,
      network,
      card_token: crypto.randomUUID(),
      backup_verified_at: backupVerified ? new Date().toISOString() : null,
    })
    .select('address, player_address, network, card_token, backup_verified_at, created_at')
    .single()

  if (error) {
    // 23505 on `address` means another player already claimed this vault.
    if (error.code === '23505' || error.message.includes('duplicate key')) {
      return NextResponse.json({ error: 'vault_taken' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ vault: toVaultDto(data as VaultRow) }, { status: 201 })
}

export async function PATCH(req: Request) {
  const address = req.headers.get(PLAYER_HEADER)
  if (!address) {
    return NextResponse.json({ error: 'Missing player header' }, { status: 401 })
  }

  let body: { backupVerified?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (body.backupVerified !== true) {
    return NextResponse.json({ error: 'backupVerified must be true' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('vaults')
    .update({ backup_verified_at: new Date().toISOString() })
    .eq('player_address', address)
    .is('backup_verified_at', null)
    .select('address, player_address, network, card_token, backup_verified_at, created_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (data) {
    return NextResponse.json({ vault: toVaultDto(data as VaultRow) })
  }

  // Either the player has no vault, or it was already verified. Distinguish.
  const current = await db
    .from('vaults')
    .select('address, player_address, network, card_token, backup_verified_at, created_at')
    .eq('player_address', address)
    .maybeSingle()
  if (current.error) {
    return NextResponse.json({ error: current.error.message }, { status: 500 })
  }
  if (!current.data) {
    return NextResponse.json({ error: 'no_vault' }, { status: 404 })
  }
  return NextResponse.json({ vault: toVaultDto(current.data as VaultRow) })
}

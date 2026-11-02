/**
 * Savborne — encrypted vault at rest (browser only)
 *
 * Keyed by the player's WALLET address, not the vault address: the wallet is
 * known from onboarding step 2, before the vault exists. Two players on a
 * shared device therefore keep separate vaults, and a vault created for one
 * player is never offered to the other.
 *
 * The plaintext phrase is never written here — only the encrypted blob.
 */

import type { Network } from '@/lib/nimiq'
import { normalizeAddress } from './address'
import type { EncryptedBlob } from './crypto'

export type StoredVault = {
  version: 1
  address: string
  network: Network
  createdAt: string
  blob: EncryptedBlob
}

export const vaultStorageKey = (playerAddress: string) =>
  `savborne.vault.v1.${normalizeAddress(playerAddress)}`

export function readVault(playerAddress: string): StoredVault | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(vaultStorageKey(playerAddress))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredVault>
    if (parsed.version !== 1 || !parsed.address || !parsed.network || !parsed.blob) return null
    return parsed as StoredVault
  } catch {
    return null
  }
}

export function writeVault(playerAddress: string, vault: StoredVault): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(vaultStorageKey(playerAddress), JSON.stringify(vault))
}

export function clearVault(playerAddress: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(vaultStorageKey(playerAddress))
}

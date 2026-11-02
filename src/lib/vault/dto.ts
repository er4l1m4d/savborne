/**
 * Savborne — vault DTO
 *
 * The database rows are snake_case; the API is camelCase. Both `/api/players`
 * and `/api/vaults` serialize the same resource, so the mapping lives in one
 * place. The phrase is absent by construction: the server never has it.
 */

import type { VaultRow } from '@/lib/database.types'
import type { Network } from '@/lib/nimiq'

export type VaultDto = {
  address: string
  network: Network
  cardToken: string
  backupVerifiedAt: string | null
  createdAt: string
}

export function toVaultDto(row: VaultRow): VaultDto {
  return {
    address: row.address,
    network: row.network,
    cardToken: row.card_token,
    backupVerifiedAt: row.backup_verified_at,
    createdAt: row.created_at,
  }
}

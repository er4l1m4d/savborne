/**
 * Savborne - wallet error copy
 *
 * One mapping for the onboarding provider and the existing `/setup/vault`
 * flow. The messages are the ones the vault build already shipped; this module
 * only stops the two screens from drifting apart.
 */

import { WalletError } from '@/lib/nimiq'

export function describeWalletError(err: unknown): string {
  if (err instanceof WalletError) {
    switch (err.type) {
      case 'PERMISSION_DENIED':
        return 'Account access was declined. Tap again and approve the wallet prompt in Nimiq Pay.'
      case 'NETWORK_ERROR':
        return 'The Nimiq network is unreachable right now. Try again in a moment.'
      default:
        return err.message || `Wallet error: ${err.type}`
    }
  }
  return err instanceof Error ? err.message : String(err)
}

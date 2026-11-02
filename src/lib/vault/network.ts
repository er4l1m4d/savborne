/**
 * Savborne — vault network constants
 *
 * Runtime-agnostic: imported by route handlers and by Node tests. It must not
 * import `@nimiq/core/web`, React, or anything browser-only.
 *
 * The ids and explorer paths are measured from live chain data (spec §17):
 *   • mainnet network id 24, testnet 5 — do not use 42/1
 *   • explorer links are `/#<hash>`; `https://nimiq.watch/tx/<hash>` returns 404
 */

import type { Network } from '@/lib/nimiq'

export const VAULT_NETWORK_ID: Record<Network, number> = {
  mainnet: 24,
  testnet: 5,
}

export const VAULT_RPC_URL: Record<Network, string> = {
  mainnet: 'https://rpc.nimiqwatch.com',
  testnet: 'https://rpc.testnet.nimiqwatch.com',
}

/** Explorer link for a settled transaction. `#`, never `/tx/`: that path 404s. */
export function explorerTxUrl(network: Network, hash: string): string {
  const base = network === 'mainnet' ? 'https://nimiq.watch' : 'https://test.nimiq.watch'
  return `${base}/#${hash}`
}

export function isNetwork(value: unknown): value is Network {
  return value === 'mainnet' || value === 'testnet'
}

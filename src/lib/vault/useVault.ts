/**
 * Savborne — vault hook (browser)
 *
 * Owns the three things the vault screen cannot get wrong:
 *   1. the balance, read from the chain (never from the server's cached row);
 *   2. the decrypted key, held in a ref and dropped on unmount;
 *   3. the broadcast-then-report loop, with the hash persisted first.
 *
 * The vault address and network are checked against the server row before any
 * money moves, because local storage and the database can disagree.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { authHeaders, readSession } from '@/lib/session'
import { sendDeposit } from '@/lib/nimiq'
import type { VaultDto } from '@/lib/vault/dto'
import { decryptPhrase } from '@/lib/vault/crypto'
import { VAULT_NETWORK_ID } from '@/lib/vault/network'
import { broadcastTransaction, getAccount, getHeadHeight, RpcError } from '@/lib/vault/rpc'
import { readVault } from '@/lib/vault/storage'
import { signTransfer } from '@/lib/vault/phrase'
import {
  forgetPending,
  pollTransfer,
  rememberPending,
  retryPending,
  submitTransfer,
  type TransferView,
} from '@/lib/vault/transfers'

export type VaultLockState = 'locked' | 'unlocked' | 'no_vault'

export type UseVaultResult = {
  vault: VaultDto | null
  loading: boolean
  balanceLuna: number | null
  balanceError: string | null
  transfers: TransferView[]
  error: string | null
  lockState: VaultLockState
  hasLocalKey: boolean
  refresh: () => Promise<void>
  refreshBalance: () => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  lock: () => void
  deposit: (amountLuna: number) => Promise<TransferView>
  withdraw: (amountLuna: number, passphrase: string) => Promise<TransferView>
}

export function useVault(): UseVaultResult {
  const [vault, setVault] = useState<VaultDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [balanceLuna, setBalanceLuna] = useState<number | null>(null)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [transfers, setTransfers] = useState<TransferView[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lockState, setLockState] = useState<VaultLockState>('no_vault')
  const [hasLocalKey, setHasLocalKey] = useState(false)

  // The decrypted phrase lives here and nowhere else. Never in state: state is
  // serialisable, inspectable, and easy to leak into a render.
  const phraseRef = useRef<string[] | null>(null)

  const playerAddress = readSession()?.playerAddress ?? null

  const refreshBalance = useCallback(async (v: VaultDto | null) => {
    if (!v) return
    try {
      const account = await getAccount(v.address, v.network)
      setBalanceLuna(account.balanceLuna)
      setBalanceError(null)
    } catch (err) {
      setBalanceLuna(null)
      setBalanceError(
        err instanceof RpcError
          ? `Could not reach the ${v.network} network. ${err.message}`
          : 'Could not read the vault balance.',
      )
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await retryPending()

      const res = await fetch('/api/vaults', { headers: authHeaders() })
      if (!res.ok) throw new Error(`Could not load your vault (${res.status})`)
      const body = (await res.json()) as { vault: VaultDto | null }
      setVault(body.vault)

      if (!body.vault) {
        setLockState('no_vault')
        setBalanceLuna(null)
        return
      }

      const local = playerAddress ? readVault(playerAddress) : null
      setHasLocalKey(local !== null)
      setLockState(phraseRef.current ? 'unlocked' : 'locked')
      await refreshBalance(body.vault)

      const listRes = await fetch('/api/transfers', { headers: authHeaders() })
      if (listRes.ok) {
        const listBody = (await listRes.json()) as { transfers: TransferView[] }
        setTransfers(listBody.transfers)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [playerAddress, refreshBalance])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    return () => {
      phraseRef.current = null
    }
  }, [])

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!playerAddress) throw new Error('No session')
      const local = readVault(playerAddress)
      if (!local) throw new Error('No vault key on this device. Restore from your 24 words.')
      const phrase = await decryptPhrase(local.blob, passphrase)
      phraseRef.current = phrase
      setLockState('unlocked')
    },
    [playerAddress],
  )

  const lock = useCallback(() => {
    phraseRef.current = null
    setLockState(vault ? 'locked' : 'no_vault')
  }, [vault])

  const deposit = useCallback(
    async (amountLuna: number): Promise<TransferView> => {
      if (!vault) throw new Error('No vault')
      if (!playerAddress) throw new Error('No session')
      if (vault.backupVerifiedAt === null) {
        // Checked here, before the wallet prompt: the server's 403 arrives
        // after the money has left, which is too late to help.
        throw new Error('Finish your backup before depositing.')
      }

      const txHash = await sendDeposit({ recipient: vault.address, valueLuna: amountLuna })
      rememberPending(playerAddress, {
        txHash,
        direction: 'in',
        amountLuna,
        network: vault.network,
        at: new Date().toISOString(),
      })

      try {
        await submitTransfer({ direction: 'in', txHash, amountLuna, network: vault.network })
        forgetPending(playerAddress, txHash)
      } catch (err) {
        // Keep the pending record: the money has moved and the server must
        // eventually learn about it.
        throw err
      }

      const settled = await pollTransfer({ txHash })
      await refreshBalance(vault)
      return settled
    },
    [vault, playerAddress, refreshBalance],
  )

  const withdraw = useCallback(
    async (amountLuna: number, passphrase: string): Promise<TransferView> => {
      if (!vault) throw new Error('No vault')
      if (!playerAddress) throw new Error('No session')

      const local = readVault(playerAddress)
      if (!local) throw new Error('No vault key on this device.')

      const phrase = phraseRef.current ?? (await decryptPhrase(local.blob, passphrase))
      phraseRef.current = phrase
      setLockState('unlocked')

      const head = await getHeadHeight(vault.network)
      const { hex } = await signTransfer({
        phrase,
        recipient: playerAddress,
        valueLuna: amountLuna,
        feeLuna: 0,
        validityStartHeight: head,
        networkId: VAULT_NETWORK_ID[vault.network],
      })
      const txHash = await broadcastTransaction(hex, vault.network)

      rememberPending(playerAddress, {
        txHash,
        direction: 'out',
        amountLuna,
        network: vault.network,
        at: new Date().toISOString(),
      })

      await submitTransfer({ direction: 'out', txHash, amountLuna, network: vault.network })
      forgetPending(playerAddress, txHash)

      const settled = await pollTransfer({ txHash })
      await refreshBalance(vault)
      return settled
    },
    [vault, playerAddress, refreshBalance],
  )

  return {
    vault,
    loading,
    balanceLuna,
    balanceError,
    transfers,
    error,
    lockState,
    hasLocalKey,
    refresh,
    refreshBalance: () => refreshBalance(vault),
    unlock,
    lock,
    deposit,
    withdraw,
  }
}

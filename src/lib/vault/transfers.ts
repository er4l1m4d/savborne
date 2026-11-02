/**
 * Savborne — transfer client (browser)
 *
 * Broadcast-then-POST is two steps and the second can fail: the NIM has left
 * before the server knows. So every broadcast is written to localStorage
 * BEFORE the POST and cleared on a terminal answer. A failed POST is retried
 * on next mount and on `online`, which is what turns a silent loss into a
 * recoverable one.
 *
 * `pollTransfer` never invents success: it stops on included or expired, on
 * abort, or on timeout (default 150 s, longer than the server's 120 s expiry
 * so the server's verdict always wins).
 */

import type { Network } from '@/lib/nimiq'
import { authHeaders, readSession } from '@/lib/session'

export type TransferView = {
  id: number
  direction: 'in' | 'out'
  amountLuna: number
  feeLuna: number
  txHash: string
  status: 'pending' | 'included' | 'expired'
  blockHeight: number | null
  failureReason: string | null
  explorerUrl: string | null
}

type TransferResponse = {
  transfer: TransferView
  verified?: boolean
  changed?: boolean
}

export async function submitTransfer(args: {
  direction: 'in' | 'out'
  txHash: string
  amountLuna: number
  network: Network
}): Promise<{ transfer: TransferView; verified: boolean }> {
  const res = await fetch('/api/transfers', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(args),
  })

  if (res.status === 403) throw new Error('Verify your backup before depositing.')
  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (body.error === 'vault_required') throw new Error('Create your vault first.')
    if (body.error === 'network_mismatch') throw new Error('Wrong network for this vault.')
    if (body.error === 'tx_hash_conflict') throw new Error('That transaction is already claimed.')
    throw new Error(`Transfer rejected (${body.error ?? res.status})`)
  }
  if (!res.ok && res.status !== 202 && res.status !== 200) {
    const text = await res.text().catch(() => '')
    throw new Error(`Transfer failed (${res.status}): ${text}`)
  }

  const body = (await res.json()) as TransferResponse
  return { transfer: body.transfer, verified: body.verified ?? false }
}

export async function fetchTransfer(txHash: string): Promise<TransferView> {
  const res = await fetch(`/api/transfers/${txHash}`, { headers: authHeaders() })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Could not check the transfer (${res.status}): ${text}`)
  }
  const body = (await res.json()) as TransferResponse
  return body.transfer
}

export async function pollTransfer(args: {
  txHash: string
  onUpdate?: (t: TransferView) => void
  intervalMs?: number
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<TransferView> {
  const intervalMs = args.intervalMs ?? 4_000
  const timeoutMs = args.timeoutMs ?? 150_000
  const deadline = Date.now() + timeoutMs

  for (;;) {
    if (args.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const transfer = await fetchTransfer(args.txHash)
    args.onUpdate?.(transfer)
    if (transfer.status === 'included' || transfer.status === 'expired') return transfer

    if (Date.now() >= deadline) return transfer
    await sleep(intervalMs, args.signal)
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

// ─── Pending broadcasts (survive a failed POST) ──────────────────────────────

export type PendingBroadcast = {
  txHash: string
  direction: 'in' | 'out'
  amountLuna: number
  network: Network
  at: string
}

function pendingKey(playerAddress: string): string {
  return `savborne.pending.v1.${playerAddress}`
}

export function readPending(playerAddress: string): PendingBroadcast[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(pendingKey(playerAddress))
    return raw ? (JSON.parse(raw) as PendingBroadcast[]) : []
  } catch {
    return []
  }
}

export function rememberPending(playerAddress: string, entry: PendingBroadcast): void {
  if (typeof window === 'undefined') return
  const list = readPending(playerAddress).filter((e) => e.txHash !== entry.txHash)
  list.push(entry)
  window.localStorage.setItem(pendingKey(playerAddress), JSON.stringify(list))
}

export function forgetPending(playerAddress: string, txHash: string): void {
  if (typeof window === 'undefined') return
  const list = readPending(playerAddress).filter((e) => e.txHash !== txHash)
  window.localStorage.setItem(pendingKey(playerAddress), JSON.stringify(list))
}

/**
 * Re-POST anything a previous session broadcast but never told the server
 * about. Called on mount and on `online`.
 */
export async function retryPending(): Promise<void> {
  const session = readSession()
  if (!session) return
  const list = readPending(session.playerAddress)
  for (const entry of list) {
    try {
      const { transfer } = await submitTransfer({
        direction: entry.direction,
        txHash: entry.txHash,
        amountLuna: entry.amountLuna,
        network: entry.network,
      })
      if (transfer.status !== 'pending') {
        forgetPending(session.playerAddress, entry.txHash)
      }
    } catch {
      // Leave it for the next attempt; never lose the hash.
    }
  }
}

'use client'

/**
 * Savborne — Receipts
 *
 * The on-chain proof screen. Every transfer shows the hash it claims and, only
 * once the server has seen it in a block, the explorer link that proves it.
 * A balance snapshot appears too — flatter, and with no hash — because knowing
 * *when* a balance was recorded matters as much as the money movement.
 *
 * Lives outside the tabs group on purpose: receipts are reached from the vault
 * screen, not from a seventh tab.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { authHeaders } from '@/lib/session'
import { LUNA_PER_NIM } from '@/lib/constants'
import type { SnapshotItem, TimelineItem, TransferItem } from '@/lib/vault/receipts'

export default function ReceiptsPage() {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/receipts', { headers: authHeaders() })
      if (!res.ok) throw new Error(`Could not load receipts (${res.status})`)
      const body = (await res.json()) as { items: TimelineItem[] }
      setItems(body.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Ask the server to re-check one pending transfer against the chain now. */
  async function checkAgain(txHash: string) {
    setChecking(txHash)
    setCheckResult(null)
    try {
      const res = await fetch(`/api/transfers/${txHash}`, { headers: authHeaders() })
      const body = (await res.json()) as { transfer?: TransferItem }
      setCheckResult(
        body.transfer?.status === 'included'
          ? 'Confirmed on chain.'
          : body.transfer?.status === 'expired'
            ? 'The node never included it. Broadcast a new transaction.'
            : 'Still pending — not in a block yet.',
      )
      // Refresh so a settled row stops showing as pending.
      await load()
    } catch {
      setCheckResult('Could not reach the network just now.')
    } finally {
      setChecking(null)
    }
  }

  return (
    <main className="min-h-dvh p-(--gut) max-w-105 mx-auto w-full flex flex-col gap-4 pb-10">
      <header className="flex flex-col gap-1 mt-4">
        <h1 className="text-3xl leading-none" style={{ fontFamily: 'var(--font-silkscreen)' }}>
          Receipts
        </h1>
        <p className="text-sm text-fg-muted">
          Every deposit, withdrawal and balance check-in, newest first. A receipt is only shown
          once the chain has confirmed it.
        </p>
      </header>

      {loading && <p className="text-sm text-fg-muted">Loading…</p>}

      {error && (
        <div className="vpx bg-coral-tint p-3 text-sm text-coral-text flex flex-col gap-2">
          <span>{error}</span>
          <button onClick={load} className="self-start vpx bg-surface px-3 py-1 text-xs font-bold text-foreground">
            Retry
          </button>
        </div>
      )}

      {checkResult && <div className="vpx bg-surface p-3 text-sm text-mint">{checkResult}</div>}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-fg-muted">
          Nothing here yet. Your first deposit creates the first receipt.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {items.map((item) =>
          item.kind === 'transfer' ? (
            <TransferRow
              key={`t-${item.id}`}
              item={item}
              checking={checking === item.txHash}
              onCheck={() => checkAgain(item.txHash)}
            />
          ) : (
            <SnapshotRow key={`s-${item.id}`} item={item} />
          ),
        )}
      </ol>

      <Link href="/vault" className="text-mint underline underline-offset-4 text-sm self-start">
        Back to vault
      </Link>
    </main>
  )
}

function TransferRow({
  item,
  checking,
  onCheck,
}: {
  item: TransferItem
  checking: boolean
  onCheck: () => void
}) {
  const label = item.direction === 'in' ? 'Deposit' : 'Withdrawal'
  const amount = (item.amountLuna / LUNA_PER_NIM).toFixed(2)
  const fee = (item.feeLuna / LUNA_PER_NIM).toFixed(5)

  return (
    <li className="vpx bg-surface p-4 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-bold">{label}</span>
        <span className={`text-sm num ${item.direction === 'in' ? 'text-mint' : 'text-butter'}`}>
          {item.direction === 'in' ? '+' : '−'}
          {amount} NIM
        </span>
      </div>

      <span className="text-[11px] font-mono text-fg-faint break-all">{item.txHash}</span>
      <span className="text-[11px] text-fg-faint">{formatWhen(item.at)}</span>

      {item.status === 'included' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-mint">Confirmed in block {item.blockHeight}</span>
          <span className="text-fg-faint num">fee {fee} NIM</span>
          {item.explorerUrl && (
            <a
              href={item.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-mint underline underline-offset-4"
            >
              View on explorer ↗
            </a>
          )}
        </div>
      )}

      {item.status === 'pending' && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-butter">Pending — not yet confirmed</span>
          <button
            onClick={onCheck}
            disabled={checking}
            className="vpx bg-surface-hi px-3 py-1 text-xs font-bold disabled:opacity-40"
          >
            {checking ? 'Checking…' : 'Check again'}
          </button>
        </div>
      )}

      {item.status === 'expired' && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-coral-text">
            Failed{item.failureReason ? ` — ${humanReason(item.failureReason)}` : ''}
          </span>
          {/* `expired` is terminal: the same hash can never settle. Sign a new one. */}
          <Link
            href={`/vault?direction=${item.direction}&amount=${(item.amountLuna / LUNA_PER_NIM).toFixed(2)}`}
            className="vpx bg-surface-hi px-3 py-1 text-xs font-bold text-foreground no-underline"
          >
            Try again
          </Link>
        </div>
      )}
    </li>
  )
}

/** A snapshot is a balance reading: no hash exists, so none is rendered. */
function SnapshotRow({ item }: { item: SnapshotItem }) {
  return (
    <li className="vpx-soft bg-surface-low px-4 py-3 flex items-baseline justify-between gap-3">
      <span className="text-sm text-fg-muted">Balance check-in</span>
      <span className="text-sm num text-fg-soft">
        {(item.balanceLuna / LUNA_PER_NIM).toFixed(2)} NIM
      </span>
      <span className="text-[11px] text-fg-faint">{formatWhen(item.at)}</span>
    </li>
  )
}

function humanReason(reason: string): string {
  switch (reason) {
    case 'wrong_recipient':
      return 'it paid the wrong address'
    case 'wrong_sender':
      return 'it came from an unexpected address'
    case 'wrong_amount':
      return 'the amount did not match'
    case 'wrong_network':
      return 'it was on the wrong network'
    case 'execution_failed':
      return 'the network rejected it'
    case 'not_included':
      return 'the network never included it'
    default:
      return reason
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { LUNA_PER_NIM } from '@/lib/constants'
import type { SnapshotItem, TimelineItem, TransferItem } from '@/lib/vault/receipts'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiFetch } from '@/lib/client-session'

const LOAD_ERROR = "Couldn't load receipts."

export default function ReceiptsPage() {
  const router = useRouter()
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/receipts', { headers: authHeaders() })
      if (res.status === 401) {
        router.replace('/setup')
        return
      }
      if (!res.ok) throw new Error(LOAD_ERROR)
      const body = (await res.json()) as { items: TimelineItem[] }
      setItems(body.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  /** Ask the server to re-check one pending transfer against the chain now. */
  async function checkAgain(txHash: string) {
    setChecking(txHash)
    setCheckResult(null)
    try {
      const res = await apiFetch(`/api/transfers/${txHash}`, { headers: authHeaders() })
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
    <ScreenShell variant="pushed" title="Receipts" backHref="/vault">
      <p className="sv-body text-fg-muted">
        Every deposit, withdrawal and balance check-in, newest first. A receipt is only shown
        once the chain has confirmed it.
      </p>

      {loading && <LoadingState />}

      {error && (
        <Banner tone="error">
          <p className="sv-label">{LOAD_ERROR}</p>
          <Button
            variant="secondary"
            size="sm"
            fullWidth={false}
            className="self-start"
            onClick={load}
          >
            Try again
          </Button>
        </Banner>
      )}

      {checkResult && <Banner tone="info">{checkResult}</Banner>}

      {!loading && !error && items.length === 0 && (
        <p className="sv-body text-fg-muted">
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
    </ScreenShell>
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
    <li>
      <PixelPanel className="p-4 flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="sv-label">{label}</span>
          <span className={`sv-figure ${item.direction === 'in' ? 'text-mint' : 'text-butter'}`}>
            {item.direction === 'in' ? '+' : '−'}
            {amount} NIM
          </span>
        </div>

        <span className="sv-figure font-mono text-fg-faint sv-break">{item.txHash}</span>
        <span className="sv-label text-fg-faint">{formatWhen(item.at)}</span>

        {item.status === 'included' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="sv-label text-mint">Confirmed in block {item.blockHeight}</span>
            <span className="sv-label text-fg-faint">fee {fee} NIM</span>
            {item.explorerUrl && (
              <a
                href={item.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sv-link"
              >
                View on explorer ↗
              </a>
            )}
          </div>
        )}

        {item.status === 'pending' && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="sv-label text-butter">Pending — not yet confirmed</span>
            <Button
              variant="secondary"
              size="sm"
              fullWidth={false}
              onClick={onCheck}
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Check again'}
            </Button>
          </div>
        )}

        {item.status === 'expired' && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="sv-label text-coral-text">
              Failed{item.failureReason ? ` — ${humanReason(item.failureReason)}` : ''}
            </span>
            {/* `expired` is terminal: the same hash can never settle. Sign a new one. */}
            <ButtonLink
              href={`/vault?direction=${item.direction}&amount=${(item.amountLuna / LUNA_PER_NIM).toFixed(2)}`}
              variant="primary"
              size="sm"
              fullWidth={false}
            >
              Try again
            </ButtonLink>
          </div>
        )}
      </PixelPanel>
    </li>
  )
}

/** A snapshot is a balance reading: no hash exists, so none is rendered. */
function SnapshotRow({ item }: { item: SnapshotItem }) {
  return (
    <li>
      <PixelPanel
        tone="off"
        className="px-4 py-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
      >
        <span className="sv-label text-fg-muted">Balance check-in</span>
        <span className="sv-figure text-fg-soft">
          {(item.balanceLuna / LUNA_PER_NIM).toFixed(2)} NIM
        </span>
        <span className="sv-caption text-fg-faint">{formatWhen(item.at)}</span>
      </PixelPanel>
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

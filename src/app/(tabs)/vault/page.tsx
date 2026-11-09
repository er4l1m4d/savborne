'use client'

/**
 * Savborne — Vault screen
 *
 * The one place money moves. Every number is read from the chain; every
 * failure has a visible state. Earned states are never rendered from a hash:
 * a transfer is only "received" once the server has settled it on chain.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LUNA_PER_NIM } from '@/lib/constants'
import { hostNetwork } from '@/lib/nimiq'
import { readSession } from '@/lib/session'
import { useVault } from '@/lib/vault/useVault'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export default function VaultPage() {
  const {
    vault,
    loading,
    error,
    balanceLuna,
    balanceError,
    transfers,
    lockState,
    hasLocalKey,
    refresh,
    refreshBalance,
    unlock,
    deposit,
    withdraw,
  } = useVault()

  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [depositNim, setDepositNim] = useState('1')
  const [withdrawNim, setWithdrawNim] = useState('0.5')
  const [passphrase, setPassphrase] = useState('')
  const [unlockedMessage, setUnlockedMessage] = useState(false)

  const host = hostNetwork()
  const networkMismatch = vault !== null && vault.network !== host
  const identityAddress = readSession()?.playerAddress ?? null

  // "Try again" on an expired receipt links here with the amount pre-filled.
  // An expired hash is terminal, so the only correct action is a fresh
  // transaction with the same intent — never a re-submit of the old hash.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const amount = params.get('amount')
    const direction = params.get('direction')
    if (!amount) return
    if (direction === 'out') setWithdrawNim(amount)
    else setDepositNim(amount)
  }, [])

  async function handleDeposit() {
    if (!vault) return
    setActionError(null)
    setNotice(null)
    const luna = Math.floor(Number(depositNim) * LUNA_PER_NIM)
    if (!Number.isFinite(luna) || luna <= 0) {
      setActionError('Enter an amount greater than zero.')
      return
    }
    setBusy(true)
    try {
      const settled = await deposit(luna)
      setNotice(
        settled.status === 'included'
          ? 'Deposit received and confirmed on chain.'
          : 'Deposit broadcast. It is included shortly — check your receipts.',
      )
      setDepositNim('1')
    } catch (err) {
      setActionError(describe(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock() {
    setActionError(null)
    try {
      await unlock(passphrase)
      setPassphrase('')
      setUnlockedMessage(true)
      setTimeout(() => setUnlockedMessage(false), 2500)
    } catch (err) {
      setActionError(describe(err))
    }
  }

  async function handleWithdraw() {
    if (!vault) return
    setActionError(null)
    setNotice(null)
    const luna = Math.floor(Number(withdrawNim) * LUNA_PER_NIM)
    if (!Number.isFinite(luna) || luna <= 0) {
      setActionError('Enter an amount greater than zero.')
      return
    }
    setBusy(true)
    try {
      const settled = await withdraw(luna, passphrase)
      setPassphrase('')
      setNotice(
        settled.status === 'included'
          ? 'Withdrawal confirmed on chain.'
          : 'Withdrawal broadcast. It is included shortly.',
      )
    } catch (err) {
      setActionError(describe(err))
    } finally {
      setBusy(false)
    }
  }

  // ── States the local key and the server row can disagree on ────────────────
  if (loading) {
    return (
      <ScreenShell variant="tab" title="Vault" backHref="/">
        <p className="sv-body text-fg-muted">Loading your vault…</p>
      </ScreenShell>
    )
  }

  if (error) {
    return (
      <ScreenShell variant="tab" title="Vault" backHref="/">
        <Banner tone="error">
          <p className="font-bold">Could not load your vault</p>
          <p className="sv-label">{error}</p>
          <Button variant="primary" size="sm" fullWidth={false} onClick={refresh}>
            Retry
          </Button>
        </Banner>
      </ScreenShell>
    )
  }

  if (!vault) {
    return (
      <ScreenShell variant="tab" title="Vault" backHref="/">
        <PixelPanel className="p-4 flex flex-col gap-3">
          <h1 className="sv-heading">No vault yet</h1>
          <p className="sv-body text-fg-muted">
            {hasLocalKey
              ? 'This device has a vault key, but the server has no mapping for it. Create the vault to register it.'
              : 'Create a vault to start saving on chain. It takes a minute and costs nothing.'}
          </p>
          <ButtonLink href="/setup/vault" variant="primary">
            Create my vault
          </ButtonLink>
        </PixelPanel>
      </ScreenShell>
    )
  }

  const balanceNim = balanceLuna === null ? null : balanceLuna / LUNA_PER_NIM
  const settledTransfers = transfers.filter((t) => t.status !== 'expired')

  return (
    <ScreenShell variant="tab" title="Vault" backHref="/">
      <div data-tour="vault">
        <PixelPanel className="p-4 flex flex-col gap-2">
          <span className="sv-section-label text-fg-faint">Vault balance</span>
          {balanceError ? (
            <Banner tone="error">
              <p className="font-bold">Balance unavailable</p>
              <p className="sv-label">{balanceError}</p>
              <Button
                variant="primary"
                size="sm"
                fullWidth={false}
                onClick={refreshBalance}
              >
                Retry
              </Button>
            </Banner>
          ) : balanceNim === null ? (
            <span className="h-9 w-40 bg-surface animate-pulse inline-block" aria-hidden />
          ) : (
            <span className="sv-number-xl">
              {balanceNim.toFixed(2)} <span className="text-lg">NIM</span>
            </span>
          )}
          <span className="sv-figure font-mono text-fg-faint sv-break">{vault.address}</span>
        </PixelPanel>
      </div>

      <ShieldStrip />

      {networkMismatch && (
        <Banner tone="error">
          Your wallet is on <strong>{host}</strong> but this vault is on{' '}
          <strong>{vault.network}</strong>. Switch the wallet network to move funds.
        </Banner>
      )}

      {(vault.backupVerifiedAt === null || !hasLocalKey) && (
        <PixelPanel className="bg-butter-tint p-3 flex flex-col gap-2">
          {vault.backupVerifiedAt === null && (
            <p className="sv-label">
              Deposits are locked until you confirm your backup. This protects your own funds.
            </p>
          )}
          {!hasLocalKey && (
            <p className="sv-label">
              This device has no vault key. Restore it from your 24 words in Settings → Backup.
            </p>
          )}
        </PixelPanel>
      )}

      {balanceLuna === 0 && settledTransfers.length === 0 && (
        <p className="sv-body text-fg-muted">
          Your vault is empty. Deposit 1 NIM to open it and unlock the entry bracket.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="sv-section-label text-mint">Deposit</h2>
        <AmountField
          label="Amount (NIM)"
          value={depositNim}
          onChange={setDepositNim}
          disabled={busy || networkMismatch || vault.backupVerifiedAt === null}
        />
        <Button
          variant="primary"
          data-tour="deposit"
          onClick={handleDeposit}
          disabled={busy || networkMismatch || vault.backupVerifiedAt === null}
        >
          {busy ? 'Waiting for the wallet…' : 'Deposit'}
        </Button>
        <p className="sv-label text-fg-faint">
          Your wallet signs this deposit. Savborne only reads the vault address on chain.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="sv-section-label text-mint">Withdraw</h2>
        <p className="sv-label text-fg-muted sv-break">
          Destination: <br />
          <span className="font-mono">{identityAddress ?? 'your identity account'}</span>
          <br />
          Fixed to the account that owns this vault. A mistyped address is unrecoverable, so v1
          does not allow typing one.
        </p>
        <AmountField
          label="Amount (NIM)"
          value={withdrawNim}
          onChange={setWithdrawNim}
          disabled={busy || networkMismatch || lockState !== 'unlocked'}
        />
        {lockState !== 'unlocked' ? (
          <div className="flex flex-col gap-2">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Vault passphrase"
              className="vpx bg-surface-low p-3 text-base focus:border-mint"
            />
            <Button variant="primary" onClick={handleUnlock} disabled={passphrase.length === 0}>
              Unlock vault
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={handleWithdraw}
            disabled={busy || networkMismatch}
          >
            {busy ? 'Signing…' : 'Withdraw'}
          </Button>
        )}
        {unlockedMessage && <p className="sv-label text-mint">Vault unlocked for this session.</p>}
      </section>

      {actionError && <Banner tone="error">{actionError}</Banner>}
      {notice && <Banner tone="info">{notice}</Banner>}

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Recent movements</h2>
        {transfers.length === 0 ? (
          <p className="sv-label text-fg-faint italic">No deposits yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transfers.slice(0, 8).map((t) => (
              <li key={t.id} className="vpx-soft bg-surface p-3 flex items-center justify-between gap-3">
                <span className="sv-label">{t.direction === 'in' ? 'Deposit' : 'Withdrawal'}</span>
                <span className="sv-label text-fg-muted">{statusLabel(t.status, t.failureReason)}</span>
                <span className="sv-figure">{(t.amountLuna / LUNA_PER_NIM).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-4">
          <Link href="/receipts" className="sv-link">
            Receipts
          </Link>
          <Link href="/profile" className="sv-link">
            Share card &amp; backup
          </Link>
        </div>
      </section>
    </ScreenShell>
  )
}

function ShieldStrip() {
  const [shields, setShields] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { authHeaders } = await import('@/lib/session')
        const res = await fetch('/api/players/me', { headers: authHeaders() })
        if (!res.ok) return
        const body = (await res.json()) as { player: { shields: number } }
        if (!cancelled) setShields(body.player.shields)
      } catch {
        // Non-fatal: the strip simply does not render.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div data-tour="shields" className="flex items-center gap-2">
      <span className="sv-label text-fg-muted">Streak shields</span>
      <span
        className="flex gap-0.5 text-base"
        aria-label={shields === null ? 'Shields loading' : `${shields} of 3 shields`}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className={shields !== null && i < shields ? 'text-mint' : 'text-fg-faint opacity-40'}
          >
            ◈
          </span>
        ))}
      </span>
    </div>
  )
}

function AmountField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sv-label text-fg-faint">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="vpx bg-surface-low p-3 text-base num focus:border-mint disabled:opacity-50"
      />
    </label>
  )
}

function statusLabel(status: string, reason: string | null): string {
  if (status === 'included') return 'Confirmed'
  if (status === 'expired') return `Failed${reason ? ` (${reason})` : ''}`
  return 'Pending'
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

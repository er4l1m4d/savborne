'use client'

/**
 * Savborne — vault backup settings (Settings → Backup)
 *
 * Three actions, all of which touch the vault key and nothing else:
 *
 *   • Show recovery phrase — requires the passphrase, then reveals the 24 words
 *     in a grid with an explicit copy button. The copy exists so a player can
 *     check and back up at any time; it is a deliberate exception to onboarding's
 *     no-clipboard rule, and the grid stays selectable without it.
 *   • Change passphrase — requires the current one, decrypts, re-encrypts with
 *     the new one. The phrase itself never changes, so the vault address does
 *     not either.
 *   • Restore from phrase — the recovery path. Derive the address from 24 typed
 *     words, ask the server which vault this player owns, and only write
 *     locally if the derived address matches. A mismatch writes nothing, so a
 *     fat-fingered phrase can never overwrite a working key with a wrong one.
 */

import { useState } from 'react'
import { authHeaders, readSession } from '@/lib/session'
import type { Network } from '@/lib/nimiq'
import type { VaultDto } from '@/lib/vault/dto'
import { decryptPhrase, encryptPhrase } from '@/lib/vault/crypto'
import { phraseMatchesVault } from '@/lib/vault/phrase'
import { readVault, writeVault } from '@/lib/vault/storage'
import { VaultLockedError } from '@/lib/vault/errors'
import { CopyButton } from './CopyButton'
import { Button } from '@/components/ui/Button'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Banner } from '@/components/ui/Banner'
import { apiFetch } from '@/lib/client-session'

type Phase = 'closed' | 'show' | 'change' | 'restore'

export function BackupSettings() {
  const [phase, setPhase] = useState<Phase>('closed')
  const [passphrase, setPassphrase] = useState('')
  const [newPassphrase, setNewPassphrase] = useState('')
  const [restoreWords, setRestoreWords] = useState('')
  const [revealed, setRevealed] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const session = readSession()
  const playerAddress = session?.playerAddress ?? null

  function reset() {
    setPassphrase('')
    setNewPassphrase('')
    setRestoreWords('')
    setMessage(null)
    setError(null)
  }

  function close() {
    setPhase('closed')
    setRevealed(null)
    reset()
  }

  async function showPhrase() {
    if (!playerAddress) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const local = readVault(playerAddress)
      if (!local) throw new Error('This device has no vault key to show.')
      const phrase = await decryptPhrase(local.blob, passphrase)
      setRevealed(phrase)
      setPassphrase('')
    } catch (err) {
      setError(describe(err))
    } finally {
      setBusy(false)
    }
  }

  async function changePassphrase() {
    if (!playerAddress) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const local = readVault(playerAddress)
      if (!local) throw new Error('This device has no vault key to change.')
      if (newPassphrase.length < 8) throw new Error('The new passphrase must be at least 8 characters.')
      const phrase = await decryptPhrase(local.blob, passphrase)
      const blob = await encryptPhrase(phrase, newPassphrase)
      writeVault(playerAddress, { ...local, blob })
      setPassphrase('')
      setNewPassphrase('')
      setMessage('Passphrase changed. Your vault address is unchanged.')
    } catch (err) {
      setError(describe(err))
    } finally {
      setBusy(false)
    }
  }

  async function restore() {
    if (!playerAddress) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const words = restoreWords.trim().split(/\s+/)
      if (words.length !== 24) throw new Error('Enter all 24 words, separated by spaces.')
      if (newPassphrase.length < 8) throw new Error('Choose a passphrase of at least 8 characters.')

      // 1. Ask the server which vault this player owns.
      const res = await apiFetch('/api/vaults', { headers: authHeaders() })
      if (!res.ok) throw new Error(`Could not check your vault (${res.status}).`)
      const body = (await res.json()) as { vault: VaultDto | null }
      if (!body.vault) throw new Error('Create a vault before restoring one.')

      // 2. Write nothing unless the words control the registered vault. The
      // same helper gates account deletion, so both paths agree on what a
      // match means (including spacing and case).
      if (!(await phraseMatchesVault(words, body.vault.address))) {
        throw new Error(
          'Those words do not control this vault. Nothing was saved. Check the order and try again.',
        )
      }

      const blob = await encryptPhrase(words, newPassphrase)
      writeVault(playerAddress, {
        version: 1,
        address: body.vault.address,
        network: body.vault.network as Network,
        createdAt: new Date().toISOString(),
        blob,
      })
      setRestoreWords('')
      setNewPassphrase('')
      setMessage('Vault restored on this device.')
    } catch (err) {
      setError(describe(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="sv-section-label text-mint">Backup</h2>

      {phase === 'closed' && (
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => { reset(); setPhase('show') }}
          >
            Show recovery phrase
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => { reset(); setPhase('change') }}
          >
            Change passphrase
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => { reset(); setPhase('restore') }}
          >
            Restore from phrase
          </Button>
        </div>
      )}

      {phase === 'show' && (
        <PixelPanel className="p-4 flex flex-col gap-3">
          {revealed ? (
            <>
              <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {revealed.map((word, i) => (
                  <li key={i} className="vpx bg-surface-low p-2 flex items-baseline gap-2 font-mono text-sm select-text">
                    <span className="sv-figure text-fg-faint w-5 text-right shrink-0">{i + 1}</span>
                    <span className="break-all">{word}</span>
                  </li>
                ))}
              </ol>
              <p className="sv-label text-fg-muted">
                Anyone with these words controls your vault. Write them down somewhere offline.
              </p>
              <CopyButton text={revealed.join(' ')} />
            </>
          ) : (
            <>
              <PassphraseInput
                label="Enter your vault passphrase to reveal the words"
                value={passphrase}
                onChange={setPassphrase}
              />
              <ActionButton onClick={showPhrase} disabled={busy || passphrase.length === 0} variant="primary">
                {busy ? 'Unlocking…' : 'Reveal words'}
              </ActionButton>
            </>
          )}
          {error && <Banner tone="error">{error}</Banner>}
          <BackButton onClick={close} />
        </PixelPanel>
      )}

      {phase === 'change' && (
        <PixelPanel className="p-4 flex flex-col gap-3">
          <PassphraseInput label="Current passphrase" value={passphrase} onChange={setPassphrase} />
          <PassphraseInput label="New passphrase" value={newPassphrase} onChange={setNewPassphrase} />
          <ActionButton onClick={changePassphrase} disabled={busy || !passphrase || !newPassphrase}>
            {busy ? 'Re-encrypting…' : 'Change passphrase'}
          </ActionButton>
          {error && <Banner tone="error">{error}</Banner>}
          <BackButton onClick={close} />
        </PixelPanel>
      )}

      {phase === 'restore' && (
        <PixelPanel className="p-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="sv-label text-fg-faint">Your 24 words, in order</span>
            <textarea
              value={restoreWords}
              onChange={(e) => setRestoreWords(e.target.value)}
              rows={3}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="vpx bg-surface-low p-3 text-sm font-mono focus:border-mint"
            />
          </label>
          <PassphraseInput label="New passphrase (min 8 characters)" value={newPassphrase} onChange={setNewPassphrase} />
          <ActionButton onClick={restore} disabled={busy || !restoreWords || !newPassphrase}>
            {busy ? 'Checking…' : 'Restore vault'}
          </ActionButton>
          {error && <Banner tone="error">{error}</Banner>}
          <BackButton onClick={close} />
        </PixelPanel>
      )}

      {message && <Banner tone="info">{message}</Banner>}
    </section>
  )
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'secondary',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}) {
  return (
    <Button variant={variant} onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} className="self-start">
      Back
    </Button>
  )
}

function PassphraseInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sv-label text-fg-faint">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="vpx bg-surface-low p-3 text-base focus:border-mint"
      />
    </label>
  )
}

function describe(err: unknown): string {
  if (err instanceof VaultLockedError) return 'Wrong passphrase.'
  return err instanceof Error ? err.message : String(err)
}

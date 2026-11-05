'use client'

/**
 * Savborne — delete account, gated on vault access
 *
 * Deleting the profile does not move or destroy the on-chain vault. The 24-word
 * phrase is the only key to the funds, so the player must prove they still hold
 * it before the delete button exists:
 *
 *   local vault       → passphrase, reveal, copy, acknowledge, 4-word quiz
 *   server-only vault → type all 24 words; the derived address must match
 *   no vault          → nothing to protect, straight to the confirmation
 *
 * If the words cannot be produced, deletion is blocked. That is the point: a
 * player who has lost their backup should not lose their funds in the same tap.
 *
 * The server call is destructive and the API's only other identity signal is an
 * address header, so the final step also asks the wallet to sign a message
 * naming this address and this account's creation time. A stolen header alone
 * cannot delete an account. The call remains idempotent (`{ deleted: false }`
 * for an already-gone row), so a retry after a dropped response is safe.
 */

import { useState } from 'react'
import { authHeaders, readSession, writeSession } from '@/lib/session'
import { clearVault, readVault } from '@/lib/vault/storage'
import { decryptPhrase } from '@/lib/vault/crypto'
import { phraseMatchesVault } from '@/lib/vault/phrase'
import { VaultLockedError } from '@/lib/vault/errors'
import { deleteAuthHeaders, deleteMessage } from '@/lib/delete-request'
import { signMessage } from '@/lib/nimiq'
import { TOUR_FLAG_KEY } from '@/components/VaultTour'
import { deletionGate, type DeletionGate } from '@/lib/account-deletion'
import { BackupQuiz } from './vault/BackupQuiz'
import { CopyButton } from './vault/CopyButton'
import { Button } from './ui/Button'
import { PixelPanel } from './ui/PixelPanel'
import { Banner } from './ui/Banner'

type Phase = 'closed' | 'checking' | DeletionGate | 'reveal' | 'quiz'

export function DeleteAccount({ playerAddress }: { playerAddress: string }) {
  const [phase, setPhase] = useState<Phase>('closed')
  const [passphrase, setPassphrase] = useState('')
  const [revealed, setRevealed] = useState<string[] | null>(null)
  const [typedWords, setTypedWords] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)
  const [vaultAddress, setVaultAddress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setPhase('closed')
    setPassphrase('')
    setRevealed(null)
    setTypedWords('')
    setAcknowledged(false)
    setCopied(false)
    setVaultAddress(null)
    setError(null)
  }

  /** Decide which proof the player has to give before anything is deleted. */
  async function start() {
    setPhase('checking')
    setError(null)
    try {
      const res = await fetch('/api/vaults', { headers: authHeaders() })
      if (!res.ok) throw new Error(`Could not check your vault (${res.status}).`)
      const body = (await res.json()) as { vault: { address: string } | null }

      setVaultAddress(body.vault?.address ?? null)
      setPhase(deletionGate(readVault(playerAddress) !== null, body.vault !== null))
    } catch (err) {
      setError(describe(err))
      setPhase('closed')
    }
  }

  async function unlock() {
    setBusy(true)
    setError(null)
    try {
      const local = readVault(playerAddress)
      if (!local) throw new Error('This device has no vault key to reveal.')
      const phrase = await decryptPhrase(local.blob, passphrase)
      setRevealed(phrase)
      setPassphrase('')
      setAcknowledged(false)
      setCopied(false)
      setPhase('reveal')
    } catch (err) {
      setError(describe(err))
    } finally {
      setBusy(false)
    }
  }

  async function verifyTypedWords() {
    setBusy(true)
    setError(null)
    try {
      const words = typedWords.trim().split(/\s+/)
      if (words.length !== 24) throw new Error('Enter all 24 words, separated by spaces.')
      if (!vaultAddress) throw new Error('This account has no registered vault to match.')

      if (!(await phraseMatchesVault(words, vaultAddress))) {
        throw new Error(
          'Those words do not control this vault. Check the order and try again.',
        )
      }

      // Drop the plaintext from component state as soon as it has served its purpose.
      setTypedWords('')
      setPhase('confirm')
    } catch (err) {
      setError(describe(err))
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount() {
    setBusy(true)
    setError(null)
    try {
      // The proof signs the account's creation time; the server checks it
      // against the stored row, so fetch the canonical value first.
      const meRes = await fetch('/api/players/me', { headers: authHeaders() })
      if (!meRes.ok) throw new Error(`Could not confirm your account (${meRes.status}).`)
      const me = (await meRes.json()) as { player?: { createdAt?: string } }
      const createdAt = me.player?.createdAt
      if (!createdAt) throw new Error('Could not confirm your account.')

      // Sign the same address the request will carry.
      const address = readSession()?.playerAddress ?? playerAddress
      const signedAt = Date.now()
      const message = deleteMessage({ address, createdAt, signedAt })
      const proof = await signMessage(message)

      const res = await fetch('/api/players/me', {
        method: 'DELETE',
        headers: authHeaders(deleteAuthHeaders({ ...proof, signedAt })),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(deleteErrorMessage(body?.error, res.status))
      }

      clearVault(playerAddress)
      writeSession(null)
      try {
        window.localStorage.removeItem(TOUR_FLAG_KEY)
      } catch {
        // Non-fatal.
      }
      // A hard navigation drops every cached hook and the deleted player state.
      // `busy` stays true on purpose: this component is about to unmount.
      window.location.replace('/setup')
    } catch (err) {
      setError(describe(err))
      // A failed delete must leave the button usable for a retry.
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="sv-section-label text-coral-text">Account</h2>

      {phase === 'closed' && (
        <Button variant="destructive" className="justify-start" onClick={start}>
          Delete account
        </Button>
      )}

      {phase === 'checking' && (
        <PixelPanel className="p-4">
          <p className="sv-body text-fg-muted">Checking your vault…</p>
        </PixelPanel>
      )}

      {phase === 'unlock' && (
        <PixelPanel className="p-4 flex flex-col gap-3">
          <p className="sv-body text-fg-muted">
            Before deleting, prove you can reach your vault without Savborne. Enter your vault
            passphrase to reveal the 24 words.
          </p>
          <label className="flex flex-col gap-1">
            <span className="sv-label text-fg-faint">Vault passphrase</span>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="off"
              className="vpx bg-surface-low p-3 text-base focus:border-mint"
            />
          </label>
          <Button
            variant="primary"
            onClick={unlock}
            disabled={busy || passphrase.length === 0}
          >
            {busy ? 'Unlocking…' : 'Reveal words'}
          </Button>
          {error && <Banner tone="error">{error}</Banner>}
          <BackLink onClick={reset} label="Cancel" />
        </PixelPanel>
      )}

      {phase === 'reveal' && revealed && (
        <PixelPanel className="p-4 flex flex-col gap-3">
          <h3 className="sv-section-label text-foreground">Your 24 words</h3>
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {revealed.map((word, i) => (
              <li
                key={i}
                className="vpx bg-surface-low p-2 flex items-baseline gap-2 font-mono text-sm select-text"
              >
                <span className="sv-figure text-fg-faint w-5 text-right shrink-0">{i + 1}</span>
                <span className="break-all">{word}</span>
              </li>
            ))}
          </ol>
          <p className="sv-label text-fg-muted">
            These words control your vault outside Savborne. Copy them and store them somewhere
            offline. The clipboard is shared with other apps — clear it afterwards.
          </p>
          <CopyButton text={revealed.join(' ')} onResult={setCopied} />
          <label className="flex items-start gap-2 sv-label text-fg-muted">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>I have written down these 24 words and can reach this vault without Savborne.</span>
          </label>
          <Button
            variant="primary"
            onClick={() => setPhase('quiz')}
            disabled={!acknowledged || !copied}
          >
            Continue
          </Button>
          {!copied && (
            <p className="sv-label text-fg-faint">
              Copy your words first — that is the only proof this device still has them.
            </p>
          )}
          <BackLink onClick={() => setPhase('unlock')} label="Back" />
        </PixelPanel>
      )}

      {phase === 'quiz' && revealed && (
        <PixelPanel className="p-4">
          <BackupQuiz
            phrase={revealed}
            inline
            onPass={() => setPhase('confirm')}
            onBack={() => setPhase('reveal')}
          />
        </PixelPanel>
      )}

      {phase === 'type-words' && (
        <PixelPanel className="p-4 flex flex-col gap-3">
          <p className="sv-body text-fg-muted">
            This device has no vault key, but your account has a vault. Type all 24 words to prove
            you can reach it outside Savborne.
          </p>
          <label className="flex flex-col gap-1">
            <span className="sv-label text-fg-faint">Your 24 words, in order</span>
            <textarea
              value={typedWords}
              onChange={(e) => setTypedWords(e.target.value)}
              rows={4}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="vpx bg-surface-low p-3 text-sm font-mono focus:border-mint"
            />
          </label>
          <Button
            variant="primary"
            onClick={verifyTypedWords}
            disabled={busy || typedWords.trim().length === 0}
          >
            {busy ? 'Checking…' : 'Verify words'}
          </Button>
          {error && <Banner tone="error">{error}</Banner>}
          <BackLink onClick={reset} label="Cancel" />
        </PixelPanel>
      )}

      {phase === 'confirm' && (
        <PixelPanel tone="coral" className="p-4 flex flex-col gap-3">
          <p className="sv-subheading text-coral-text">Delete this account permanently?</p>
          <p className="sv-label text-fg-muted">
            This removes your profile, level, streak, items, badges, check-ins and battle history
            from the server. The NIM in your vault stays on-chain and is controlled by the 24 words
            you just confirmed. Onboarding again creates a new vault.
          </p>
          <Button variant="primary" onClick={deleteAccount} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete everything'}
          </Button>
          <BackLink onClick={reset} label="Cancel" />
        </PixelPanel>
      )}

      {error && phase === 'closed' && <Banner tone="error">{error}</Banner>}

      <p className="sv-label text-fg-faint">
        Deleting does not move or destroy NIM. Your vault phrase remains the only key to the funds.
      </p>
    </section>
  )
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="ghost" onClick={onClick} className="self-start">
      {label}
    </Button>
  )
}

function describe(err: unknown): string {
  if (err instanceof VaultLockedError) return 'Wrong passphrase.'
  return err instanceof Error ? err.message : String(err)
}

/** Turn a server error code into something a player can act on. */
function deleteErrorMessage(code: string | undefined, status: number): string {
  switch (code) {
    case 'missing':
      return 'Nimiq Pay did not sign the request. Try again.'
    case 'stale':
      return 'Confirming took too long. Try again.'
    case 'malformed':
    case 'bad_signature':
      return 'The wallet signature did not match this account. Try again.'
    case 'wrong_signer':
      return 'Nimiq Pay signed with a different account. Switch back to this one and try again.'
    default:
      return `Delete failed (${status}).`
  }
}

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
      <h2 className="text-sm font-bold uppercase tracking-widest text-coral-text">Account</h2>

      {phase === 'closed' && (
        <button
          type="button"
          onClick={start}
          className="vpx-soft bg-surface py-3 px-4 font-bold text-sm text-left text-coral-text"
        >
          Delete account
        </button>
      )}

      {phase === 'checking' && (
        <div className="vpx bg-surface p-4 text-sm text-fg-muted">Checking your vault…</div>
      )}

      {phase === 'unlock' && (
        <div className="vpx bg-surface p-4 flex flex-col gap-3">
          <p className="text-sm text-fg-muted leading-relaxed">
            Before deleting, prove you can reach your vault without Savborne. Enter your vault
            passphrase to reveal the 24 words.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-faint">Vault passphrase</span>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="off"
              className="vpx bg-surface-low p-3 text-base outline-none focus:border-butter"
            />
          </label>
          <button
            type="button"
            onClick={unlock}
            disabled={busy || passphrase.length === 0}
            className="vpx bg-mint text-background py-3 px-4 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Unlocking…' : 'Reveal words'}
          </button>
          {error && <Note>{error}</Note>}
          <BackLink onClick={reset} label="Cancel" />
        </div>
      )}

      {phase === 'reveal' && revealed && (
        <div className="vpx bg-surface p-4 flex flex-col gap-3">
          <h3 className="text-base font-bold text-foreground">Your 24 words</h3>
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {revealed.map((word, i) => (
              <li
                key={i}
                className="vpx bg-surface-low p-2 flex items-baseline gap-2 font-mono text-sm select-text"
              >
                <span className="text-fg-faint text-[11px] w-5 text-right shrink-0">{i + 1}</span>
                <span className="break-all">{word}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-fg-muted">
            These words control your vault outside Savborne. Copy them and store them somewhere
            offline. The clipboard is shared with other apps — clear it afterwards.
          </p>
          <CopyButton text={revealed.join(' ')} onResult={setCopied} />
          <label className="flex items-start gap-2 text-xs text-fg-muted leading-relaxed">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>I have written down these 24 words and can reach this vault without Savborne.</span>
          </label>
          <button
            type="button"
            onClick={() => setPhase('quiz')}
            disabled={!acknowledged || !copied}
            className="vpx bg-mint text-background py-3 px-4 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
          {!copied && (
            <p className="text-[11px] text-fg-faint">
              Copy your words first — that is the only proof this device still has them.
            </p>
          )}
          <BackLink onClick={() => setPhase('unlock')} label="Back" />
        </div>
      )}

      {phase === 'quiz' && revealed && (
        <div className="vpx bg-surface p-4">
          <BackupQuiz
            phrase={revealed}
            inline
            onPass={() => setPhase('confirm')}
            onBack={() => setPhase('reveal')}
          />
        </div>
      )}

      {phase === 'type-words' && (
        <div className="vpx bg-surface p-4 flex flex-col gap-3">
          <p className="text-sm text-fg-muted leading-relaxed">
            This device has no vault key, but your account has a vault. Type all 24 words to prove
            you can reach it outside Savborne.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-faint">Your 24 words, in order</span>
            <textarea
              value={typedWords}
              onChange={(e) => setTypedWords(e.target.value)}
              rows={4}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="vpx bg-surface-low p-3 text-sm font-mono outline-none focus:border-butter"
            />
          </label>
          <button
            type="button"
            onClick={verifyTypedWords}
            disabled={busy || typedWords.trim().length === 0}
            className="vpx bg-mint text-background py-3 px-4 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Checking…' : 'Verify words'}
          </button>
          {error && <Note>{error}</Note>}
          <BackLink onClick={reset} label="Cancel" />
        </div>
      )}

      {phase === 'confirm' && (
        <div className="vpx bg-coral-tint p-4 flex flex-col gap-3">
          <p className="text-sm text-coral-text font-bold leading-relaxed">
            Delete this account permanently?
          </p>
          <p className="text-xs text-fg-muted leading-relaxed">
            This removes your profile, level, streak, items, badges, check-ins and battle history
            from the server. The NIM in your vault stays on-chain and is controlled by the 24 words
            you just confirmed. Onboarding again creates a new vault.
          </p>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={busy}
            className="vpx bg-coral text-background py-3 px-4 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-0.5"
            style={{ boxShadow: '0 3px 0 var(--coral-edge)' }}
          >
            {busy ? 'Deleting…' : 'Delete everything'}
          </button>
          <BackLink onClick={reset} label="Cancel" />
        </div>
      )}

      {error && phase === 'closed' && <Note>{error}</Note>}

      <p className="text-[11px] text-fg-faint leading-relaxed">
        Deleting does not move or destroy NIM. Your vault phrase remains the only key to the funds.
      </p>
    </section>
  )
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-fg-muted underline underline-offset-4 self-start"
    >
      {label}
    </button>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="vpx p-3 text-sm bg-coral-tint text-coral-text">{children}</div>
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

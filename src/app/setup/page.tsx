/**
 * Savborne — Onboarding wizard
 *
 * Five sequential steps, one screen each:
 *   1. Welcome — the non-custodial claim, and nothing else.
 *   2. Create vault — pick the identity account, generate the 24 words on
 *      device, derive the vault address. Nothing is persisted yet.
 *   3. Backup gate — show the words, acknowledge, quiz 4 positions, set a
 *      passphrase. Only then is the encrypted vault written to localStorage.
 *   4. Privacy notice — corrected for the vault.
 *   5. Character name — one request creates the player row and the vault row.
 *
 * Why the vault is not written in step 2: `vaults.player_address` references
 * `players(address)`, and the player row does not exist until step 5.
 * Persisting earlier would violate the foreign key or force a placeholder.
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listAccounts, hostNetwork, WalletError } from '@/lib/nimiq'
import { writeSession } from '@/lib/session'
import type { Network } from '@/lib/nimiq'
import { encryptPhrase } from '@/lib/vault/crypto'
import { deriveVaultAddress, generatePhrase } from '@/lib/vault/phrase'
import { writeVault } from '@/lib/vault/storage'
import { PhraseCeremony } from '@/components/vault/PhraseCeremony'
import { BackupQuiz } from '@/components/vault/BackupQuiz'
import { PassphraseField } from '@/components/vault/PassphraseField'

type Step = 1 | 2 | 3 | 4 | 5
type BackupPhase = 'show' | 'quiz' | 'passphrase'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [backupPhase, setBackupPhase] = useState<BackupPhase>('show')

  const [accounts, setAccounts] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [vaultAddress, setVaultAddress] = useState<string | null>(null)
  const [phrase, setPhrase] = useState<string[] | null>(null)
  const network = useMemo<Network>(() => hostNetwork(), [])

  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load accounts when step 2 opens. `listAccounts()` shows the approval
  // dialog the first time; subsequent calls in the same session are silent.
  useEffect(() => {
    if (step !== 2 || accounts.length > 0) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await listAccounts()
        if (!cancelled) setAccounts(list)
      } catch (err) {
        if (!cancelled) setError(describe(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step, accounts.length])

  /** Step 2 → generate the phrase and derive the vault address on device. */
  async function createVault(identityAddress: string) {
    setPicked(identityAddress)
    setLoading(true)
    setError(null)
    try {
      const words = await generatePhrase()
      const address = await deriveVaultAddress(words)
      setPhrase(words)
      setVaultAddress(address)
      setStep(3)
    } catch (err) {
      setError(describe(err))
    } finally {
      setLoading(false)
    }
  }

  /** Step 3 → encrypt at rest, then drop the plaintext phrase. */
  async function lockVault(passphrase: string) {
    if (!picked || !vaultAddress || !phrase) return
    setLoading(true)
    setError(null)
    try {
      const blob = await encryptPhrase(phrase, passphrase)
      writeVault(picked, {
        version: 1,
        address: vaultAddress,
        network,
        createdAt: new Date().toISOString(),
        blob,
      })
      // Drop the plaintext. The passphrase only ever lived in the child field.
      setPhrase(null)
      setStep(4)
    } catch (err) {
      setError(describe(err))
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    if (!picked || !vaultAddress) return
    if (displayName.trim().length < 1) {
      setError('Please choose a character name.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: picked,
          displayName: displayName.trim(),
          vaultAddress,
          network,
          backupVerified: true,
        }),
      })

      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (body.error === 'vault_exists') {
          throw new Error(
            'This wallet already has a vault. Open the Vault tab to restore it from your 24 words.',
          )
        }
        if (body.error === 'vault_taken') {
          throw new Error('That vault address is already registered. Create a new vault.')
        }
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Setup failed (${res.status}): ${text}`)
      }

      // The vault goes in the savings slot so the existing home screen shows
      // the real vault balance without being edited.
      writeSession({
        playerAddress: picked,
        savingsAddress: vaultAddress,
        displayName: displayName.trim(),
      })
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh flex flex-col p-(--gut) max-w-105 mx-auto w-full gap-6">
      <ProgressBar step={step} />

      {step === 1 && <StepWelcome onNext={() => setStep(2)} />}

      {step === 2 && (
        <StepCreateVault
          accounts={accounts}
          loading={loading}
          error={error}
          onPick={createVault}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && phrase && (
        <>
          {backupPhase === 'show' && (
            <PhraseCeremony
              phrase={phrase}
              onContinue={() => setBackupPhase('quiz')}
              onBack={() => setStep(2)}
            />
          )}
          {backupPhase === 'quiz' && (
            <BackupQuiz
              phrase={phrase}
              onPass={() => setBackupPhase('passphrase')}
              onBack={() => setBackupPhase('show')}
            />
          )}
          {backupPhase === 'passphrase' && (
            <section className="flex flex-col gap-4 mt-4">
              <h1
                className="text-3xl leading-none"
                style={{ fontFamily: 'var(--font-silkscreen)' }}
              >
                Lock your vault
              </h1>
              <PassphraseField onSet={lockVault} />
              {error && <ErrorNote>{error}</ErrorNote>}
              {loading && <StatusNote>Encrypting…</StatusNote>}
              <BackButton onClick={() => setBackupPhase('quiz')} disabled={loading} />
            </section>
          )}
        </>
      )}

      {step === 4 && (
        <StepPrivacy
          vaultAddress={vaultAddress ?? ''}
          onContinue={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      )}

      {step === 5 && (
        <StepName
          value={displayName}
          onChange={setDisplayName}
          loading={loading}
          error={error}
          onSubmit={submit}
          onBack={() => setStep(4)}
        />
      )}
    </main>
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <Section title="Welcome">
      <p>
        Savborne turns your NIM savings into a role-playing game. Check in daily, grow your
        vault, and your balance becomes XP, items, streaks, and rank.
      </p>
      <p className="text-fg-muted">
        Your NIM lives in a vault only you control. Savborne never holds your money, never
        holds your key, and cannot move a single luna without you signing.
      </p>
      <PrimaryButton onClick={onNext}>Create my vault</PrimaryButton>
    </Section>
  )
}

function StepCreateVault({
  accounts,
  loading,
  error,
  onPick,
  onBack,
}: {
  accounts: string[]
  loading: boolean
  error: string | null
  onPick: (a: string) => void
  onBack: () => void
}) {
  return (
    <Section title="Create your vault">
      <p className="text-fg-muted">
        First, choose the wallet account that identifies you. Your vault is a separate
        address, generated on this device from 24 words you will write down next.
      </p>

      {loading && <StatusNote>Loading accounts…</StatusNote>}
      {!loading && accounts.length === 0 && (
        <StatusNote>
          Connect a wallet in Nimiq Pay, then come back. No account was returned.
        </StatusNote>
      )}
      {!loading &&
        accounts.map((a) => (
          <button
            key={a}
            onClick={() => onPick(a)}
            className="vpx bg-surface p-3 text-left text-sm font-mono break-all hover:bg-surface-hi transition-colors"
          >
            {a}
          </button>
        ))}

      {error && <ErrorNote>{error}</ErrorNote>}
      <BackButton onClick={onBack} />
    </Section>
  )
}

function StepPrivacy({
  vaultAddress,
  onContinue,
  onBack,
}: {
  vaultAddress: string
  onContinue: () => void
  onBack: () => void
}) {
  return (
    <Section title="Privacy notice">
      <div className="vpx-soft bg-surface-low p-4 flex flex-col gap-2 text-sm text-fg-soft">
        <p>
          <strong>What we collect.</strong> Your wallet address, your vault address, one
          balance snapshot each time you check in, and game data (XP, missions, items,
          badges, battle results). Your display name is stored for the leaderboard.
        </p>
        <p>
          <strong>What we do NOT collect.</strong> Your 24 words, your vault passphrase, or
          any data that would let us move or lock your funds. The key exists only on this
          device, encrypted.
        </p>
        <p>
          <strong>What is public.</strong> Your display name, bracket, level, and leaderboard
          score. Your balance is never shown to other players.
        </p>
        <p>
          <strong>Where it is stored.</strong> Supabase (US-East) and Vercel. You can request
          deletion by emailing the contact in the app footer.
        </p>
        <p>
          <strong>The risk you are accepting.</strong> If you lose your 24 words and this
          device, the NIM in your vault is unrecoverable. Savborne cannot restore it.
        </p>
      </div>

      <p className="text-sm text-fg-muted">
        Your vault address is <span className="font-mono">{short(vaultAddress)}</span>.
      </p>

      <PrimaryButton onClick={onContinue}>I understand — Continue</PrimaryButton>
      <BackButton onClick={onBack} />
    </Section>
  )
}

function StepName({
  value,
  onChange,
  loading,
  error,
  onSubmit,
  onBack,
}: {
  value: string
  onChange: (v: string) => void
  loading: boolean
  error: string | null
  onSubmit: () => void
  onBack: () => void
}) {
  const valid = useMemo(() => value.trim().length >= 1 && value.trim().length <= 32, [value])
  return (
    <Section title="Pick your character name">
      <p className="text-fg-muted">
        This is your display name on the leaderboard. Other players see it in ranked
        battles. You cannot change it later in v1.
      </p>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="32 characters max"
        maxLength={32}
        className="vpx bg-surface-low p-3 text-base text-foreground outline-none focus:border-butter"
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <PrimaryButton disabled={!valid || loading} onClick={onSubmit}>
        {loading ? 'Creating your vault…' : 'Start saving'}
      </PrimaryButton>
      <BackButton onClick={onBack} disabled={loading} />
    </Section>
  )
}

// ─── Atoms ────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 mt-4">
      <h1
        className="text-3xl leading-none"
        style={{ fontFamily: 'var(--font-silkscreen)' }}
      >
        {title}
      </h1>
      {children}
    </section>
  )
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="vpx bg-mint text-[#0E1D19] py-3 px-4 font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-0.5"
      style={{ boxShadow: '0 3px 0 var(--bevel-shadow)' }}
    >
      {children}
    </button>
  )
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-sm text-fg-muted underline underline-offset-4 self-start disabled:opacity-40"
    >
      Back
    </button>
  )
}

function StatusNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-fg-faint italic">{children}</p>
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return <div className="vpx bg-coral-tint p-3 text-sm text-coral-text">{children}</div>
}

function ProgressBar({ step }: { step: Step }) {
  const steps = ['Welcome', 'Vault', 'Backup', 'Privacy', 'Name']
  return (
    <ol className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-widest text-fg-faint mt-4">
      {steps.map((label, i) => {
        const idx = (i + 1) as Step
        const active = idx === step
        const done = idx < step
        return (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 ${
                done ? 'bg-mint' : active ? 'bg-butter' : 'bg-line'
              }`}
              aria-hidden
            />
            <span className={active ? 'text-fg font-bold' : done ? 'text-mint' : ''}>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function short(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

function describe(err: unknown): string {
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

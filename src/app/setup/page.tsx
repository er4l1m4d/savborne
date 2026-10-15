/**
 * Savborne — Onboarding wizard
 *
 * Four sequential steps, one screen each:
 *   1. Welcome — explains what Savborne does, single "Connect Savings Account" button.
 *   2. Pick account — calls `listAccounts()`, user selects one.
 *   3. Privacy notice — full text with a dedicated "Continue" button. Deliberately
 *      kept separate from the wallet approval step so consent is unambiguous.
 *   4. Character name — free-text display name, 1–32 chars, saved to the player row.
 *
 * On final submit we POST /api/players with the initial balance from the picked
 * savings account, persist the session, and redirect home.
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBalance, listAccounts, WalletError } from '@/lib/nimiq'
import { writeSession } from '@/lib/session'
import { LUNA_PER_NIM } from '@/lib/constants'

type Step = 1 | 2 | 3 | 4

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [accounts, setAccounts] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [pickedBalanceLuna, setPickedBalanceLuna] = useState<number | null>(null)
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

  async function pickAccount(address: string) {
    setPicked(address)
    setLoading(true)
    setError(null)
    try {
      const luna = await getBalance(address)
      setPickedBalanceLuna(luna)
      setStep(3)
    } catch (err) {
      setError(describe(err))
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    if (!picked || pickedBalanceLuna === null) return
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
          savingsAddress: picked,
          displayName: displayName.trim(),
          initialBalanceLuna: pickedBalanceLuna,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Setup failed (${res.status}): ${text}`)
      }
      writeSession({
        playerAddress: picked,
        savingsAddress: picked,
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
    <main className="min-h-dvh flex flex-col p-[var(--gut)] max-w-[420px] mx-auto w-full gap-6">
      <ProgressBar step={step} />

      {step === 1 && <StepWelcome onNext={() => setStep(2)} />}
      {step === 2 && (
        <StepPickAccount
          accounts={accounts}
          loading={loading}
          error={error}
          onPick={pickAccount}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <StepPrivacy
          savingsAddress={picked ?? ''}
          balanceNim={
            pickedBalanceLuna === null ? null : pickedBalanceLuna / LUNA_PER_NIM
          }
          onContinue={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && (
        <StepName
          value={displayName}
          onChange={setDisplayName}
          loading={loading}
          error={error}
          onSubmit={submit}
          onBack={() => setStep(3)}
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
        Savborne turns your NIM savings into a role-playing game. Connect one
        dedicated savings account, check in daily, and your balance grows XP,
        items, streaks, and rank.
      </p>
      <p className="text-fg-muted">
        Savborne never holds, moves, or controls your money. It only reads the
        balance of the account you choose.
      </p>
      <PrimaryButton onClick={onNext}>Connect Savings Account</PrimaryButton>
    </Section>
  )
}

function StepPickAccount({
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
    <Section title="Choose your savings account">
      <p className="text-fg-muted">
        Pick the account you want Savborne to track. Any account you own works,
        but a dedicated savings account keeps the game honest — withdrawals
        reduce your bracket but never remove your XP or items.
      </p>

      {loading && <StatusNote>Loading accounts…</StatusNote>}
      {!loading && accounts.length === 0 && (
        <StatusNote>
          No accounts returned. Approve the wallet prompt in Nimiq Pay, or add a
          Nimiq account to your wallet first.
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
  savingsAddress,
  balanceNim,
  onContinue,
  onBack,
}: {
  savingsAddress: string
  balanceNim: number | null
  onContinue: () => void
  onBack: () => void
}) {
  return (
    <Section title="Privacy notice">
      <div className="vpx-soft bg-surface-low p-4 flex flex-col gap-2 text-sm text-fg-soft">
        <p><strong>What we collect.</strong> Your Nimiq address, the savings account you connect, one balance snapshot each time you check in, and game data (XP, missions, items, badges, battle results). Your display name is stored for the leaderboard.</p>
        <p><strong>What we do NOT collect.</strong> Private keys, recovery phrase, other account balances, or any data that would let us move or lock your funds.</p>
        <p><strong>What is public.</strong> Your display name, bracket, level, and leaderboard score. Your balance is never shown to other players.</p>
        <p><strong>Where it is stored.</strong> Supabase (US-East) and Vercel. You can disconnect at any time, or request deletion by emailing the contact listed in the app footer.</p>
        <p><strong>Withdrawals.</strong> Allowed any time. Withdrawing keeps XP and items, and only removes your streak badge.</p>
      </div>

      {balanceNim !== null && (
        <p className="text-sm text-fg-muted">
          Current balance of <span className="font-mono">{short(savingsAddress)}</span>:{' '}
          <strong>{balanceNim.toFixed(5)} NIM</strong>. This value is stored as your
          first snapshot.
        </p>
      )}

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
        This is your display name on the leaderboard. Other players see it in
        ranked battles. You cannot change it later in v1.
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
        {loading ? 'Creating your account…' : 'Start saving'}
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
      className="vpx bg-mint text-[#0E1D19] py-3 px-4 font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-[2px]"
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
  return (
    <div className="vpx bg-coral-tint p-3 text-sm text-coral-text">{children}</div>
  )
}

function ProgressBar({ step }: { step: Step }) {
  const steps = ['Welcome', 'Account', 'Privacy', 'Name']
  return (
    <ol className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-widest text-fg-faint mt-4">
      {steps.map((label, i) => {
        const idx = (i + 1) as Step
        const active = idx === step
        const done = idx < step
        return (
          <li key={label} className="flex items-center gap-2">
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

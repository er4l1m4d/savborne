'use client'

/**
 * Savborne — vault creation for an EXISTING player (`/setup/vault`).
 *
 * Same ceremony as onboarding, different endpoint: it calls `POST /api/vaults`
 * and never touches the player row, so a player who onboarded before the vault
 * build keeps their name and history.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listAccounts, hostNetwork, WalletError, type Network } from '@/lib/nimiq'
import { authHeaders, readSession } from '@/lib/session'
import { encryptPhrase } from '@/lib/vault/crypto'
import { deriveVaultAddress, generatePhrase } from '@/lib/vault/phrase'
import { writeVault } from '@/lib/vault/storage'
import { PhraseCeremony } from '@/components/vault/PhraseCeremony'
import { BackupQuiz } from '@/components/vault/BackupQuiz'
import { PassphraseField } from '@/components/vault/PassphraseField'

type Phase = 'pick' | 'show' | 'quiz' | 'passphrase'

export default function SetupVaultPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('pick')
  const [accounts, setAccounts] = useState<string[]>([])
  const [identity, setIdentity] = useState<string | null>(null)
  const [phrase, setPhrase] = useState<string[] | null>(null)
  const [vaultAddress, setVaultAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const network = useMemo<Network>(() => hostNetwork(), [])
  const session = useMemo(() => readSession(), [])

  useEffect(() => {
    ;(async () => {
      try {
        const list = await listAccounts()
        setAccounts(list)
        if (session && list.includes(session.playerAddress)) setIdentity(session.playerAddress)
      } catch (err) {
        setError(describe(err))
      }
    })()
  }, [session])

  async function createVault(address: string) {
    setIdentity(address)
    setLoading(true)
    setError(null)
    try {
      const words = await generatePhrase()
      setVaultAddress(await deriveVaultAddress(words))
      setPhrase(words)
      setPhase('show')
    } catch (err) {
      setError(describe(err))
    } finally {
      setLoading(false)
    }
  }

  async function lockAndRegister(passphrase: string) {
    if (!identity || !vaultAddress || !phrase) return
    setLoading(true)
    setError(null)
    try {
      const blob = await encryptPhrase(phrase, passphrase)

      const res = await fetch('/api/vaults', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ vaultAddress, network, backupVerified: true }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(
          body.error === 'has_vault'
            ? 'This wallet already has a vault.'
            : `Could not register the vault (${body.error ?? res.status}).`,
        )
      }

      // Only persist locally once the server has accepted the mapping: a local
      // key with no server row cannot be used and cannot be trusted.
      writeVault(identity, {
        version: 1,
        address: vaultAddress,
        network,
        createdAt: new Date().toISOString(),
        blob,
      })
      setPhrase(null)
      router.replace('/vault')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh flex flex-col p-(--gut) max-w-105 mx-auto w-full gap-6">
      {phase === 'pick' && (
        <section className="flex flex-col gap-4 mt-4">
          <h1 className="text-3xl leading-none" style={{ fontFamily: 'var(--font-silkscreen)' }}>
            Create your vault
          </h1>
          <p className="text-fg-muted">
            Choose the wallet account that identifies you. Your vault is a new, separate
            address derived on this device from 24 words.
          </p>
          {accounts.length === 0 && <p className="text-sm text-fg-faint italic">Connect a wallet in Nimiq Pay.</p>}
          {accounts.map((a) => (
            <button
              key={a}
              onClick={() => createVault(a)}
              className="vpx bg-surface p-3 text-left text-sm font-mono break-all hover:bg-surface-hi transition-colors"
            >
              {a}
            </button>
          ))}
          {error && <div className="vpx bg-coral-tint p-3 text-sm text-coral-text">{error}</div>}
        </section>
      )}

      {phase === 'show' && phrase && (
        <PhraseCeremony phrase={phrase} onContinue={() => setPhase('quiz')} onBack={() => setPhase('pick')} />
      )}

      {phase === 'quiz' && phrase && (
        <BackupQuiz phrase={phrase} onPass={() => setPhase('passphrase')} onBack={() => setPhase('show')} />
      )}

      {phase === 'passphrase' && (
        <section className="flex flex-col gap-4 mt-4">
          <h1 className="text-3xl leading-none" style={{ fontFamily: 'var(--font-silkscreen)' }}>
            Lock your vault
          </h1>
          <PassphraseField onSet={lockAndRegister} />
          {error && <div className="vpx bg-coral-tint p-3 text-sm text-coral-text">{error}</div>}
          {loading && <p className="text-sm text-fg-faint italic">Registering your vault…</p>}
        </section>
      )}
    </main>
  )
}

function describe(err: unknown): string {
  if (err instanceof WalletError) {
    return err.type === 'PERMISSION_DENIED'
      ? 'Account access was declined. Approve the wallet prompt in Nimiq Pay.'
      : err.message
  }
  return err instanceof Error ? err.message : String(err)
}

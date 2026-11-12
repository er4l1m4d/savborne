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
import { listAccounts, hostNetwork, type Network } from '@/lib/nimiq'
import { describeWalletError } from '@/lib/wallet-errors'
import { readSession } from '@/lib/session'
import { sameAddress } from '@/lib/vault/address'
import { encryptPhrase } from '@/lib/vault/crypto'
import { deriveVaultAddress, generatePhrase } from '@/lib/vault/phrase'
import { writeVault } from '@/lib/vault/storage'
import { PhraseCeremony } from '@/components/vault/PhraseCeremony'
import { BackupQuiz } from '@/components/vault/BackupQuiz'
import { PassphraseField } from '@/components/vault/PassphraseField'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { apiFetch, ensureSessionToken } from '@/lib/client-session'

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
    // This page registers a vault for an existing profile. Without the stored
    // session there is no profile to attach it to; reconnect through setup.
    if (!session) {
      router.replace('/setup')
      return
    }

    ;(async () => {
      try {
        const list = await listAccounts()
        // A profile belongs to one wallet. Do not let the picker register a
        // vault for a different account: the session and the local key would
        // then disagree about who owns it.
        const owned = list.find((account) => sameAddress(account, session.playerAddress))
        if (!owned) {
          setAccounts([])
          setError(
            'This device is signed in with a different wallet. Switch back to the account that owns this profile in Nimiq Pay, then try again.',
          )
          return
        }
        setAccounts([owned])
        setIdentity(owned)
      } catch (err) {
        setError(describeWalletError(err))
      }
    })()
  }, [session, router])

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
      setError(describeWalletError(err))
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

      // Prove the picked wallet can authorise the request before the server
      // sees it; otherwise a failed re-sign is masked as a bare 401.
      await ensureSessionToken(identity)

      const res = await apiFetch(
        '/api/vaults',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vaultAddress, network, backupVerified: true }),
        },
        { address: identity },
      )
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
    <ScreenShell variant="pushed" backHref="/vault">
      {phase === 'pick' && (
        <section className="flex flex-col gap-4">
          <h1 className="sv-heading">Create your vault</h1>
          <p className="sv-body text-fg-muted">
            Choose the wallet account that identifies you. Your vault is a new, separate
            address derived on this device from 24 words.
          </p>
          {accounts.length === 0 && (
            <p className="sv-label text-fg-faint italic">Connect a wallet in Nimiq Pay.</p>
          )}
          {accounts.map((a) => (
            <Button
              key={a}
              variant="secondary"
              className="justify-start font-mono sv-break"
              onClick={() => createVault(a)}
            >
              {a}
            </Button>
          ))}
          {error && <Banner tone="error">{error}</Banner>}
        </section>
      )}

      {phase === 'show' && phrase && (
        <PhraseCeremony phrase={phrase} onContinue={() => setPhase('quiz')} onBack={() => setPhase('pick')} />
      )}

      {phase === 'quiz' && phrase && (
        <BackupQuiz phrase={phrase} onPass={() => setPhase('passphrase')} onBack={() => setPhase('show')} />
      )}

      {phase === 'passphrase' && (
        <section className="flex flex-col gap-4">
          <h1 className="sv-heading">Lock your vault</h1>
          <PassphraseField onSet={lockAndRegister} />
          {error && <Banner tone="error">{error}</Banner>}
          {loading && <p className="sv-label text-fg-faint italic">Registering your vault…</p>}
        </section>
      )}
    </ScreenShell>
  )
}


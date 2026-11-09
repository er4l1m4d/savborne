'use client'

/**
 * Savborne - onboarding draft
 *
 * The four onboarding routes share one in-memory draft. The 24-word phrase is
 * deliberately kept out of localStorage, sessionStorage, cookies and the URL:
 * it lives here and is cleared the moment the vault is encrypted on device.
 *
 * A reload therefore restarts onboarding. The mount probe protects the common
 * case: a player who already has a profile is sent Home instead of being walked
 * into a second vault.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { hostNetwork, listAccounts } from '@/lib/nimiq'
import { PLAYER_HEADER, readSession, writeSession } from '@/lib/session'
import { reconnectDecision, reconnectProfile, sessionFromProfile } from '@/lib/reconnect'
import { sameAddress } from '@/lib/vault/address'
import { encryptPhrase } from '@/lib/vault/crypto'
import { deriveVaultAddress, generatePhrase } from '@/lib/vault/phrase'
import { writeVault } from '@/lib/vault/storage'
import { validateDisplayName } from '@/lib/display-name'

type Draft = {
  accounts: string[]
  picked: string | null
  vaultAddress: string | null
  /** Memory only. Cleared once the vault is encrypted. */
  phrase: string[] | null
  vaultLocked: boolean
  displayName: string
  acceptedNoticeVersion: string | null
}

type OnboardingContextValue = Draft & {
  startConnect: () => Promise<string[]>
  pickAccount: (address: string) => Promise<'reconnect' | 'created'>
  lockVault: (passphrase: string) => Promise<void>
  acceptPrivacy: (version: string) => void
  setDisplayName: (value: string) => void
  resetVault: () => void
  finish: (displayName: string) => Promise<void>
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function useOnboarding(): OnboardingContextValue {
  const value = useContext(OnboardingContext)
  if (!value) throw new Error('useOnboarding must be used inside OnboardingProvider')
  return value
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [vaultAddress, setVaultAddress] = useState<string | null>(null)
  const [phrase, setPhrase] = useState<string[] | null>(null)
  const [vaultLocked, setVaultLocked] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [acceptedNoticeVersion, setAcceptedNoticeVersion] = useState<string | null>(null)

  /**
   * A stored session means this device already finished onboarding. Probe the
   * read-only endpoint once: 200 leaves for Home, 404 clears a stale session,
   * and every failure leaves onboarding alone rather than blocking it.
   */
  useEffect(() => {
    const session = readSession()
    if (!session) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/players/me', {
          headers: { [PLAYER_HEADER]: session.playerAddress },
        })
        if (cancelled) return
        const decision = reconnectDecision(res.status)
        if (decision === 'reconnect') router.replace('/')
        if (decision === 'create') writeSession(null)
      } catch {
        // A failed probe must not block onboarding.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  async function startConnect() {
    const list = await listAccounts()
    setAccounts(list)
    return list
  }

  /**
   * 200 reconnects the profile, 404 creates a new vault on this device, and
   * every other status throws. Nothing is persisted before the player row is
   * created at the Name step.
   */
  async function pickAccount(identity: string): Promise<'reconnect' | 'created'> {
    const res = await fetch('/api/players/me', {
      headers: { [PLAYER_HEADER]: identity },
    })
    const decision = reconnectDecision(res.status)

    if (decision === 'reconnect') {
      const body = (await res.json()) as { player?: unknown }
      const profile = reconnectProfile(body.player)
      if (!profile || !sameAddress(profile.address, identity)) {
        throw new Error('Could not check this wallet. Try again.')
      }
      writeSession(sessionFromProfile(profile))
      router.replace('/')
      return 'reconnect'
    }

    if (decision === 'create') {
      const words = await generatePhrase()
      const vault = await deriveVaultAddress(words)
      setPicked(identity)
      setPhrase(words)
      setVaultAddress(vault)
      setVaultLocked(false)
      return 'created'
    }

    throw new Error(`Could not check this wallet (${res.status}).`)
  }

  async function lockVault(passphrase: string) {
    if (!picked || !vaultAddress || !phrase) {
      throw new Error('The vault is not ready yet. Start again from the account step.')
    }
    const network = hostNetwork()
    const blob = await encryptPhrase(phrase, passphrase)
    writeVault(picked, {
      version: 1,
      address: vaultAddress,
      network,
      createdAt: new Date().toISOString(),
      blob,
    })
    setPhrase(null)
    setVaultLocked(true)
    router.push('/privacy')
  }

  function acceptPrivacy(version: string) {
    setAcceptedNoticeVersion(version)
  }

  /** Drop an unregistered draft and return to the account picker. */
  function resetVault() {
    setPhrase(null)
    setPicked(null)
    setVaultAddress(null)
    setVaultLocked(false)
  }

  async function finish(name: string) {
    const result = validateDisplayName(name)
    if (!result.ok) throw new Error(result.error)
    const value = result.value
    if (!picked || !vaultAddress) {
      throw new Error('Your vault is not ready yet.')
    }

    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: picked,
        displayName: value,
        vaultAddress,
        network: hostNetwork(),
        backupVerified: true,
        privacyNoticeVersion: acceptedNoticeVersion,
      }),
    })

    if (res.status === 409) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (body.error === 'vault_exists') {
        throw new Error(
          'This wallet already has a vault. Reopen Savborne to restore your profile.',
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

    writeSession({
      playerAddress: picked,
      savingsAddress: vaultAddress,
      displayName: value,
    })
    router.replace('/')
  }

  return (
    <OnboardingContext.Provider
      value={{
        accounts,
        picked,
        vaultAddress,
        phrase,
        vaultLocked,
        displayName,
        acceptedNoticeVersion,
        startConnect,
        pickAccount,
        lockVault,
        acceptPrivacy,
        setDisplayName,
        resetVault,
        finish,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

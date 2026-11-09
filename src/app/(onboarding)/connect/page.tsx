'use client'

/**
 * Savborne - Vault (step 2 of 5) and Backup (step 3 of 5)
 *
 * The handoff's Connect layout, rewritten for the non-custodial vault: a short
 * intro, the can/cannot cards and a closed vault explainer lead into the
 * existing 24-word ceremony. The step label moves from 2 to 3 when the phrase
 * exists, inside the same route.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { PhraseCeremony } from '@/components/vault/PhraseCeremony'
import { BackupQuiz } from '@/components/vault/BackupQuiz'
import { PassphraseField } from '@/components/vault/PassphraseField'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { describeWalletError } from '@/lib/wallet-errors'
import {
  VAULT_CAN,
  VAULT_CANNOT,
  VAULT_INTRO,
  VAULT_STEPS,
} from '@/lib/onboarding-copy'

type CeremonyPhase = 'show' | 'quiz' | 'passphrase'

export default function ConnectPage() {
  const router = useRouter()
  const {
    accounts,
    phrase,
    vaultLocked,
    startConnect,
    pickAccount,
    lockVault,
    resetVault,
  } = useOnboarding()

  const [showPicker, setShowPicker] = useState(false)
  const [phase, setPhase] = useState<CeremonyPhase>('show')
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stage = vaultLocked
    ? 'ready'
    : phrase
      ? phase
      : showPicker
        ? 'pick'
        : 'intro'

  const step = stage === 'intro' || stage === 'pick' ? 2 : 3

  async function onCreate() {
    setLoading(true)
    setError(null)
    try {
      const list = await startConnect()
      if (list.length === 0) {
        setError('Connect a wallet in Nimiq Pay, then try again.')
        return
      }
      setShowPicker(true)
    } catch (err) {
      setError(describeWalletError(err))
    } finally {
      setLoading(false)
    }
  }

  async function onPick(identity: string) {
    setPicking(identity)
    setError(null)
    try {
      const result = await pickAccount(identity)
      if (result === 'created') {
        setPhase('show')
        setError(null)
      }
    } catch (err) {
      setError(describeWalletError(err))
    } finally {
      setPicking(null)
    }
  }

  async function onLock(passphrase: string) {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      await lockVault(passphrase)
    } catch (err) {
      setError(describeWalletError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <OnboardingScreen step={step} backHref="/welcome">
      {stage === 'intro' && (
        <>
          <h1 className="sv-heading-lg">Create your vault</h1>
          <p className="sv-body text-fg-muted">{VAULT_INTRO}</p>

          <div className="grid grid-cols-2 gap-3">
            <PixelPanel className="p-3 flex flex-col gap-1.5">
              <span className="sv-label text-mint">Savborne can</span>
              <span className="text-sm font-semibold leading-snug">{VAULT_CAN}</span>
            </PixelPanel>
            <PixelPanel className="p-3 flex flex-col gap-1.5">
              <span className="sv-label text-coral-text">Savborne cannot</span>
              <span className="text-sm font-semibold leading-snug">{VAULT_CANNOT}</span>
            </PixelPanel>
          </div>

          <details>
            <summary className="sv-label text-mint min-h-11 cursor-pointer py-3">
              How your vault works
            </summary>
            <PixelPanel className="p-[18px] mt-1">
              <ol className="flex flex-col gap-4">
                {VAULT_STEPS.map((line, index) => (
                  <li key={line} className="flex items-start gap-[14px]">
                    <span className="w-7 h-7 shrink-0 bg-mint text-background text-sm font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-[15px] leading-[1.45] font-semibold">{line}</span>
                  </li>
                ))}
              </ol>
            </PixelPanel>
          </details>

          <div className="mt-auto flex flex-col gap-3">
            <Button variant="primary" loading={loading} onClick={onCreate}>
              Create your vault
            </Button>
            <p className="sv-label text-fg-faint">
              Already have a profile with this wallet? We reconnect it instead of
              creating a second vault.
            </p>
          </div>
          {error && <Banner tone="error">{error}</Banner>}
        </>
      )}

      {stage === 'pick' && (
        <>
          <h1 className="sv-heading-lg">Create your vault</h1>
          <p className="sv-body text-fg-muted">Choose the wallet account that identifies you.</p>
          <PixelPanel className="p-3 flex flex-col gap-2">
            {accounts.map((account) => (
              <Button
                key={account}
                variant="secondary"
                className="justify-start text-left font-mono sv-break"
                loading={picking === account}
                disabled={picking !== null}
                onClick={() => onPick(account)}
              >
                {account}
              </Button>
            ))}
          </PixelPanel>
          {error && <Banner tone="error">{error}</Banner>}
          <Button
            variant="ghost"
            className="self-start"
            disabled={picking !== null}
            onClick={() => {
              setError(null)
              setShowPicker(false)
            }}
          >
            Back
          </Button>
        </>
      )}

      {stage === 'show' && phrase && (
        <PhraseCeremony
          phrase={phrase}
          onContinue={() => setPhase('quiz')}
          onBack={() => {
            resetVault()
            setShowPicker(accounts.length > 0)
            setError(null)
          }}
        />
      )}

      {stage === 'quiz' && phrase && (
        <BackupQuiz
          phrase={phrase}
          onPass={() => setPhase('passphrase')}
          onBack={() => setPhase('show')}
        />
      )}

      {stage === 'passphrase' && (
        <>
          <h1 className="sv-heading-lg">Lock your vault</h1>
          <PassphraseField onSet={onLock} />
          {error && <Banner tone="error">{error}</Banner>}
          {loading && <p className="sv-label text-fg-faint italic">Encrypting your vault...</p>}
          <Button
            variant="ghost"
            className="self-start"
            disabled={loading}
            onClick={() => {
              setError(null)
              setPhase('quiz')
            }}
          >
            Back
          </Button>
        </>
      )}

      {stage === 'ready' && (
        <>
          <h1 className="sv-heading-lg">Your vault is ready</h1>
          <p className="sv-body text-fg-muted">
            Your 24 words are backed up and the vault is locked on this device.
            Savborne never sees the words and cannot move your NIM.
          </p>
          <div className="mt-auto">
            <Button variant="primary" onClick={() => router.push('/privacy')}>
              Continue
            </Button>
          </div>
        </>
      )}
    </OnboardingScreen>
  )
}

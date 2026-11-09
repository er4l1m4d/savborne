'use client'

/**
 * Savborne - Name your character (step 3 of 3)
 *
 * Character preview, a 16-character field with a live counter, and a coral CTA
 * that creates the player and vault rows together. The address never appears.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { CharacterArt } from '@/components/CharacterArt'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { DISPLAY_NAME_MAX } from '@/lib/display-name'

export default function NamePage() {
  const router = useRouter()
  const {
    displayName,
    setDisplayName,
    vaultLocked,
    acceptedNoticeVersion,
    finish,
  } = useOnboarding()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!vaultLocked) router.replace('/connect')
    else if (!acceptedNoticeVersion) router.replace('/privacy')
  }, [vaultLocked, acceptedNoticeVersion, router])

  if (!vaultLocked || !acceptedNoticeVersion) return null

  const trimmed = displayName.trim()
  const valid = trimmed.length >= 1 && trimmed.length <= DISPLAY_NAME_MAX

  async function onSubmit() {
    if (!valid || loading) return
    setLoading(true)
    setError(null)
    try {
      await finish(displayName)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <OnboardingScreen step={3} backHref="/privacy">
      <h1 className="sv-heading-lg">Name your character</h1>
      <p className="sv-body text-fg-muted">
        Your display name is your character&apos;s name. It appears on the
        leaderboard. Your address stays hidden.
      </p>

      <PixelPanel className="h-[250px] flex items-center justify-center">
        <div className="w-[190px] h-[214px] bg-sprite-well flex items-center justify-center">
          <CharacterArt bracket={null} size={128} />
        </div>
      </PixelPanel>

      <div className="flex flex-col gap-2">
        <label htmlFor="display-name" className="sv-body font-bold">
          Display name
        </label>
        <input
          id="display-name"
          className="sv-input"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="off"
          aria-describedby="name-hint name-count name-error"
          aria-invalid={error ? true : undefined}
        />
        <div className="flex items-start justify-between gap-3">
          <span id="name-hint" className="sv-label text-fg-muted">
            Up to {DISPLAY_NAME_MAX} characters.
          </span>
          <span id="name-count" className="sv-label text-fg-faint tabular-nums">
            {displayName.length}/{DISPLAY_NAME_MAX}
          </span>
        </div>
        <div id="name-error">{error && <Banner tone="error">{error}</Banner>}</div>
      </div>

      <div className="mt-auto">
        <Button variant="primary" disabled={!valid} loading={loading} onClick={onSubmit}>
          Start playing
        </Button>
      </div>
    </OnboardingScreen>
  )
}

'use client'

/**
 * Savborne - Privacy notice (step 2 of 3)
 *
 * The handoff's short version, four cards and consent line. Accepting records
 * the notice version in the draft; it is stored with the player when the Name
 * step creates the row.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen'
import { useOnboarding } from '@/components/onboarding/OnboardingProvider'
import { PrivacyNotice } from '@/components/PrivacyNotice'
import { Button } from '@/components/ui/Button'
import { PRIVACY_CONSENT_LINE, PRIVACY_NOTICE_VERSION } from '@/lib/privacy'

export default function PrivacyPage() {
  const router = useRouter()
  const { vaultLocked, acceptPrivacy } = useOnboarding()

  useEffect(() => {
    if (!vaultLocked) router.replace('/connect')
  }, [vaultLocked, router])

  if (!vaultLocked) return null

  function onContinue() {
    acceptPrivacy(PRIVACY_NOTICE_VERSION)
    router.push('/name')
  }

  return (
    <OnboardingScreen step={2} backHref="/connect">
      <h1 className="sv-heading-lg">Privacy notice</h1>
      <PrivacyNotice variant="full" />
      <div className="mt-auto flex flex-col gap-3 border-t-2 border-bevel pt-3.5">
        <p className="text-xs leading-[1.45] font-semibold text-fg-muted">
          {PRIVACY_CONSENT_LINE}
        </p>
        <Button variant="primary" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </OnboardingScreen>
  )
}

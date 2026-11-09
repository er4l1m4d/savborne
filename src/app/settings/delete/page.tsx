'use client'

/**
 * Savborne — /settings/delete
 *
 * A pushed route so the delete flow has its own header and no bottom nav.
 * The session is read in an effect because localStorage is unavailable during
 * the server render; with no session there is nothing to delete, so the player
 * goes back to Setup.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readSession } from '@/lib/session'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { DeleteAccountFlow } from '@/components/settings/DeleteAccountFlow'
import { LoadingState } from '@/components/ui/LoadingState'

export default function DeleteAccountPage() {
  const router = useRouter()
  const [playerAddress, setPlayerAddress] = useState<string | null>(null)

  useEffect(() => {
    const session = readSession()
    if (!session) {
      router.replace('/setup')
      return
    }
    setPlayerAddress(session.playerAddress)
  }, [router])

  return (
    <ScreenShell variant="pushed" title="Delete account" backHref="/settings">
      {playerAddress ? (
        <DeleteAccountFlow playerAddress={playerAddress} />
      ) : (
        <LoadingState />
      )}
    </ScreenShell>
  )
}

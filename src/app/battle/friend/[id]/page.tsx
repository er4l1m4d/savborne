/**
 * Savborne - friend challenge sent
 *
 * The creator's waiting screen. It polls the battle, shows the 24-hour expiry,
 * copies the challenge link, and can abandon the unanswered challenge. Once
 * the friend accepts (or the battle completes) it moves to the battle/result.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { usePlayerSession } from '@/lib/usePlayerSession'
import { BATTLE, BRACKETS, type Bracket } from '@/lib/constants'
import { formatCountdown } from '@/lib/battle-ui'
import { CharacterArt } from '@/components/CharacterArt'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { Chip } from '@/components/ui/Chip'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { VersusCards, UnknownFighter } from '@/components/battle/VersusCards'

type FriendState = {
  battle: {
    id: string
    status: 'pending' | 'active' | 'completed' | 'abandoned'
    createdAt: string
  }
  viewer: { side: 'a' | 'b' }
}

const POLL_MS = 5_000

export default function FriendChallengePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { player } = usePlayerSession()
  const [state, setState] = useState<FriendState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/battles/${id}`, { headers: authHeaders() })
      if (res.status === 403 || res.status === 404) {
        setError('You are not part of this challenge.')
        return
      }
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      setState((await res.json()) as FriendState)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the challenge')
    }
  }, [id])

  useEffect(() => {
    void fetchState()
    const poll = setInterval(fetchState, POLL_MS)
    const clock = setInterval(() => setNow(Date.now()), 1_000)
    return () => {
      clearInterval(poll)
      clearInterval(clock)
    }
  }, [fetchState])

  useEffect(() => {
    if (!state) return
    if (state.viewer.side !== 'a') {
      router.replace(`/battle/${id}`)
      return
    }
    if (state.battle.status === 'active') router.replace(`/battle/${id}`)
    if (state.battle.status === 'completed') router.replace(`/battle/${id}/result`)
  }, [state, id, router])

  const bracket = (player?.bracket as Bracket | null) ?? null
  const expiresAt = state
    ? new Date(state.battle.createdAt).getTime() + BATTLE.challengeExpiryHours * 3_600_000
    : now
  const leftMs = Math.max(0, expiresAt - now)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/battle/${id}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    } catch {
      setError('Copy failed. Select the link from the battle screen instead.')
    }
  }

  async function cancelChallenge() {
    setCancelling(true)
    setError(null)
    try {
      const res = await fetch(`/api/battles/${id}/cancel`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      router.push('/battle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the challenge')
      setConfirmOpen(false)
    } finally {
      setCancelling(false)
    }
  }

  const me = {
    name: player?.displayName ?? 'You',
    meta: player
      ? `Level ${player.level} · ${bracket ? BRACKETS[bracket].label : 'Entry'}`
      : 'Level —',
    art: <CharacterArt bracket={bracket} character={player?.avatar} size={76} />,
  }
  const friend = {
    name: 'Friend',
    meta: 'Waiting to join',
    art: <UnknownFighter size={56} />,
  }

  return (
    <ScreenShell
      variant="pushed"
      backHref="/battle"
      actions={<Chip variant="outline">Friend · Unranked</Chip>}
    >
      {error && <Banner tone="error">{error}</Banner>}

      {!state ? (
        <p className="sv-body text-fg-muted">Loading challenge...</p>
      ) : state.battle.status === 'abandoned' ? (
        <>
          <h1 className="sv-heading">Challenge expired</h1>
          <p className="sv-body text-fg-muted">
            Nobody answered in time. No XP lost.
          </p>
          <ButtonLink href="/battle" variant="secondary">
            Back to Battle
          </ButtonLink>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="sv-heading">Challenge sent</h1>
            <p className="sv-body text-fg-muted">
              Your challenge is still waiting. It expires in {BATTLE.challengeExpiryHours} hours.
            </p>
          </div>

          <VersusCards me={me} opponent={friend} height={230} />

          <PixelPanel className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="sv-label text-fg">Waiting for a friend</span>
            <span className="sv-figure text-mint">{formatCountdown(leftMs)} left</span>
          </PixelPanel>

          <PixelPanel tone="off" className="p-3.5">
            <p className="sv-label text-fg-muted">
              Friend challenges are unranked and count toward your daily limit of{' '}
              {BATTLE.dailyLimit} battles.
            </p>
          </PixelPanel>

          <div className="mt-auto flex flex-col gap-3.5">
            <Button variant="primary" onClick={copyLink}>
              {copied ? 'Link copied' : 'Copy challenge link'}
            </Button>
            <ButtonLink href="/battle" variant="secondary">
              Back to Battle
            </ButtonLink>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Cancel challenge
            </Button>
          </div>
        </>
      )}

      <BottomSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel challenge?"
      >
        <div className="flex flex-col gap-4">
          <p className="sv-body text-fg-muted">
            Your friend will no longer be able to accept this challenge. No XP is lost.
          </p>
          <Button variant="destructive" onClick={cancelChallenge} loading={cancelling}>
            Cancel challenge
          </Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Keep it
          </Button>
        </div>
      </BottomSheet>
    </ScreenShell>
  )
}

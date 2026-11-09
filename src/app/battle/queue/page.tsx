/**
 * Savborne - ranked queue
 *
 * Joins the queue on mount, polls for a match, and shows the widening rating
 * window. After 3:05 with no match it keeps searching but offers the AI, a
 * friend, or leaving. The queue row is dropped on the explicit exits and on
 * pagehide; matched rows are protected by the leave route.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { usePlayerSession } from '@/lib/usePlayerSession'
import { BRACKETS, RANKED, BATTLE, type Bracket } from '@/lib/constants'
import { queueTimeLabel, ratingRangeForWait } from '@/lib/battle-ui'
import { CharacterArt } from '@/components/CharacterArt'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { Chip } from '@/components/ui/Chip'
import { VersusCards, UnknownFighter } from '@/components/battle/VersusCards'

type Status = 'joining' | 'searching' | 'ended' | 'error'

export default function RankedQueuePage() {
  const router = useRouter()
  const { player, loading } = usePlayerSession()
  const [status, setStatus] = useState<Status>('joining')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'ai' | 'friend' | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [range, setRange] = useState(RANKED.matchRangeByWaitSeconds[0].range)
  const leftRef = useRef(false)
  const matchedRef = useRef(false)

  const bracket = (player?.bracket as Bracket | null) ?? null

  // Join once. A failure (locked, limit, busy) stops the search and explains.
  useEffect(() => {
    let cancelled = false
    async function join() {
      try {
        const res = await fetch('/api/queue/join', { method: 'POST', headers: authHeaders() })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error ?? `Could not join the queue (${res.status})`)
          setStatus('error')
          return
        }
        setStartedAt(Date.now())
        setNow(Date.now())
        setStatus('searching')
      } catch {
        if (cancelled) return
        setError('Could not join the queue. Check your connection.')
        setStatus('error')
      }
    }
    void join()
    return () => {
      cancelled = true
    }
  }, [])

  // Leave when the page is actually unloaded. This is not a React effect
  // cleanup, so StrictMode's double mount cannot delete a fresh queue row.
  useEffect(() => {
    const onPageHide = () => {
      if (matchedRef.current) return
      void fetch('/api/queue/leave', {
        method: 'POST',
        headers: authHeaders(),
        keepalive: true,
      }).catch(() => {})
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])

  // Poll for a match and the server's current range.
  useEffect(() => {
    if (status !== 'searching') return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch('/api/queue/poll', { method: 'POST', headers: authHeaders() })
        const json = await res.json()
        if (cancelled) return
        if (res.status === 401 || json.left) {
          setStatus('ended')
          return
        }
        if (json.matched && json.battleId) {
          matchedRef.current = true
          router.replace(`/battle/${json.battleId}`)
          return
        }
        if (typeof json.range === 'number') setRange(json.range)
        if (typeof json.waitedSeconds === 'number') {
          setStartedAt((previous) => {
            const serverStart = Date.now() - json.waitedSeconds * 1_000
            if (previous === null) return serverStart
            const localSeconds = Math.floor((Date.now() - previous) / 1_000)
            return Math.abs(localSeconds - json.waitedSeconds) > 2 ? serverStart : previous
          })
        }
      } catch {
        // Transient network error: keep searching; the next poll retries.
      }
    }
    void tick()
    const id = setInterval(tick, RANKED.pollIntervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [status, router])

  // Local clock between polls.
  useEffect(() => {
    if (status !== 'searching') return
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [status])

  const waitedSeconds =
    startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1_000))
  const displayRange = range || ratingRangeForWait(waitedSeconds)
  const timedOut = waitedSeconds >= RANKED.queueTimeoutSeconds

  async function dropQueue() {
    if (leftRef.current) return
    leftRef.current = true
    try {
      await fetch('/api/queue/leave', { method: 'POST', headers: authHeaders() })
    } catch {
      // Best effort; a stale row self-cleans server-side.
    }
  }

  async function leaveQueue() {
    await dropQueue()
    router.push('/battle')
  }

  async function startAiInstead() {
    setBusy('ai')
    setError(null)
    try {
      const res = await fetch('/api/battles/ai', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      matchedRef.current = true
      await dropQueue()
      router.push(`/battle/${json.battleId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a battle')
    } finally {
      setBusy(null)
    }
  }

  async function challengeFriendInstead() {
    setBusy('friend')
    setError(null)
    try {
      const res = await fetch('/api/battles/friend', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      matchedRef.current = true
      await dropQueue()
      router.push(`/battle/friend/${json.battleId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a challenge')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <ScreenShell variant="pushed" title="Ranked">
        <p className="sv-body text-fg-muted">Loading ranked...</p>
      </ScreenShell>
    )
  }

  if (status === 'ended' || status === 'error') {
    return (
      <ScreenShell
        variant="pushed"
        title="Ranked"
        actions={
          bracket ? (
            <Chip variant="outline" color={BRACKETS[bracket].color}>
              {BRACKETS[bracket].label} bracket
            </Chip>
          ) : undefined
        }
      >
        <Banner tone={status === 'error' ? 'error' : 'info'}>
          {error ?? 'Your search ended. Start again from Battle.'}
        </Banner>
        <ButtonLink href="/battle" variant="secondary">
          Back to Battle
        </ButtonLink>
      </ScreenShell>
    )
  }

  const me = {
    name: player?.displayName ?? 'You',
    meta: player ? `Rating ${player.rating}` : 'Rating —',
    art: <CharacterArt bracket={bracket} size={80} />,
  }
  const opponent = {
    name: 'Opponent',
    meta: 'Not found yet',
    art: <UnknownFighter size={64} />,
  }

  return (
    <ScreenShell
      variant="pushed"
      title="Ranked"
      actions={
        bracket ? (
          <Chip variant="outline" color={BRACKETS[bracket].color}>
            {BRACKETS[bracket].label} bracket
          </Chip>
        ) : undefined
      }
    >
      {error && <Banner tone="error">{error}</Banner>}

      {timedOut ? (
        <>
          <PixelPanel className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <span className="sv-label text-fg-muted">Time in queue</span>
            <span className="sv-number-xl">{queueTimeLabel(waitedSeconds)}</span>
            <span className="sv-label text-fg-muted">
              Rating range now ±{displayRange}
            </span>
          </PixelPanel>

          <div className="flex flex-col gap-2">
            <h1 className="sv-subheading">No match yet.</h1>
            <p className="sv-body text-fg-muted">
              We&apos;ll keep searching. You can battle the AI or a friend while you wait.
            </p>
          </div>

          <div className="flex flex-col gap-3.5">
            <Button
              variant="primary"
              size="mode"
              onClick={startAiInstead}
              loading={busy === 'ai'}
              disabled={busy !== null}
            >
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span>Battle the AI</span>
                <span className="sv-label text-background/80">
                  Unranked. Counts toward today&apos;s {BATTLE.dailyLimit} battles.
                </span>
              </span>
            </Button>
            <Button
              variant="secondary"
              size="mode"
              onClick={challengeFriendInstead}
              loading={busy === 'friend'}
              disabled={busy !== null}
            >
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span>Challenge a friend</span>
                <span className="sv-label text-fg-muted">Unranked.</span>
              </span>
            </Button>
          </div>

          <Button variant="secondary" onClick={leaveQueue} className="mt-auto">
            Leave queue
          </Button>
        </>
      ) : (
        <>
          <h1 className="sv-subheading">
            Searching for a ranked opponent in your bracket...
          </h1>

          <VersusCards me={me} opponent={opponent} height={250} />

          <PixelPanel className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="flex flex-col gap-0.5">
              <span className="sv-label text-fg-muted">Time in queue</span>
              <span className="sv-number-m">{queueTimeLabel(waitedSeconds)}</span>
            </div>
            <div className="flex flex-col gap-0.5 text-right">
              <span className="sv-label text-fg-muted">Rating range</span>
              <span className="sv-subheading">±{displayRange}</span>
            </div>
          </PixelPanel>

          <div className="mt-auto">
            <Button variant="secondary" onClick={leaveQueue}>
              Leave queue
            </Button>
          </div>
        </>
      )}
    </ScreenShell>
  )
}

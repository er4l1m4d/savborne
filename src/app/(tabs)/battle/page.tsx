/**
 * Savborne — Battle menu
 *
 * Three modes (spec 9.3): AI battle, friend challenge, ranked (locked until
 * Phase 5). Shows the daily 3-battle counter from /api/players/me. Creating
 * a friend challenge returns a share path + deeplink the player can send;
 * inside Nimiq Pay the path alone works because both players load the same
 * Mini App origin.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { usePlayerSession } from '@/lib/usePlayerSession'
import { BATTLE, RANKED } from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'

export default function BattleMenuPage() {
  const router = useRouter()
  const { player, loading } = usePlayerSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<{ sharePath: string; deeplink: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Ranked queue state machine: idle → queued (polling) → matched/nav ──
  const [queued, setQueued] = useState(false)
  const [waitedSeconds, setWaitedSeconds] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queueBusy = queued

  const battlesToday = player?.battlesToday ?? 0
  const limitReached = battlesToday >= BATTLE.dailyLimit
  const rankedEligible =
    !!player && player.level >= RANKED.minLevel && player.checkInCount >= RANKED.minCheckIns

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }, [])

  // Poll the queue every 10 s while queued (spec 10.3). A match navigates to
  // the battle screen; a vanished row (left/stale) stops the search.
  useEffect(() => {
    if (!queued) {
      stopPolling()
      return
    }
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch('/api/queue/poll', { method: 'POST', headers: authHeaders() })
        const json = await res.json()
        if (cancelled) return
        if (res.status === 401 || json.left) {
          setQueued(false)
          return
        }
        if (json.matched && json.battleId) {
          stopPolling()
          router.push(`/battle/${json.battleId}`)
          return
        }
        setWaitedSeconds(json.waitedSeconds ?? 0)
      } catch {
        // transient network error — next poll retries (spec: keep searching)
      }
    }
    tick()
    pollRef.current = setInterval(tick, RANKED.pollIntervalMs)
    return () => {
      cancelled = true
      stopPolling()
    }
  }, [queued, router, stopPolling])

  async function joinQueue() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/queue/join', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      setWaitedSeconds(0)
      setQueued(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join queue')
    } finally {
      setBusy(false)
    }
  }

  async function leaveQueue() {
    setQueued(false)
    try {
      await fetch('/api/queue/leave', { method: 'POST', headers: authHeaders() })
    } catch {
      /* best-effort; stale rows self-clean server-side */
    }
  }

  async function startAiBattle() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/battles/ai', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      router.push(`/battle/${json.battleId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start battle')
    } finally {
      setBusy(false)
    }
  }

  async function createChallenge() {
    setBusy(true)
    setError(null)
    setChallenge(null)
    try {
      const res = await fetch('/api/battles/friend', { method: 'POST', headers: authHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      setChallenge({ sharePath: json.sharePath, deeplink: json.deeplink })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create challenge')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    if (!challenge) return
    try {
      await navigator.clipboard.writeText(challenge.sharePath)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed — select and copy the code manually')
    }
  }

  return (
    <ScreenShell
      variant="tab"
      title="Battle"
      actions={
        <span className={`sv-figure ${limitReached ? 'text-coral-text' : 'text-fg-muted'}`}>
          {battlesToday} / {BATTLE.dailyLimit} today
        </span>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}

      <ModeCard
        title="Savborne AI"
        blurb="Battle the Savborne AI. Unranked."
        cta="Fight the AI"
        onClick={startAiBattle}
        disabled={busy || limitReached || loading}
        accent="var(--mint)"
        footnote={
          limitReached
            ? 'Daily limit reached. New battles unlock at 00:00 UTC (1:00 AM Lagos time).'
            : 'Win 30 XP · Tie 15 · Loss 10'
        }
      />

      <ModeCard
        title="Challenge a friend"
        blurb="Challenge a friend. Unranked."
        cta="Create challenge"
        onClick={createChallenge}
        disabled={busy || limitReached || loading}
        accent="var(--butter)"
      />
      {challenge && (
        <PixelPanel className="p-4 flex flex-col gap-2">
          <p className="sv-label text-fg-muted">
            Send this code to your friend. It opens inside their Nimiq Pay once they paste it as a
            Mini App URL, and expires in 24 hours.
          </p>
          <code className="sv-figure font-mono bg-surface-low p-2 vpx-soft sv-break">
            {challenge.sharePath}
          </code>
          <Button variant="secondary" onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy challenge link'}
          </Button>
        </PixelPanel>
      )}

      {queued ? (
        <PixelPanel className="p-4 flex flex-col gap-3">
          <p className="sv-body font-bold text-mint">
            Searching for a ranked opponent in your bracket…
          </p>
          <p className="sv-figure text-fg-muted">
            {Math.floor(waitedSeconds / 60)}:{String(waitedSeconds % 60).padStart(2, '0')} ·
            ±{waitedSeconds < 60 ? 150 : waitedSeconds < 120 ? 300 : waitedSeconds < 180 ? 450 : 600} rating window
          </p>
          {waitedSeconds >= 180 && (
            <p className="sv-label text-butter-text">
              No match yet. We&apos;ll keep searching. You can battle the AI or a friend while you
              wait.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={leaveQueue}>
              Cancel search
            </Button>
            <Button variant="secondary" onClick={() => { leaveQueue(); startAiBattle() }}>
              Battle AI instead
            </Button>
          </div>
        </PixelPanel>
      ) : (
        <PixelPanel tone="off" className="p-4 flex flex-col gap-1.5">
          <h2 className="sv-subheading">Ranked match</h2>
          <p className="sv-label text-fg-muted">Find a ranked match in your bracket.</p>
          {!rankedEligible && !loading && (
            <p className="sv-label text-butter-text">
              Reach Level {RANKED.minLevel} and complete {RANKED.minCheckIns} check-ins to unlock
              ranked battles.
            </p>
          )}
          {rankedEligible && (
            <Button
              variant="primary"
              onClick={joinQueue}
              disabled={busy || limitReached || queueBusy}
            >
              {busy ? 'Checking…' : 'Find ranked match'}
            </Button>
          )}
        </PixelPanel>
      )}

      <section className="flex flex-col gap-2 pt-2 border-t border-line">
        <h3 className="sv-section-label text-fg-faint">How battles work</h3>
        <ul className="sv-label text-fg-muted flex flex-col gap-1 list-disc pl-4">
          <li>5 turns. Each turn both sides secretly pick Attack, Defend, Special Move, or Use item.</li>
          <li>Higher health after 5 turns wins. A knockout ends it early. Ties give both 15 XP.</li>
          <li>No chance — outcomes depend only on moves and items.</li>
          <li>Not chosen by the timer? Your turn defaults to Defend.</li>
        </ul>
      </section>
    </ScreenShell>
  )
}

function ModeCard({
  title,
  blurb,
  cta,
  onClick,
  disabled,
  accent,
  footnote,
}: {
  title: string
  blurb: string
  cta: string
  onClick: () => void
  disabled: boolean
  accent: string
  footnote?: string
}) {
  return (
    <PixelPanel className="p-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="sv-subheading" style={{ color: accent }}>
          {title}
        </h2>
        <p className="sv-label text-fg-muted">{blurb}</p>
      </div>
      <Button variant="primary" onClick={onClick} disabled={disabled}>
        {cta}
      </Button>
      {footnote && <p className="sv-label text-fg-faint">{footnote}</p>}
    </PixelPanel>
  )
}

// Referenced so the item catalog import stays honest for future "your loadout" display.
export const BATTLE_ITEM_KEYS: ItemKey[] = ITEMS.filter((i) => !i.isBadge).map((i) => i.key)

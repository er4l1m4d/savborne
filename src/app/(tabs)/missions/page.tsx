/**
 * Savborne — Missions screen
 *
 * The handoff's Progress screen: Repeating (Daily, Weekly) and One-time tabs,
 * one grouped panel per cadence and 58px rows with a 24px status box, the
 * mission, an optional description and the XP reward. Each group header owns
 * the reset line and the period XP counter, so there are no separate cap cards.
 * Pulls from `GET /api/missions`; the API contract is unchanged.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { Glyph } from '@/components/Glyphs'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Row } from '@/components/ui/Row'
import { Tabs } from '@/components/ui/Tabs'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { earnedXp, xpCounter } from '@/lib/missions-ui'

type Mission = {
  key: string
  name: string
  description: string
  type: 'daily' | 'weekly' | 'onetime'
  xpReward: number
  bracketRequired: string | null
  completed: boolean
  completedAt: string | null
  nextResetAt: string | null
}

type Counters = {
  dailyXpEarned: number
  dailyXpCap: number
  weeklyXpEarned: number
  weeklyXpCap: number
}

const LOAD_ERROR = "Couldn't load missions."

export default function MissionsPage() {
  const router = useRouter()
  const [missions, setMissions] = useState<Mission[] | null>(null)
  const [counters, setCounters] = useState<Counters | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'repeating' | 'onetime'>('repeating')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/missions', { headers: authHeaders() })
        if (res.status === 401) {
          router.replace('/setup')
          return
        }
        if (!res.ok) throw new Error(LOAD_ERROR)
        const json = (await res.json()) as { missions: Mission[]; counters: Counters }
        if (!cancelled) {
          setMissions(json.missions)
          setCounters(json.counters)
        }
      } catch {
        if (!cancelled) setError(LOAD_ERROR)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router, reload])

  const daily = missions?.filter((m) => m.type === 'daily') ?? []
  const weekly = missions?.filter((m) => m.type === 'weekly') ?? []
  const oneTime = missions?.filter((m) => m.type === 'onetime') ?? []

  return (
    <ScreenShell variant="tab" title="Missions" bodyClassName="gap-3.5">
      <Tabs
        ariaLabel="Mission type"
        value={tab}
        onChange={(value) => setTab(value as 'repeating' | 'onetime')}
        items={[
          { value: 'repeating', label: 'Repeating' },
          { value: 'onetime', label: 'One-time' },
        ]}
      />

      {loading && <LoadingState />}

      {!loading && error && (
        <>
          <Banner tone="error">{error}</Banner>
          <Button
            variant="secondary"
            fullWidth={false}
            className="self-start"
            onClick={() => setReload((n) => n + 1)}
          >
            Try again
          </Button>
        </>
      )}

      {!loading && !error && missions && counters && (
        tab === 'repeating' ? (
          <>
            {daily.length > 0 && (
              <Group
                title="Daily"
                reset="Resets 00:00 UTC"
                missions={daily}
                cap={counters.dailyXpCap}
              />
            )}
            {weekly.length > 0 && (
              <Group
                title="Weekly"
                reset="Resets Monday 00:00 UTC"
                missions={weekly}
                cap={counters.weeklyXpCap}
              />
            )}
            {daily.length === 0 && weekly.length === 0 && <EmptyPanel tone="repeating" />}
          </>
        ) : oneTime.length > 0 ? (
          <Group title="One-time" reset="Never expires" missions={oneTime} />
        ) : (
          <EmptyPanel tone="onetime" />
        )
      )}
    </ScreenShell>
  )
}

function Group({
  title,
  reset,
  missions,
  cap,
}: {
  title: string
  reset: string
  missions: Mission[]
  cap?: number
}) {
  const caption =
    cap === undefined ? reset : `${reset} · ${xpCounter(earnedXp(missions, cap), cap)}`

  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h2 className="sv-subheading">{title}</h2>
        <span className="sv-caption font-bold text-fg-muted tabular-nums">{caption}</span>
      </div>
      <PixelPanel className="px-4 py-0">
        {missions.map((m, i) => (
          <MissionRow key={m.key} m={m} divider={i < missions.length - 1} />
        ))}
      </PixelPanel>
    </section>
  )
}

function MissionRow({ m, divider }: { m: Mission; divider: boolean }) {
  return (
    <Row
      divider={divider}
      leading={
        <span
          aria-hidden
          className={`w-6 h-6 shrink-0 flex items-center justify-center border-2 ${
            m.completed ? 'bg-mint border-mint text-background' : 'border-mint'
          }`}
        >
          {m.completed && <Glyph name="check" size={16} />}
        </span>
      }
      trailing={
        <span className={`sv-figure ${m.completed ? 'text-fg-muted' : 'text-mint'}`}>
          +{m.xpReward} XP
        </span>
      }
    >
      <div className="flex flex-col gap-0.5 py-2">
        <span
          className={`text-[15px] leading-[1.35] font-semibold sv-break ${
            m.completed ? 'text-fg-muted' : ''
          }`}
        >
          {m.name}
          {m.completed && <span className="sr-only"> (completed)</span>}
        </span>
        {!m.completed && (
          <span className="sv-caption font-medium leading-[1.35] text-fg-muted">
            {m.description}
          </span>
        )}
      </div>
    </Row>
  )
}

function EmptyPanel({ tone }: { tone: 'repeating' | 'onetime' }) {
  return (
    <PixelPanel className="p-6 text-center flex flex-col gap-2">
      <p className="sv-body text-fg-muted">No missions right now.</p>
      <p className="sv-label text-fg-faint">
        {tone === 'repeating'
          ? 'Check back after the next reset.'
          : 'One-time missions appear as you play.'}
      </p>
    </PixelPanel>
  )
}

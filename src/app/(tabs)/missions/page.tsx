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

import { useEffect, useState, type ReactNode } from 'react'
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
import { Meter } from '@/components/ui/Meter'
import { earnedXp, xpCounter } from '@/lib/missions-ui'
import { apiFetch } from '@/lib/client-session'

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
  progress?: { current: number; target: number }
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
        const res = await apiFetch('/api/missions', { headers: authHeaders() })
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
  const oneTimeDone = oneTime.filter((m) => m.completed).length
  const oneTimeXp = oneTime.reduce((sum, m) => sum + (m.completed ? m.xpReward : 0), 0)
  // Open goals first, finished ones at the bottom: the tab is a to-do list,
  // not an archive. A stable sort keeps the API order inside each group.
  const oneTimeOrdered = [...oneTime].sort(
    (a, b) => Number(a.completed) - Number(b.completed),
  )

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
          daily.length === 0 && weekly.length === 0 ? (
            <EmptyPanel tone="repeating" />
          ) : (
            <GroupList>
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
            </GroupList>
          )
        ) : oneTime.length > 0 ? (
          <GroupList>
            <Group
              title="Milestones"
              reset="Never expires"
              missions={oneTimeOrdered}
              caption={`${oneTimeDone} of ${oneTime.length} complete · ${oneTimeXp} XP earned`}
              progress={{ value: oneTimeDone, max: oneTime.length }}
            />
          </GroupList>
        ) : (
          <EmptyPanel tone="onetime" />
        )
      )}
    </ScreenShell>
  )
}

/** 36px between groups; the shell keeps 14px from the tabs to the first group. */
function GroupList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-9">{children}</div>
}

function Group({
  title,
  reset,
  missions,
  cap,
  caption,
  progress,
}: {
  title: string
  reset: string
  missions: Mission[]
  cap?: number
  /** Overrides the reset/cap line, e.g. the one-time completion counter. */
  caption?: string
  /** Optional completion meter, currently used by the one-time goals. */
  progress?: { value: number; max: number }
}) {
  const text =
    caption ?? (cap === undefined ? reset : `${reset} · ${xpCounter(earnedXp(missions, cap), cap)}`)

  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h2 className="sv-subheading">{title}</h2>
        <span className="sv-caption font-bold text-fg-muted tabular-nums">{text}</span>
      </div>
      {progress && (
        <Meter
          value={progress.value}
          max={progress.max}
          height={10}
          label={`${title} complete`}
        />
      )}
      <PixelPanel className="px-4 py-2">
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
        {m.progress ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Meter
              value={m.progress.current}
              max={m.progress.target}
              height={14}
              label={`${m.name} wins`}
              className="w-[90px] shrink-0"
            />
            <span className="sv-caption font-medium leading-[1.35] text-fg-muted tabular-nums">
              {m.progress.current} of {m.progress.target} wins
            </span>
          </div>
        ) : !m.completed ? (
          <span className="sv-caption font-medium leading-[1.35] text-fg-muted">
            {m.description}
          </span>
        ) : null}
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

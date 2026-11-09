/**
 * Savborne — Missions screen
 *
 * Lists all 10 missions grouped by cadence (Daily / Weekly / One-time) with
 * a completed / open pill and XP value. Pulls from `GET /api/missions`.
 * Below the mission list, the daily/weekly XP cap meters show how much of
 * the 25 XP / 100 XP budget has been spent.
 */

'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Row } from '@/components/ui/Row'
import { Chip } from '@/components/ui/Chip'
import { Banner } from '@/components/ui/Banner'
import { LoadingState } from '@/components/ui/LoadingState'

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

export default function MissionsPage() {
  const router = useRouter()
  const [missions, setMissions] = useState<Mission[] | null>(null)
  const [counters, setCounters] = useState<Counters | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/missions', { headers: authHeaders() })
        if (res.status === 401) {
          router.replace('/setup')
          return
        }
        if (!res.ok) throw new Error(`${res.status}`)
        const json = (await res.json()) as { missions: Mission[]; counters: Counters }
        if (!cancelled) {
          setMissions(json.missions)
          setCounters(json.counters)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load missions')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (loading) {
    return (
      <ScreenShell variant="tab" title="Missions">
        <LoadingState />
      </ScreenShell>
    )
  }

  if (error) {
    return (
      <ScreenShell variant="tab" title="Missions">
        <Banner tone="error">{error}</Banner>
      </ScreenShell>
    )
  }

  if (!missions || !counters) return null

  const daily = missions.filter((m) => m.type === 'daily')
  const weekly = missions.filter((m) => m.type === 'weekly')
  const oneTime = missions.filter((m) => m.type === 'onetime')

  return (
    <ScreenShell variant="tab" title="Missions" bodyClassName="gap-3.5">
      <CapMeters counters={counters} />

      <Section title="Daily" caption="Resets 00:00 UTC">
        {daily.map((m, i) => (
          <MissionRow key={m.key} m={m} divider={i < daily.length - 1} />
        ))}
      </Section>
      <Section title="Weekly" caption="Resets Monday 00:00 UTC">
        {weekly.map((m, i) => (
          <MissionRow key={m.key} m={m} divider={i < weekly.length - 1} />
        ))}
      </Section>
      <Section title="One-time" caption="Never expires">
        {oneTime.map((m, i) => (
          <MissionRow key={m.key} m={m} divider={i < oneTime.length - 1} />
        ))}
      </Section>
    </ScreenShell>
  )
}

function CapMeters({ counters }: { counters: Counters }) {
  return (
    <section className="grid grid-cols-2 gap-3">
      <Cap label="Daily XP" value={counters.dailyXpEarned} max={counters.dailyXpCap} />
      <Cap label="Weekly XP" value={counters.weeklyXpEarned} max={counters.weeklyXpCap} />
    </section>
  )
}

function Cap({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="vpx-soft bg-surface p-3 flex flex-col gap-1">
      <span className="sv-section-label text-fg-faint">{label}</span>
      <span className="sv-figure">
        {value} <span className="text-fg-faint">/ {max}</span>
      </span>
      <div className="h-1.5 bg-surface-low overflow-hidden">
        <div className="h-full bg-butter" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Section({
  title,
  caption,
  children,
}: {
  title: string
  caption: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="sv-subheading text-mint">{title}</h2>
        <span className="sv-label text-fg-faint">{caption}</span>
      </div>
      <PixelPanel className="px-4 py-0">{children}</PixelPanel>
    </section>
  )
}

function MissionRow({ m, divider }: { m: Mission; divider: boolean }) {
  return (
    <Row
      divider={divider}
      trailing={
        <span className={`sv-figure ${m.completed ? 'text-mint' : 'text-butter-text'}`}>
          +{m.xpReward}
        </span>
      }
    >
      <div className="flex flex-col gap-1 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`sv-label ${m.completed ? 'text-mint' : 'text-foreground'}`}>
            {m.name}
          </span>
          {m.completed && <Chip variant="fill">Done</Chip>}
        </div>
        <p className="sv-label text-fg-muted">{m.description}</p>
        {m.nextResetAt && !m.completed && (
          <p className="sv-label text-fg-faint">Resets {formatTime(m.nextResetAt)}</p>
        )}
      </div>
    </Row>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
  if (sameDay) return `today ${d.toISOString().slice(11, 16)} UTC`
  return `${d.toISOString().slice(5, 10)} ${d.toISOString().slice(11, 16)} UTC`
}

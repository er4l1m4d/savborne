/**
 * Savborne — Missions screen
 *
 * Lists all 10 missions grouped by cadence (Daily / Weekly / One-time) with
 * a completed / open pill and XP value. Pulls from `GET /api/missions`.
 * Below the mission list, the daily/weekly XP cap meters show how much of
 * the 25 XP / 100 XP budget has been spent.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders } from '@/lib/session'

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

  if (loading) return <Screen msg="Loading missions…" />
  if (error) return <Screen msg={error} tone="error" />
  if (!missions || !counters) return null

  const daily = missions.filter((m) => m.type === 'daily')
  const weekly = missions.filter((m) => m.type === 'weekly')
  const oneTime = missions.filter((m) => m.type === 'onetime')

  return (
    <main className="p-(--gut) max-w-105 mx-auto w-full flex flex-col gap-5">
      <header className="mt-4">
        <h1
          className="text-3xl leading-none"
          style={{ fontFamily: 'var(--font-silkscreen)' }}
        >
          Missions
        </h1>
      </header>

      <CapMeters counters={counters} />

      <Section title="Daily" caption="Resets 00:00 UTC">
        {daily.map((m) => <MissionRow key={m.key} m={m} />)}
      </Section>
      <Section title="Weekly" caption="Resets Monday 00:00 UTC">
        {weekly.map((m) => <MissionRow key={m.key} m={m} />)}
      </Section>
      <Section title="One-time" caption="Never expires">
        {oneTime.map((m) => <MissionRow key={m.key} m={m} />)}
      </Section>
    </main>
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
      <span className="text-[10px] uppercase tracking-widest text-fg-faint font-bold">
        {label}
      </span>
      <span className="num text-lg font-bold">
        {value} <span className="text-fg-faint text-sm">/ {max}</span>
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
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-mint">{title}</h2>
        <span className="text-[10px] text-fg-faint">{caption}</span>
      </div>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  )
}

function MissionRow({ m }: { m: Mission }) {
  return (
    <li
      className={`vpx-soft p-3 flex items-start justify-between gap-3 ${
        m.completed ? 'bg-surface-hi' : 'bg-surface'
      }`}
    >
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-bold truncate ${m.completed ? 'text-mint' : 'text-foreground'}`}>
            {m.name}
          </span>
          {m.completed && (
            <span className="text-[10px] uppercase tracking-widest text-mint shrink-0">
              ✓ Done
            </span>
          )}
        </div>
        <p className="text-xs text-fg-muted leading-snug">{m.description}</p>
        {m.nextResetAt && !m.completed && (
          <p className="text-[10px] text-fg-faint">Resets {formatTime(m.nextResetAt)}</p>
        )}
      </div>
      <span
        className={`num shrink-0 text-sm font-bold ${m.completed ? 'text-mint' : 'text-butter-text'}`}
      >
        +{m.xpReward}
      </span>
    </li>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
  if (sameDay) return `today ${d.toISOString().slice(11, 16)} UTC`
  return `${d.toISOString().slice(5, 10)} ${d.toISOString().slice(11, 16)} UTC`
}

function Screen({ msg, tone = 'muted' }: { msg: string; tone?: 'muted' | 'error' }) {
  return (
    <main className="min-h-dvh flex items-center justify-center p-(--gut)">
      <p
        className={
          tone === 'error'
            ? 'vpx bg-coral-tint p-4 text-coral-text text-sm max-w-90'
            : 'text-fg-muted text-sm'
        }
      >
        {msg}
      </p>
    </main>
  )
}

/**
 * Savborne - Home
 *
 * The handoff's landing screen: wordmark header with bracket/level chips, a
 * character card and XP bar, a savings card that owns the check-in action, the
 * two daily missions and a Battle card. The check-in summary appears inline
 * when the player stays on Home.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WalletError, signMessage } from '@/lib/nimiq'
import { authHeaders } from '@/lib/session'
import {
  checkInAuthHeaders,
  checkInErrorMessage,
  checkInMessage,
} from '@/lib/checkin-request'
import { usePlayerSession, type PlayerMe } from '@/lib/usePlayerSession'
import {
  BATTLE,
  BRACKETS,
  LUNA_PER_NIM,
  xpProgress,
  type Bracket,
} from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import { BADGES, type BadgeAction } from '@/lib/game/badges'
import { checkedInToday, formatHoursMinutes, streakAtRisk } from '@/lib/checkin-state'
import {
  checkInDestination,
  takeCheckInAwards,
  writeBracketHandoff,
  writeCheckInAwards,
  writeFirstCheckInHandoff,
  writeWithdrawalHandoff,
} from '@/lib/checkin-handoff'
import { CharacterArt } from '@/components/CharacterArt'
import { ItemArt } from '@/components/ItemArt'
import { BadgeArt, Glyph } from '@/components/Glyphs'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Row } from '@/components/ui/Row'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Banner } from '@/components/ui/Banner'
import { FiatValue } from '@/components/FiatValue'
import { takeBalanceRetry } from '@/lib/balance-retry'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiFetch } from '@/lib/client-session'

type MissionStatus = {
  key: string
  name: string
  completed: boolean
  xpReward: number
}

type AwardSummary = {
  awarded: { key: string; xpApplied: number; xpCapped: number; onetime: boolean }[]
  leveledUp: boolean
  newLevel: number
  bracketChanged: boolean
  withdrawalDetected: boolean
  bracket: Bracket | null
  previousBracket: Bracket | null
  balanceLuna: number
  previousBalanceLuna: number | null
  unlockedItems: ItemKey[]
  badgeActions: BadgeAction[]
}

export default function HomePage() {
  const router = useRouter()
  const { session, player, loading, needsReconnect, error, refresh } = usePlayerSession()
  const [checking, setChecking] = useState(false)
  const [awards, setAwards] = useState<AwardSummary | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [dailyMissions, setDailyMissions] = useState<MissionStatus[] | null>(null)
  const [deltaLuna, setDeltaLuna] = useState(0)
  // Ticks the streak-risk countdown. Half a minute keeps the minutes honest
  // without re-rendering Home on every second.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (loading) return
    if (needsReconnect || session === null) router.replace('/setup')
  }, [loading, needsReconnect, session, router])

  const onCheckIn = useCallback(async () => {
    if (!session) return
    setChecking(true)
    setCheckError(null)
    setAwards(null)
    try {
      // The address header is identity; the signature is authority. Sign the
      // same address the request carries, with a fresh timestamp so the server
      // can bound replay. Nimiq Pay applies the signed-message envelope.
      const address = session.playerAddress
      const signedAt = Date.now()
      const proof = await signMessage(checkInMessage({ address, signedAt }))
      const res = await apiFetch('/api/check-ins', {
        method: 'POST',
        headers: authHeaders(checkInAuthHeaders({ ...proof, signedAt })),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let code: string | undefined
        try {
          code = (JSON.parse(text) as { error?: string }).error
        } catch {
          // Not JSON; keep the generic inline error.
        }
        if (res.status === 503 && code === 'rpc_unreachable') {
          router.push('/balance-error')
          return
        }
        // A proof rejection is actionable; show it in the existing Banner
        // instead of a generic "Check-in failed (401)".
        if (
          (res.status === 400 || res.status === 401) &&
          code !== undefined &&
          ['missing', 'malformed', 'stale', 'bad_signature', 'wrong_signer'].includes(code)
        ) {
          setCheckError(checkInErrorMessage(code, res.status))
          return
        }
        throw new Error(`Check-in failed (${res.status}): ${text}`)
      }
      const json = (await res.json()) as AwardSummary & { ok: true }
      setDeltaLuna(
        json.previousBalanceLuna === null ? 0 : json.balanceLuna - json.previousBalanceLuna,
      )
      await refresh()

      const destination = checkInDestination({
        ...json,
        firstCheckIn: json.awarded.some((award) => award.key === 'first_steps'),
      })

      if (destination === 'first-checkin') {
        const first = json.awarded.find((award) => award.key === 'first_steps')
        const stored = writeFirstCheckInHandoff({
          xp: first?.xpApplied ?? 20,
          balanceLuna: json.balanceLuna,
          bracket: json.bracket,
          items: json.unlockedItems,
        })
        if (stored) {
          writeCheckInAwards(json)
          router.push('/first-checkin')
          return
        }
      }

      if (destination === 'withdrawal') {
        const stored = writeWithdrawalHandoff({
          fromLuna: json.previousBalanceLuna ?? player?.balanceLuna ?? json.balanceLuna,
          toLuna: json.balanceLuna,
          revoked: json.badgeActions
            .filter((action) => action.kind === 'revoke')
            .map((action) => action.badge),
        })
        if (stored) {
          writeCheckInAwards(json)
          router.push('/withdrawal')
          return
        }
      }

      if (destination === 'bracket-climb' && json.bracket) {
        const stored = writeBracketHandoff({
          bracket: json.bracket,
          xp: json.awarded.find((award) => award.key === 'bracket_climb')?.xpApplied ?? 0,
          items: json.unlockedItems,
        })
        if (stored) {
          writeCheckInAwards(json)
          router.push('/bracket-climb')
          return
        }
      }

      setAwards(json)
      void fetchDailyMissions()
    } catch (err) {
      setCheckError(describeError(err))
    } finally {
      setChecking(false)
    }
  }, [session, player, refresh, router])

  useEffect(() => {
    if (loading || !session || !player) return
    const timer = setTimeout(() => {
      if (!takeBalanceRetry()) return
      void onCheckIn()
    }, 0)
    return () => clearTimeout(timer)
  }, [loading, session, player, onCheckIn])

  async function fetchDailyMissions() {
    try {
      const res = await apiFetch('/api/missions', { headers: authHeaders() })
      if (!res.ok) return
      const json = (await res.json()) as {
        missions: {
          key: string
          name: string
          completed: boolean
          xpReward?: number
          xp_reward?: number
        }[]
        counters: { dailyXpEarned: number }
      }
      const filtered = (json.missions ?? [])
        .filter((m) => m.key === 'daily_check_in' || m.key === 'quick_duel')
        .map((m) => ({
          key: m.key,
          name: m.name,
          completed: m.completed,
          xpReward: m.xpReward ?? m.xp_reward ?? 0,
        }))
      setDailyMissions(filtered)
    } catch {
      /* non-fatal - daily missions are supplementary */
    }
  }

  useEffect(() => {
    const stored = takeCheckInAwards<AwardSummary>()
    if (stored) setAwards(stored)
    void fetchDailyMissions()
  }, [])

  if (loading || !player) {
    return (
      <ScreenShell variant="tab" title="Savborne">
        <LoadingState />
      </ScreenShell>
    )
  }

  if (error) {
    return (
      <ScreenShell variant="tab" title="Savborne">
        <Banner tone="error">{error}</Banner>
        <Button variant="ghost" className="self-start" onClick={() => void refresh()}>
          Try again
        </Button>
      </ScreenShell>
    )
  }

  const bracket = player.bracket as Bracket | null
  const alreadyCheckedIn = checkedInToday(player.lastCheckInAt)
  const battlesLeft = Math.max(0, BATTLE.dailyLimit - player.battlesToday)
  const streakRiskMs = streakAtRisk(player.streakCurrent, player.lastCheckInAt, now)

  return (
    <ScreenShell
      variant="tab"
      title="Savborne"
      actions={
        <>
          {bracket && (
            <Chip variant="outline" color={BRACKETS[bracket].color}>
              {BRACKETS[bracket].label}
            </Chip>
          )}
          <Chip variant="fill">Lv {player.level}</Chip>
        </>
      }
    >
      <CharacterCard player={player} bracket={bracket} />

      <PixelPanel tourAnchor="home-savings" className="p-4 flex flex-col gap-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="sv-label font-bold text-fg-muted">Savings account</span>
          <span
            className={`sv-label ${alreadyCheckedIn ? 'text-mint font-bold' : 'text-fg-muted'}`}
          >
            {alreadyCheckedIn ? 'Checked in just now' : lastCheckInText(player.lastCheckInAt)}
          </span>
        </div>

        {/* Two steady rows: the balance owns the first, and the second holds the
            secondary facts — the fiat conversion on the left, the streak or the
            change on the right. The chip used to share the balance row, so a
            four-figure balance pushed it onto a line of its own, wedged between
            the number and the fiat value. */}
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="sv-number-xl">{(player.balanceLuna / LUNA_PER_NIM).toFixed(2)}</span>
            <span className="sv-label text-fg-muted">NIM</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <FiatValue
              nim={player.balanceLuna / LUNA_PER_NIM}
              className="sv-label text-fg-faint"
            />
            <span className="shrink-0">
              {deltaLuna !== 0 ? (
                <Chip
                  variant="outline"
                  color={deltaLuna > 0 ? 'var(--mint)' : 'var(--coral-text)'}
                >
                  {deltaLuna > 0 ? '+' : '-'}
                  {(Math.abs(deltaLuna) / LUNA_PER_NIM).toFixed(2)} since last
                </Chip>
              ) : player.streakCurrent > 0 ? (
                <Chip variant="outline" color="var(--coral-text)">
                  {player.streakCurrent}-day streak
                </Chip>
              ) : null}
            </span>
          </div>
        </div>

        {streakRiskMs !== null && (
          <p className="sv-label text-coral-text">
            {formatHoursMinutes(streakRiskMs)} left to check in and keep your streak
          </p>
        )}

        <Button
          variant="primary"
          size="lg"
          onClick={onCheckIn}
          disabled={alreadyCheckedIn}
          loading={checking}
          data-tour="checkin"
        >
          {checking ? (
            'Reading balance…'
          ) : alreadyCheckedIn ? (
            <>
              <Glyph name="check" size={24} /> Checked in today
            </>
          ) : (
            'Check in now'
          )}
        </Button>

        {checkError && <Banner tone="error">{checkError}</Banner>}

        <ButtonLink href="/vault" variant="ghost" className="self-start" data-tour="vault-link">
          Open vault
        </ButtonLink>
      </PixelPanel>

      {dailyMissions && <MissionsPanel missions={dailyMissions} />}
      <BattleCard battlesLeft={battlesLeft} />
      {awards && <AwardsPanel awards={awards} />}
    </ScreenShell>
  )
}

function CharacterCard({ player, bracket }: { player: PlayerMe; bracket: Bracket | null }) {
  const { inLevel, toNext } = xpProgress(player.level, player.xp)
  const pct = Math.min(100, Math.round((inLevel / toNext) * 100))
  return (
    <PixelPanel className="p-4 flex items-center gap-4">
      <div
        className="w-[132px] h-[176px] shrink-0 flex items-center justify-center"
        style={{ background: 'var(--sprite-well)' }}
      >
        <CharacterArt bracket={bracket} character={player.avatar} size={96} />
      </div>
      <div className="min-w-0 flex flex-1 flex-col gap-1.5">
        <h2 className="sv-heading sv-break">{player.displayName}</h2>
        <p className="sv-label text-fg-muted">
          Level {player.level} · {bracket ? BRACKETS[bracket].label : 'No bracket'}
        </p>
        <div className="h-3.5 border-2 border-bevel bg-background mt-1">
          <div className="h-full bg-mint" style={{ width: `${pct}%` }} />
        </div>
        <p className="sv-label text-fg-faint">
          {Math.max(0, toNext - inLevel)} XP to Level {player.level + 1}
        </p>
      </div>
    </PixelPanel>
  )
}

function MissionsPanel({ missions }: { missions: MissionStatus[] }) {
  return (
    <PixelPanel className="px-4 py-0">
      {missions.map((mission, index) => (
        <Row key={mission.key} divider={index < missions.length - 1}>
          <div className="flex items-center gap-3.5">
            <span
              className={`w-6 h-6 shrink-0 flex items-center justify-center border-2 ${
                mission.completed ? 'bg-mint border-mint text-background' : 'border-mint'
              }`}
              aria-hidden
            >
              {mission.completed && <Glyph name="check" size={16} />}
            </span>
            <span
              className={`sv-body font-semibold ${mission.completed ? 'text-fg-muted' : ''}`}
            >
              {mission.name}
            </span>
            <span
              className={`ml-auto sv-label font-bold ${
                mission.completed ? 'text-fg-muted' : 'text-mint'
              }`}
            >
              +{mission.xpReward} XP{mission.completed ? ' earned' : ''}
            </span>
          </div>
        </Row>
      ))}
    </PixelPanel>
  )
}

function BattleCard({ battlesLeft }: { battlesLeft: number }) {
  return (
    <PixelPanel tone="cream" className="p-3.5 flex items-center gap-3.5">
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <span className="sv-subheading">Battle</span>
        <span className="sv-label font-bold text-background/70">
          {battlesLeft} battle{battlesLeft === 1 ? '' : 's'} left today
        </span>
      </div>
      <ButtonLink href="/battle" variant="primary" size="md" fullWidth={false}>
        Choose opponent
      </ButtonLink>
    </PixelPanel>
  )
}

function lastCheckInText(iso: string | null): string {
  if (!iso) return 'Not checked in yet'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Not checked in yet'
  return `Last check-in ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })}`
}

function AwardsPanel({ awards }: { awards: AwardSummary }) {
  const totalXp = awards.awarded.reduce((s, a) => s + a.xpApplied, 0)
  const cappedCount = awards.awarded.filter((a) => a.xpCapped > 0).length
  return (
    <PixelPanel tone="mint" className="p-4 flex flex-col gap-2">
      <h2 className="sv-subheading text-mint">
        +{totalXp} XP{awards.leveledUp ? ` - Level up! Now level ${awards.newLevel}` : ''}
      </h2>
      <ul className="sv-label text-fg-soft flex flex-col gap-1">
        {awards.awarded.length === 0 && <li>Checked in. Balance recorded.</li>}
        {awards.awarded.map((a) => (
          <li key={a.key} className="flex justify-between gap-2">
            <span className="capitalize">{a.key.replace(/_/g, ' ')}</span>
            <span className="num text-mint">+{a.xpApplied}</span>
          </li>
        ))}
      </ul>
      {cappedCount > 0 && (
        <p className="sv-label text-fg-faint">
          Some XP was capped by the daily/weekly mission limits.
        </p>
      )}
      {awards.bracketChanged && (
        <p className="sv-label text-butter-text">
          Your bracket changed - check your items for new unlocks.
        </p>
      )}
      {awards.withdrawalDetected && (
        <p className="sv-label text-coral-text">
          Balance dropped since your last check-in. Streak badges are removed;
          everything else stays.
        </p>
      )}
      {awards.unlockedItems.length > 0 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-line">
          <span className="sv-section-label text-butter-text">New items unlocked</span>
          <ul className="grid grid-cols-2 gap-2">
            {awards.unlockedItems.map((k) => {
              const it = ITEMS.find((i) => i.key === k)
              return it ? (
                <li
                  key={k}
                  className="flex items-center gap-2.5 bg-sprite-well border-2 border-line p-2.5"
                >
                  <ItemArt item={k} size={32} />
                  <span className="sv-label font-bold leading-tight">{it.name}</span>
                </li>
              ) : null
            })}
          </ul>
        </div>
      )}
      {awards.badgeActions.length > 0 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-line">
          <span className="sv-section-label text-mint">Badges</span>
          <ul className="flex flex-col gap-1.5">
            {awards.badgeActions.map((a) => {
              const b = BADGES.find((x) => x.key === a.badge)
              const state = a.kind === 'award' ? 'earned' : 'removed'
              return (
                <li key={`${a.kind}-${a.badge}`} className="flex items-center gap-2.5">
                  <BadgeArt
                    badge={a.badge}
                    state={state}
                    size={32}
                    title={`${b?.name ?? a.badge} ${state}`}
                  />
                  <span className="sv-label font-bold">
                    {b?.name ?? a.badge}
                    <span className={a.kind === 'award' ? ' text-mint' : ' text-coral-text'}>
                      {' '}
                      {state}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </PixelPanel>
  )
}

function describeError(err: unknown): string {
  if (err instanceof WalletError) {
    switch (err.type) {
      case 'NETWORK_ERROR':
        return 'The Nimiq network is busy. Try checking in again in a moment.'
      case 'PERMISSION_DENIED':
        return 'Check-in needs your wallet signature. Tap Check in now to try again.'
      default:
        return err.message || 'Could not read your balance.'
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong. Try again.'
}

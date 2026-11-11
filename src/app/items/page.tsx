'use client'

/**
 * Savborne - Items
 *
 * Every item is visible from the first day; ownership only changes the state
 * line and the panel tone. Items never re-lock after a withdrawal, so a locked
 * item means "not reached yet", never "lost".
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authHeaders, readSession } from '@/lib/session'
import { BRACKETS, type Bracket } from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'
import type { BadgeKey } from '@/lib/game/badges'
import { ItemArt } from '@/components/ItemArt'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Chip } from '@/components/ui/Chip'
import { Banner } from '@/components/ui/Banner'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { apiFetch } from '@/lib/client-session'

type ItemsData = {
  player: { bracket: Bracket | null }
  ownedItems: ItemKey[]
  activeBadges: BadgeKey[]
}

export default function ItemsPage() {
  const router = useRouter()
  const [data, setData] = useState<ItemsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    let redirected = false
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/profile', { headers: authHeaders() })
      if (res.status === 401) {
        redirected = true
        router.replace('/setup')
        return
      }
      if (!res.ok) throw new Error(`Could not load items (${res.status}).`)
      setData((await res.json()) as ItemsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load items.')
    } finally {
      if (!redirected) setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!readSession()) {
      router.replace('/setup')
      return
    }
    void load()
  }, [load, router])

  const owned = new Set<ItemKey>(data?.ownedItems ?? [])
  if (data?.activeBadges.includes('golden_crown')) owned.add('golden_crown')
  const unlockedCount = ITEMS.filter((item) => owned.has(item.key)).length

  return (
    <ScreenShell
      variant="pushed"
      title="Items"
      backHref="/profile"
      actions={
        <Chip variant="outline">
          {unlockedCount} of {ITEMS.length} unlocked
        </Chip>
      }
    >
      {loading ? (
        <LoadingState />
      ) : error || !data ? (
        <>
          <Banner tone="error">{error ?? 'Could not load items.'}</Banner>
          <Button variant="ghost" className="self-start" onClick={() => void load()}>
            Retry
          </Button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {ITEMS.map((item) => {
              const unlocked = owned.has(item.key)
              const bracket = BRACKETS[item.bracket]
              return (
                <PixelPanel
                  key={item.key}
                  tone={unlocked ? 'default' : 'off'}
                  className="p-3 flex flex-col gap-2 min-h-[120px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <ItemArt item={item.key} size={48} />
                    <span className="sv-label text-fg-muted">{bracket.label}</span>
                  </div>
                  <span className={`sv-label font-bold ${unlocked ? 'text-fg' : 'text-fg-muted'}`}>
                    {item.name}
                  </span>
                  <span className={`sv-label ${unlocked ? 'text-mint' : 'text-fg-faint'}`}>
                    {unlocked ? item.blurb : `Locked: reach ${bracket.label} to unlock.`}
                  </span>
                </PixelPanel>
              )
            })}
          </div>

          <PixelPanel tone="off" className="p-3">
            <p className="sv-label text-fg-muted">
              Still yours. Items stay after a withdrawal; only the streak badges reset.
            </p>
          </PixelPanel>
        </>
      )}
    </ScreenShell>
  )
}

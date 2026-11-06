/**
 * Savborne — public flex card
 *
 * A shareable, read-only page: no wallet, no session, no login. It shows a
 * player's name, level, streak, shields and bracket — and a shortened vault
 * address as proof of a real on-chain vault. It never shows the balance and
 * never shows the player's wallet address.
 *
 * `params` is a Promise in this Next version; not awaiting it leaves `token`
 * undefined and the 404 path never fires.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { BRACKETS } from '@/lib/constants'
import { getFlexCard } from '@/lib/vault/cards'
import { PixelPanel } from '@/components/ui/PixelPanel'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const card = await getFlexCard(token)
  if (!card) return { title: 'Savborne card not found' }
  return {
    title: `${card.displayName} — Savborne`,
    description: `${card.displayName} is a Level ${card.level} saver on Savborne.`,
  }
}

export default async function CardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const card = await getFlexCard(token)
  if (!card) notFound()

  const bracket = card.bracket ? BRACKETS[card.bracket] : null

  return (
    <main className="min-h-dvh flex items-center justify-center p-(--gut)">
      <PixelPanel tone="off" wrapperClassName="max-w-90 w-full" className="p-6 flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <span className="sv-section-label text-fg-faint">Savborne saver</span>
          <h1 className="sv-heading sv-break">{card.displayName}</h1>
        </header>

        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Level" value={String(card.level)} />
          <Stat label="Streak" value={`${card.streakCurrent}d`} />
          <Stat label="Shields" value={String(card.shields)} />
        </dl>

        {bracket && (
          <div className="flex items-center gap-2">
            <span className="sv-section-label text-fg-faint">Bracket</span>
            <span className="sv-label font-bold" style={{ color: bracket.color }}>
              {bracket.label}
            </span>
          </div>
        )}

        <div className="vpx-soft bg-surface p-3 flex flex-col gap-1">
          <span className="sv-section-label text-fg-faint">
            {card.backupVerified ? 'Verified saver ⟡' : 'Vault in progress'}
          </span>
          <span className="sv-figure font-mono text-fg-soft sv-break">
            {card.shortVaultAddress}
          </span>
          <span className="sv-label text-fg-faint">
            Funds held in this player&apos;s own vault. Savborne never holds them.
          </span>
        </div>

        <p className="sv-label text-fg-faint">
          Balances are never public. This card proves a vault exists, not how much is in it.
        </p>
      </PixelPanel>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="sv-section-label text-fg-faint">{label}</dt>
      <dd className="sv-number-m">{value}</dd>
    </div>
  )
}

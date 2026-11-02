/**
 * Savborne — flex-card OG image
 *
 * Generated per token, request-time. Uses the default font only: fetching a
 * font here would add an asset dependency and risk the bundle limit, and a
 * plain sans reads fine at social-card size.
 *
 * Same data as the page, same omissions: no balance, no wallet address.
 */

import { ImageResponse } from 'next/og'
import { BRACKETS } from '@/lib/constants'
import { getFlexCard } from '@/lib/vault/cards'

export const alt = 'Savborne saver card'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Params are request-time anyway; this makes it explicit so the image is never
// cached as one token's snapshot under another.
export const dynamic = 'force-dynamic'

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const card = await getFlexCard(token)

  const name = card?.displayName ?? 'Savborne'
  const level = card?.level ?? 0
  const streak = card?.streakCurrent ?? 0
  const shields = card?.shields ?? 0
  const bracketLabel = card?.bracket ? BRACKETS[card.bracket].label : '—'
  const vaultLine = card?.backupVerified
    ? `Verified saver ⟡  ${card.shortVaultAddress}`
    : card
      ? card.shortVaultAddress
      : 'Card not found'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#152420',
          color: '#EAF2EE',
          padding: '64px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 28, letterSpacing: 8, color: '#7A9187', textTransform: 'uppercase' }}>
            Savborne saver
          </div>
          <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1 }}>{name}</div>
        </div>

        <div style={{ display: 'flex', gap: 64 }}>
          <Metric label="Level" value={String(level)} />
          <Metric label="Streak" value={`${streak}d`} />
          <Metric label="Shields" value={String(shields)} />
          <Metric label="Bracket" value={bracketLabel} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 30, color: '#3FE0A6' }}>{vaultLine}</div>
          <div style={{ fontSize: 24, color: '#7A9187' }}>
            Funds held in their own vault. Balances are never public.
          </div>
        </div>
      </div>
    ),
    size,
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 22, letterSpacing: 4, color: '#7A9187', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 56, fontWeight: 700, color: '#EAF2EE' }}>{value}</div>
    </div>
  )
}

/**
 * Savborne - privacy notice
 *
 * `onboarding` is the short step: the short version, the two cards that matter
 * most and one closed disclosure for public/storage. `full` is the reference
 * version in Settings > How Savborne works. `compact` is the Settings sheet.
 * All three read `src/lib/privacy.ts`.
 */

import { PixelPanel } from '@/components/ui/PixelPanel'
import {
  PRIVACY_CARDS,
  PRIVACY_DISCLOSURE_TITLE,
  PRIVACY_NOTICE_VERSION,
  PRIVACY_RISK,
  PRIVACY_SHORT_VERSION,
  type PrivacyCard,
} from '@/lib/privacy'

function toneClass(tone: PrivacyCard['tone']): string {
  if (tone === 'mint') return 'text-mint'
  if (tone === 'coral') return 'text-coral-text'
  return 'text-fg-muted'
}

function ShortPanel() {
  return (
    <PixelPanel tone="mint" className="p-4 flex flex-col gap-1.5">
      <h2 className="sv-label text-mint">The short version</h2>
      <p className="text-[15px] leading-[1.5] font-semibold">{PRIVACY_SHORT_VERSION}</p>
    </PixelPanel>
  )
}

function Card({ card, wide = false }: { card: PrivacyCard; wide?: boolean }) {
  return (
    <PixelPanel className={`${wide ? 'p-3.5' : 'p-3'} flex flex-col gap-2`}>
      <h2 className={`sv-label ${toneClass(card.tone)}`}>{card.title}</h2>
      <p className="text-[13px] leading-[1.45] font-medium text-fg-soft">{card.body}</p>
    </PixelPanel>
  )
}

function DisclosureCard({ card }: { card: PrivacyCard }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className={`sv-label ${toneClass(card.tone)}`}>{card.title}</h2>
      <p className="text-[13px] leading-[1.45] font-medium text-fg-soft">{card.body}</p>
    </div>
  )
}

function VersionLine() {
  return (
    <p className="sv-label text-fg-faint">
      Privacy notice version {PRIVACY_NOTICE_VERSION}.
    </p>
  )
}

export function PrivacyNotice({
  variant = 'compact',
}: {
  variant?: 'full' | 'compact' | 'onboarding'
}) {
  if (variant === 'onboarding') {
    return (
      <div className="flex flex-col gap-3">
        <ShortPanel />

        <div className="grid grid-cols-2 gap-3">
          {PRIVACY_CARDS.slice(0, 2).map((card) => (
            <Card key={card.key} card={card} />
          ))}
        </div>

        <details>
          <summary className="sv-label text-mint min-h-11 cursor-pointer py-3">
            {PRIVACY_DISCLOSURE_TITLE}
          </summary>
          <PixelPanel className="p-3.5 mt-1 flex flex-col gap-3">
            {PRIVACY_CARDS.slice(2).map((card) => (
              <DisclosureCard key={card.key} card={card} />
            ))}
            <VersionLine />
          </PixelPanel>
        </details>
      </div>
    )
  }

  if (variant === 'full') {
    return (
      <div className="flex flex-col gap-3">
        <ShortPanel />

        <div className="grid grid-cols-2 gap-3">
          {PRIVACY_CARDS.slice(0, 2).map((card) => (
            <Card key={card.key} card={card} />
          ))}
        </div>

        {PRIVACY_CARDS.slice(2).map((card) => (
          <Card key={card.key} card={card} wide />
        ))}

        <VersionLine />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {PRIVACY_CARDS.map((card) => (
        <p key={card.key} className="sv-label text-fg-soft">
          <strong>{card.title}.</strong> {card.body}
        </p>
      ))}
      <p className="sv-label text-fg-soft">
        <strong>The risk you are accepting.</strong> {PRIVACY_RISK}
      </p>
      <VersionLine />
    </div>
  )
}

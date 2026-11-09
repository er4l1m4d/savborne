'use client'

/**
 * Savborne - Hero/Heroine picker
 *
 * The two shipped character drawings as 56px toggles. `aria-pressed` carries
 * the selection; the mint border and label make it visible. Used in the Name
 * step and Settings.
 */

import { CharacterArt } from '@/components/CharacterArt'
import { Button } from '@/components/ui/Button'
import { AVATARS, type Avatar } from '@/lib/avatar'
import type { Bracket } from '@/lib/constants'

const LABELS: Record<Avatar, string> = { hero: 'Hero', heroine: 'Heroine' }

export function CharacterPicker({
  value,
  onChange,
  bracket = null,
  disabled = false,
}: {
  value: Avatar
  onChange: (avatar: Avatar) => void
  bracket?: Bracket | null
  disabled?: boolean
}) {
  return (
    <div role="group" aria-label="Character" className="grid grid-cols-2 gap-3">
      {AVATARS.map((option) => {
        const selected = option === value
        return (
          <Button
            key={option}
            variant="secondary"
            aria-pressed={selected}
            disabled={disabled}
            className={`justify-start gap-2 ${
              selected ? 'border-mint text-mint' : ''
            }`.trim()}
            onClick={() => onChange(option)}
          >
            <CharacterArt bracket={bracket} character={option} size={32} />
            <span>{LABELS[option]}</span>
          </Button>
        )
      })}
    </div>
  )
}

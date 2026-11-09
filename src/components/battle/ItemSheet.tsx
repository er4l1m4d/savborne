/**
 * Savborne - item sheet
 *
 * The in-battle item picker. Available items are real buttons; used and locked
 * items are disabled rows so the player can see the whole loadout and why the
 * unavailable rows are unavailable.
 */

import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { ItemArt } from '@/components/ItemArt'
import { BRACKETS } from '@/lib/constants'
import { ITEMS, type ItemKey } from '@/lib/game/items'

type ItemSheetProps = {
  open: boolean
  onClose: () => void
  available: ItemKey[]
  used: ItemKey[]
  locked: ItemKey[]
  onUse: (key: ItemKey) => void
  busy?: boolean
}

function ItemRow({
  itemKey,
  state,
  onUse,
  busy,
}: {
  itemKey: ItemKey
  state: 'available' | 'used' | 'locked'
  onUse: (key: ItemKey) => void
  busy: boolean
}) {
  const item = ITEMS.find((entry) => entry.key === itemKey)
  if (!item) return null

  const disabled = state !== 'available' || busy
  const className =
    state === 'available'
      ? 'border-mint'
      : state === 'locked'
        ? 'border-dashed border-bevel-soft'
        : ''

  const blurb =
    state === 'locked'
      ? `Locked: reach ${BRACKETS[item.bracket].label} to unlock.`
      : item.blurb

  return (
    <Button
      variant="secondary"
      size="item"
      fullWidth
      disabled={disabled}
      className={className}
      onClick={state === 'available' ? () => onUse(itemKey) : undefined}
    >
      <span className="shrink-0">
        <ItemArt item={itemKey} size={32} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="sv-label text-fg">{item.name}</span>
        <span className={`sv-label ${state === 'locked' ? 'text-fg-faint' : 'text-fg-muted'}`}>
          {blurb}
        </span>
      </span>
      <span
        className={`sv-label shrink-0 ${state === 'available' ? 'text-mint' : 'text-fg-muted'}`}
      >
        {state === 'available' ? 'Use' : state === 'used' ? 'Used' : 'Locked'}
      </span>
    </Button>
  )
}

export function ItemSheet({
  open,
  onClose,
  available,
  used,
  locked,
  onUse,
  busy = false,
}: ItemSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Use an item"
      headerAction={
        <Button variant="icon" onClick={onClose} aria-label="Close">
          <span aria-hidden className="text-2xl leading-none">
            ×
          </span>
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="sv-label text-fg-muted">Each item can be used once per battle.</p>
        {available.map((key) => (
          <ItemRow key={key} itemKey={key} state="available" onUse={onUse} busy={busy} />
        ))}
        {used.map((key) => (
          <ItemRow key={key} itemKey={key} state="used" onUse={onUse} busy={busy} />
        ))}
        {locked.map((key) => (
          <ItemRow key={key} itemKey={key} state="locked" onUse={onUse} busy={busy} />
        ))}
      </div>
    </BottomSheet>
  )
}

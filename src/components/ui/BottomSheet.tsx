'use client'

/**
 * Savborne — focus-trapped bottom sheet
 *
 * No consumer in Foundation 2: the delete confirmation (Economy) and the item
 * sheet (Battle) are its first users. It is built and tested now so those
 * batches do not invent a third modal pattern.
 */

import { useEffect, useId, useRef, type ReactNode } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // Keep the latest close callback without re-running the focus/scroll effect
  // whenever the parent re-renders. Consumers pass an inline arrow, so an
  // `onClose` dependency would tear down and re-run the effect on every busy
  // state change, briefly moving focus back to the trigger.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const panel = panelRef.current
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <button type="button" className="sv-scrim" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        className="sv-sheet-panel sv-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        {title && (
          <h2 id={titleId} className="sv-subheading">
            {title}
          </h2>
        )}
        {children}
      </div>
    </>
  )
}

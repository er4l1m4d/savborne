'use client'

/**
 * Savborne — copy-to-clipboard control for recovery phrases
 *
 * The app deliberately has no clipboard copy in onboarding: a phrase in the
 * clipboard outlives the screen that put it there. This control exists because
 * a player asked to be able to copy their words when checking a backup, and
 * because the delete gate needs an explicit copy step. It is only ever rendered
 * beside a phrase the player has already unlocked with their passphrase.
 *
 * `navigator.clipboard` is absent in some WebViews and rejects on non-secure
 * origins or when the permission is denied, so the legacy textarea + execCommand
 * path is a fallback for a *rejection*, not just for a missing API. If both
 * fail the button says so instead of displaying a false "Copied".
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'

type State = 'idle' | 'copied' | 'failed'

const LABELS: Record<State, string> = {
  idle: 'Copy words',
  copied: 'Copied to clipboard',
  failed: 'Copy failed — select the words',
}

export function CopyButton({
  text,
  label,
  onResult,
}: {
  text: string
  label?: string
  /** Called with the real outcome, so a gate can require a successful copy. */
  onResult?: (ok: boolean) => void
}) {
  const [state, setState] = useState<State>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  async function copy() {
    const ok = await writeClipboard(text)
    setState(ok ? 'copied' : 'failed')
    onResult?.(ok)

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2500)
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      fullWidth={false}
      onClick={copy}
      aria-live="polite"
      className={`self-start ${
        state === 'copied' ? 'text-mint' : state === 'failed' ? 'text-coral-text' : ''
      }`}
    >
      {state === 'idle' && (label ?? LABELS.idle)}
      {state === 'copied' && LABELS.copied}
      {state === 'failed' && LABELS.failed}
    </Button>
  )
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Denied or insecure origin — try the legacy path before giving up.
  }

  try {
    return legacyCopy(text)
  } catch {
    return false
  }
}

function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(area)
  return ok
}

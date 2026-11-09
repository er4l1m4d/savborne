/**
 * Savborne - one-shot hand-off from a check-in to a result screen
 *
 * The check-in POST returns everything the celebration screens need, but the
 * routes are separate. A transient sessionStorage record carries the result
 * across the navigation and is removed on read, so a refresh does not replay
 * yesterday's bracket climb.
 */

import type { Bracket } from './constants'
import type { BadgeKey } from './game/badges'
import type { ItemKey } from './game/items'

const BRACKET_KEY = 'savborne.bracket-climb.v1'
const WITHDRAWAL_KEY = 'savborne.withdrawal.v1'

export type BracketHandoff = {
  bracket: Bracket
  xp: number
  items: ItemKey[]
}

export type WithdrawalHandoff = {
  fromLuna: number
  toLuna: number
  revoked: BadgeKey[]
}

export type CheckInDestination = 'withdrawal' | 'bracket-climb' | 'home'

/**
 * A withdrawal is the more urgent explanation, so it wins when both flags are
 * set. A bracket change below the entry floor has no climb screen to show.
 */
export function checkInDestination(result: {
  withdrawalDetected: boolean
  bracketChanged: boolean
  bracket: Bracket | null
}): CheckInDestination {
  if (result.withdrawalDetected) return 'withdrawal'
  if (result.bracketChanged && result.bracket) return 'bracket-climb'
  return 'home'
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A blocked storage API only costs the celebration screen.
  }
}

function take<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    window.sessionStorage.removeItem(key)
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// React StrictMode runs mount effects twice in development. The first read
// removes the sessionStorage record; without a module cache the second read
// would look empty and the screen would fall back or redirect. A new check-in
// clears the cache.
let bracketCache: BracketHandoff | null | undefined
let withdrawalCache: WithdrawalHandoff | null | undefined

export function writeBracketHandoff(value: BracketHandoff) {
  bracketCache = undefined
  write(BRACKET_KEY, value)
}

export function takeBracketHandoff(): BracketHandoff | null {
  if (bracketCache !== undefined) return bracketCache
  bracketCache = take<BracketHandoff>(BRACKET_KEY)
  return bracketCache
}

export function writeWithdrawalHandoff(value: WithdrawalHandoff) {
  withdrawalCache = undefined
  write(WITHDRAWAL_KEY, value)
}

export function takeWithdrawalHandoff(): WithdrawalHandoff | null {
  if (withdrawalCache !== undefined) return withdrawalCache
  withdrawalCache = take<WithdrawalHandoff>(WITHDRAWAL_KEY)
  return withdrawalCache
}

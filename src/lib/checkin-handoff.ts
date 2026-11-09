/**
 * Savborne - one-shot hand-off from a check-in to a result screen
 *
 * The check-in POST returns everything the celebration screens need, but the
 * routes are separate. A transient sessionStorage record carries the result
 * across the navigation and is removed on read, so a refresh does not replay
 * yesterday's bracket climb.
 */

import { bracketRank, type Bracket } from './constants'
import type { BadgeKey } from './game/badges'
import type { ItemKey } from './game/items'

const BRACKET_KEY = 'savborne.bracket-climb.v1'
const WITHDRAWAL_KEY = 'savborne.withdrawal.v1'
const AWARDS_KEY = 'savborne.checkin-awards.v1'
const FIRST_KEY = 'savborne.first-checkin.v1'

export type BracketHandoff = {
  bracket: Bracket
  xp: number
  items: ItemKey[]
}

export type FirstCheckInHandoff = {
  xp: number
  balanceLuna: number
  bracket: Bracket | null
  items: ItemKey[]
}

export type WithdrawalHandoff = {
  fromLuna: number
  toLuna: number
  revoked: BadgeKey[]
}

export type CheckInDestination = 'first-checkin' | 'withdrawal' | 'bracket-climb' | 'home'

/**
 * A withdrawal is the more urgent explanation, so it wins when both flags are
 * set. A bracket change below the entry floor has no climb screen to show.
 */
export function checkInDestination(result: {
  firstCheckIn: boolean
  withdrawalDetected: boolean
  bracketChanged: boolean
  bracket: Bracket | null
  previousBracket: Bracket | null
}): CheckInDestination {
  if (result.firstCheckIn) return 'first-checkin'
  if (result.withdrawalDetected) return 'withdrawal'
  if (
    result.bracketChanged &&
    result.bracket &&
    bracketRank(result.bracket) > bracketRank(result.previousBracket)
  ) {
    return 'bracket-climb'
  }
  return 'home'
}

function write(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // The caller decides what to do when the hand-off cannot be stored.
    return false
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

// The record is consumed once. Each screen guards its mount effect with a ref
// so React StrictMode's second effect run does not look like a missing hand-off;
// a later mount (Back/Forward) really does find nothing and goes Home.
export function writeBracketHandoff(value: BracketHandoff): boolean {
  return write(BRACKET_KEY, value)
}

export function takeBracketHandoff(): BracketHandoff | null {
  return take<BracketHandoff>(BRACKET_KEY)
}

export function writeWithdrawalHandoff(value: WithdrawalHandoff): boolean {
  return write(WITHDRAWAL_KEY, value)
}

export function takeWithdrawalHandoff(): WithdrawalHandoff | null {
  return take<WithdrawalHandoff>(WITHDRAWAL_KEY)
}

export function writeFirstCheckInHandoff(value: FirstCheckInHandoff): boolean {
  return write(FIRST_KEY, value)
}

export function takeFirstCheckInHandoff(): FirstCheckInHandoff | null {
  return take<FirstCheckInHandoff>(FIRST_KEY)
}

/** The full check-in summary survives the celebration route and is shown on Home. */
export function writeCheckInAwards(value: unknown): boolean {
  return write(AWARDS_KEY, value)
}

export function takeCheckInAwards<T>(): T | null {
  return take<T>(AWARDS_KEY)
}

/**
 * Savborne — reconnecting a profile to a device, and disconnecting it
 *
 * Disconnect is local: it removes the session and the device's vault key, but
 * the profile and vault mapping stay on the server. Setup then has to recognise
 * an existing profile instead of trying to create a second vault. These helpers
 * keep that decision out of the page so it can be tested without a wallet.
 */

import type { Session } from '@/lib/session'

export type ReconnectProfile = {
  address: string
  displayName: string
  savingsAddress: string
}

/** The only place a profile becomes a session. Extra profile fields are ignored. */
export function sessionFromProfile(profile: ReconnectProfile): Session {
  return {
    playerAddress: profile.address,
    displayName: profile.displayName,
    savingsAddress: profile.savingsAddress,
  }
}

/**
 * Validate the body of a 200 before it reaches `sessionFromProfile`. A partial
 * body would otherwise be written as a session that `readSession()` rejects,
 * bouncing the player between Home and Setup with no error.
 */
export function reconnectProfile(value: unknown): ReconnectProfile | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.address !== 'string' || v.address.length === 0) return null
  if (typeof v.displayName !== 'string' || v.displayName.length === 0) return null
  if (typeof v.savingsAddress !== 'string' || v.savingsAddress.length === 0) return null
  return {
    address: v.address,
    displayName: v.displayName,
    savingsAddress: v.savingsAddress,
  }
}

export type ReconnectDecision = 'reconnect' | 'create' | 'error'

/**
 * A 200 is an existing player; a 404 means this wallet has never onboarded.
 * Every other status is a failure, never a reason to create a vault.
 */
export function reconnectDecision(status: number): ReconnectDecision {
  if (status === 200) return 'reconnect'
  if (status === 404) return 'create'
  return 'error'
}

export type DisconnectPlan = 'vault-and-session' | 'session-only'

/**
 * A device with no local vault key has nothing to clear beyond the session;
 * calling `clearVault` anyway would be harmless but misleading.
 */
export function disconnectPlan(hasLocalVault: boolean): DisconnectPlan {
  return hasLocalVault ? 'vault-and-session' : 'session-only'
}

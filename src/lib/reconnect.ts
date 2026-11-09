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

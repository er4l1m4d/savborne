/**
 * Savborne — how a player proves they can reach their vault before deleting
 *
 * Deleting an account removes the server profile but not the on-chain vault.
 * The phrase is the only key to the funds, so deletion is gated on the player
 * demonstrating they still have it:
 *
 *  - `unlock`     — a vault is encrypted on this device; decrypt it with the
 *                   passphrase, copy the words and pass the quiz.
 *  - `type-words` — the vault is registered server-side but this device has no
 *                   copy; all 24 words must be typed and the derived address
 *                   must match the registered vault.
 *  - `confirm`    — no vault exists anywhere, so there are no funds to protect.
 *
 * Pure logic, no browser APIs, so the decision is testable without a renderer.
 */

export type DeletionGate = 'unlock' | 'type-words' | 'confirm'

export function deletionGate(hasLocalVault: boolean, hasServerVault: boolean): DeletionGate {
  if (hasLocalVault) return 'unlock'
  if (hasServerVault) return 'type-words'
  return 'confirm'
}

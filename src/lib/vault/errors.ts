/**
 * Savborne — vault errors
 *
 * Shared by the browser and by route handlers. Never wrap a passphrase failure
 * in the underlying `OperationError`: the message would leak implementation
 * detail and teach a guesser nothing useful.
 */

export class VaultLockedError extends Error {
  constructor(message = 'Wrong passphrase, or the vault data is damaged.') {
    super(message)
    this.name = 'VaultLockedError'
  }
}

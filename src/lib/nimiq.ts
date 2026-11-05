/**
 * Savborne — Nimiq SDK wrapper
 *
 * Thin, typed facade over `@nimiq/mini-app-sdk`. All Nimiq interactions in the
 * app go through this file. Never call `window.nimiq` or the SDK directly
 * elsewhere; import from here.
 *
 * Design notes:
 * - `initProvider()` must be awaited before any wallet call. `window.nimiq` is
 *   injected asynchronously inside Nimiq Pay's WebView, so top-level access
 *   from a normal page script will race and fail.
 * - `getBalance` requires SDK 0.2.1+. Older Nimiq Pay builds lack it; the app
 *   must degrade gracefully (see `isGetBalanceAvailable`).
 * - `NimiqProviderError.is()` is the correct way to identify a wallet error
 *   vs a JS error. Use it in every catch block that touches the provider.
 */

import {
  init,
  NimiqProviderError,
  getHostNetwork,
  type NimiqProvider,
} from '@nimiq/mini-app-sdk'

export type Network = 'mainnet' | 'testnet'

export type WalletErrorType =
  | 'PERMISSION_DENIED'
  | 'UNKNOWN_REQUEST'
  | 'INVALID_TRANSACTION'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR'

export class WalletError extends Error {
  readonly type: WalletErrorType | 'UNKNOWN'
  readonly cause?: unknown
  constructor(type: WalletErrorType | 'UNKNOWN', message: string, cause?: unknown) {
    super(message)
    this.name = 'WalletError'
    this.type = type
    this.cause = cause
  }
}

let providerPromise: Promise<NimiqProvider> | null = null

/**
 * Return the Nimiq provider, initialising it once. Safe to call from
 * multiple places — the promise is memoised so `init()` fires only once.
 */
export async function initProvider(): Promise<NimiqProvider> {
  if (!providerPromise) {
    providerPromise = init().catch((err) => {
      // Reset on failure so the caller can retry after an init error.
      providerPromise = null
      throw normaliseError(err)
    })
  }
  return providerPromise
}

/**
 * Whether the running Nimiq Pay exposes `getBalance`. If false, the app
 * must show the "Update Nimiq Pay" prompt and refuse to run the savings loop.
 */
export async function isGetBalanceAvailable(): Promise<boolean> {
  try {
    const provider = await initProvider()
    return typeof provider.getBalance === 'function'
  } catch {
    return false
  }
}

/**
 * Ask Nimiq Pay for the user's accounts. The first call prompts the user to
 * approve account sharing; subsequent calls in the same session are silent.
 */
export async function listAccounts(): Promise<string[]> {
  const provider = await initProvider()
  try {
    const accounts = await provider.listAccounts()
    return accounts as string[]
  } catch (err) {
    throw normaliseError(err)
  }
}

/**
 * Read the balance of any address in Luna (1 NIM = 100,000 Luna).
 * Returns 0 for a genuinely-empty account. A failed lookup throws — do NOT
 * interpret a thrown error as "balance is 0".
 */
export async function getBalance(address: string): Promise<number> {
  const provider = await initProvider()
  if (typeof provider.getBalance !== 'function') {
    throw new WalletError(
      'UNKNOWN_REQUEST',
      'getBalance is not available in this Nimiq Pay version',
    )
  }
  try {
    const result = await provider.getBalance(address)
    // The SDK returns bigint or number depending on build; normalise.
    return typeof result === 'bigint' ? Number(result) : Number(result)
  } catch (err) {
    throw normaliseError(err)
  }
}

/** Check whether Nimiq consensus is established (network is ready). */
export async function isConsensusEstablished(): Promise<boolean> {
  const provider = await initProvider()
  try {
    return await provider.isConsensusEstablished()
  } catch (err) {
    throw normaliseError(err)
  }
}

/** Current block height. */
export async function getBlockNumber(): Promise<number> {
  const provider = await initProvider()
  try {
    const n = await provider.getBlockNumber()
    return typeof n === 'bigint' ? Number(n) : Number(n)
  } catch (err) {
    throw normaliseError(err)
  }
}

/**
 * Send `valueLuna` from the player's wallet to `recipient` and return the
 * transaction hash.
 *
 * The SDK documents the return as "the serialized transaction" but the value
 * observed in the WebView is the hash. `normalizeTxHash` accepts both: 64 hex
 * characters is a hash, anything longer is deserialized and hashed here.
 */
export async function sendDeposit(args: {
  recipient: string
  valueLuna: number
  feeLuna?: number
}): Promise<string> {
  const provider = await initProvider()
  if (typeof provider.sendBasicTransaction !== 'function') {
    throw new WalletError(
      'UNKNOWN_REQUEST',
      'sendBasicTransaction is not available in this Nimiq Pay version',
    )
  }
  try {
    const raw = await provider.sendBasicTransaction({
      recipient: args.recipient,
      value: args.valueLuna,
      fee: args.feeLuna ?? 0,
    })
    if (typeof raw !== 'string') {
      throw new WalletError('INVALID_TRANSACTION', 'The wallet returned no transaction')
    }
    return await normalizeTxHash(raw)
  } catch (err) {
    throw normaliseError(err)
  }
}

/**
 * Accept either a 64-character hash or a serialized transaction. The Nimiq
 * WASM is imported lazily and only on the long-hex branch, so the common path
 * pays nothing for it.
 */
async function normalizeTxHash(raw: string): Promise<string> {
  const trimmed = raw.trim()
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase()

  const { Transaction } = await import('@nimiq/core/web')
  // `fromAny` is the SDK's parser for a hex string (and other shapes);
  // `Transaction` has no `fromHex`.
  const tx = Transaction.fromAny(trimmed)
  return tx.hash()
}

/**
 * Ask the wallet to sign a message and return the raw proof.
 *
 * The wallet applies Nimiq's signed-message envelope; this function must NOT
 * hash or prefix anything itself, or the server's verification will not match.
 * The caller is responsible for what the message says (see `delete-request.ts`).
 */
export async function signMessage(
  message: string,
): Promise<{ publicKey: string; signature: string }> {
  const provider = await initProvider()
  if (typeof provider.sign !== 'function') {
    throw new WalletError(
      'UNKNOWN_REQUEST',
      'Signing is not available in this Nimiq Pay version',
    )
  }
  try {
    const result = await provider.sign(message)
    if (!result || typeof result !== 'object' || 'error' in result) {
      throw new WalletError('UNKNOWN', 'The wallet did not sign the message')
    }
    return { publicKey: result.publicKey, signature: result.signature }
  } catch (err) {
    throw normaliseError(err)
  }
}

/**
 * Disconnect the mini app from the wallet. Clears cached accounts so the
 * user is prompted again if they reconnect.
 */
export async function disconnect(): Promise<void> {
  const provider = await initProvider()
  try {
    await provider.disconnect()
    // Reset memoised promise so the next call re-inits.
    providerPromise = null
  } catch (err) {
    throw normaliseError(err)
  }
}

/** Which Nimiq network the host app is on. Falls back to 'mainnet' if unknown. */
export function hostNetwork(): Network {
  const net = getHostNetwork()
  return net === 'testnet' ? 'testnet' : 'mainnet'
}

/** The user's language as set in Nimiq Pay (ISO 639-1). Falls back to 'en'. */
export function hostLanguage(): string {
  if (typeof window === 'undefined') return 'en'
  const lang = (window as { nimiqPay?: { language?: string } }).nimiqPay?.language
  return lang || 'en'
}

/** Whether the app is currently running inside Nimiq Pay. */
export function isInsideNimiqPay(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as { nimiqPay?: unknown }).nimiqPay !== 'undefined'
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function normaliseError(err: unknown): WalletError {
  if (err instanceof WalletError) return err
  if (NimiqProviderError.is(err)) {
    const type = (err.type as WalletErrorType) || 'UNKNOWN_ERROR'
    const message = typeof err.message === 'string' ? err.message : 'Wallet error'
    return new WalletError(type, message, err)
  }
  const message = err instanceof Error ? err.message : String(err)
  return new WalletError('UNKNOWN', message, err)
}

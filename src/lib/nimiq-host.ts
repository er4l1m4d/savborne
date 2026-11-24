/**
 * Savborne — host detection without the wallet SDK
 *
 * The gate has to answer "am I inside Nimiq Pay?" before it can decide whether
 * loading the wallet is worth anything, and that question is a plain window
 * check. It lives apart from `lib/nimiq.ts` because that module imports
 * `@nimiq/mini-app-sdk` at module scope: importing it anywhere in the layout
 * tree puts the whole SDK in the chunk every visitor downloads, including the
 * ones who open the app in a browser and can never use it.
 *
 * `lib/nimiq.ts` re-exports this, so call sites keep the import they had.
 */

/** Whether the app is currently running inside Nimiq Pay. */
export function isInsideNimiqPay(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as { nimiqPay?: unknown }).nimiqPay !== 'undefined'
}

/**
 * The fiat currency the person picked in Nimiq Pay, or undefined when the host
 * does not report one. A plain property read, like `hostLanguage` in
 * `lib/nimiq.ts`, so callers do not have to load the wallet SDK for it.
 */
export function hostFiat(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const value = (window as { nimiqPay?: { userFiat?: unknown } }).nimiqPay?.userFiat
  return typeof value === 'string' ? value : undefined
}

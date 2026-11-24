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

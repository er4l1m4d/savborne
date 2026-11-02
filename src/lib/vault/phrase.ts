/**
 * Savborne — vault phrase: browser only
 *
 * The only module that touches `@nimiq/core/web`. The 1.06 MB WASM is loaded
 * lazily and memoised, and the import is type-only at the top of this file so
 * it never enters a server bundle.
 *
 * Everything above this module works in `string[]` (the word grid's shape).
 * The phrase is joined exactly once, here, when the mnemonic is needed.
 */

type NimiqWeb = typeof import('@nimiq/core/web')

let nimiqPromise: Promise<NimiqWeb> | null = null

/** Load and initialise the Nimiq web WASM once per page. */
export async function loadNimiq(): Promise<NimiqWeb> {
  if (!nimiqPromise) {
    nimiqPromise = (async () => {
      const mod = await import('@nimiq/core/web')
      // The package exposes a default initialiser in some builds and a direct
      // namespace in others; the spike proved both shapes must be accepted.
      const candidate = mod as unknown as { default?: unknown }
      if (typeof candidate.default === 'function') {
        await (candidate.default as () => Promise<void>)()
      }
      return mod
    })()
  }
  return nimiqPromise
}

export function phraseToMnemonic(phrase: string[]): string {
  return phrase.join(' ')
}

/** 24 words, in order. Entropy.generate().toMnemonic() returns an array. */
export async function generatePhrase(): Promise<string[]> {
  const mod = await loadNimiq()
  return mod.Entropy.generate().toMnemonic()
}

async function keyPairFromPhrase(phrase: string[]) {
  const mod = await loadNimiq()
  const xprv = mod.MnemonicUtils.mnemonicToExtendedPrivateKey(phraseToMnemonic(phrase))
  return { mod, keyPair: mod.KeyPair.derive(xprv.privateKey) }
}

/** The address the vault phrase controls, in user-friendly form. */
export async function deriveVaultAddress(phrase: string[]): Promise<string> {
  const { keyPair } = await keyPairFromPhrase(phrase)
  return keyPair.toAddress().toUserFriendlyAddress()
}

/** Alias used by the recovery flow; same derivation, same address. */
export async function addressFromPhrase(phrase: string[]): Promise<string> {
  return deriveVaultAddress(phrase)
}

/**
 * Build, sign and serialise a transfer. `TransactionBuilder.newBasic` needs an
 * `Address` instance — passing the user-friendly string throws at runtime even
 * where the types allow it.
 */
export async function signTransfer(args: {
  phrase: string[]
  recipient: string
  valueLuna: number
  feeLuna: number
  validityStartHeight: number
  networkId: number
}): Promise<{ hash: string; hex: string }> {
  const { mod, keyPair } = await keyPairFromPhrase(args.phrase)
  const transaction = mod.TransactionBuilder.newBasic(
    keyPair.toAddress(),
    mod.Address.fromUserFriendlyAddress(args.recipient),
    BigInt(args.valueLuna),
    BigInt(args.feeLuna),
    args.validityStartHeight,
    args.networkId,
  )
  transaction.sign(keyPair, undefined) // second arg = "no inner key"
  return { hash: transaction.hash(), hex: transaction.toHex() }
}

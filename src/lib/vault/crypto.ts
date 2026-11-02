/**
 * Savborne — vault phrase encryption at rest
 *
 * AES-GCM-256 with a PBKDF2-SHA256 key. Runs in the browser and in Node tests:
 * it uses only `globalThis.crypto.subtle`, never WASM or React.
 *
 * The phrase is `string[]` throughout. Joining happens once, in `phrase.ts`,
 * so this module cannot accidentally encrypt a comma-joined string.
 */

import { VaultLockedError } from './errors'

export const PBKDF2_ITERATIONS = 210_000

const IV_BYTES = 12
const SALT_BYTES = 16

export type EncryptedBlob = {
  ciphertext: string // base64
  iv: string // base64, 12 bytes
  salt: string // base64, 16 bytes
  iterations: number
  kdf: 'PBKDF2-SHA256'
  cipher: 'AES-GCM-256'
}

function utf8(value: string): BufferSource {
  return new TextEncoder().encode(value) as unknown as BufferSource
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    utf8(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptPhrase(
  phrase: string[],
  passphrase: string,
  opts?: { iterations?: number },
): Promise<EncryptedBlob> {
  const iterations = opts?.iterations ?? PBKDF2_ITERATIONS
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(passphrase, salt, iterations)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    utf8(JSON.stringify(phrase)),
  )

  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
    salt: toBase64(salt),
    iterations,
    kdf: 'PBKDF2-SHA256',
    cipher: 'AES-GCM-256',
  }
}

/** Returns the 24 words, in order. */
export async function decryptPhrase(blob: EncryptedBlob, passphrase: string): Promise<string[]> {
  const salt = fromBase64(blob.salt)
  const iv = fromBase64(blob.iv)
  const key = await deriveKey(passphrase, salt, blob.iterations)

  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      fromBase64(blob.ciphertext) as unknown as BufferSource,
    )
  } catch {
    // AES-GCM authentication failed: wrong passphrase or tampered data. The
    // underlying error is deliberately discarded.
    throw new VaultLockedError()
  }

  try {
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as unknown
    if (!Array.isArray(parsed) || !parsed.every((w) => typeof w === 'string')) {
      throw new Error('shape')
    }
    return parsed as string[]
  } catch {
    throw new VaultLockedError()
  }
}

#!/usr/bin/env node
/**
 * Savborne - check-in end-to-end probe
 *
 * Proves the public check-in contract against a running deployment with a
 * disposable wallet. It is deliberately dependency-free: run it on a preview
 * deployment or a test Supabase project, never production.
 *
 *   node scripts/checkin-e2e.mjs https://your-preview.vercel.app
 *   SAVBORNE_BASE_URL=http://localhost:3000 npm run checkin:e2e
 *
 * What it asserts:
 *   1. a new wallet gets a session and can create a player + vault;
 *   2. two concurrent first check-ins produce exactly one reading/reward set;
 *   3. five more same-day POSTs are idempotent and leave checkInCount at 1;
 *   4. the 11th POST inside one minute is 429 with Retry-After;
 *   5. a signed delete removes the account and the public card 404s.
 *
 * The test player is deleted in a finally block. It never prints a phrase or a
 * private key; the key exists only in memory.
 */

import * as Nimiq from '@nimiq/core'

const BASE = (process.argv[2] ?? process.env.SAVBORNE_BASE_URL ?? '').replace(/\/$/, '')

if (!BASE) {
  console.error('Usage: node scripts/checkin-e2e.mjs https://preview.example')
  process.exit(2)
}
if (/(^|\.)savborne\.vercel\.app$/i.test(new URL(BASE).hostname)) {
  console.error('Refusing to run against production (savborne.vercel.app). Use a preview or local URL.')
  process.exit(2)
}

const encoder = new TextEncoder()
let failures = 0
let cleanup = null

function step(ok, label, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  - ${detail}` : ''}`)
}

function normalise(address) {
  return address.replace(/[\s+]/g, '').toUpperCase()
}

/** Nimiq's signed-message envelope, byte-for-byte. */
function signedPayload(message) {
  const body = encoder.encode(message)
  const prefix = encoder.encode(`\x16Nimiq Signed Message:\n${body.length}`)
  const out = new Uint8Array(prefix.length + body.length)
  out.set(prefix, 0)
  out.set(body, prefix.length)
  return out
}

async function loadNimiq() {
  const mod = Nimiq.default ?? Nimiq
  if (typeof mod === 'function') await mod()
  return typeof Nimiq.Entropy === 'function' ? Nimiq : mod
}

function makeWallet(N) {
  const privateKey = N.PrivateKey.generate()
  const publicKey = N.PublicKey.derive(privateKey)
  const address = publicKey.toAddress().toUserFriendlyAddress()

  function sign(message, signedAt = Date.now()) {
    const hash = N.Hash.computeSha256(signedPayload(message))
    const signature = N.Signature.create(privateKey, publicKey, hash)
    return {
      publicKey: publicKey.toHex(),
      signature: signature.toHex(),
      signedAt,
    }
  }

  return { address, sign }
}

function sessionMessage(address, signedAt) {
  return [
    'Savborne session',
    `Address: ${normalise(address)}`,
    'Action: session',
    `Signed at: ${signedAt}`,
    'This signature starts a 12-hour Savborne session for this wallet.',
  ].join('\n')
}

function checkInMessage(address, signedAt) {
  return [
    'Savborne check-in',
    `Address: ${normalise(address)}`,
    'Action: check-in',
    `Signed at: ${signedAt}`,
    "This signature proves I control this player's wallet.",
  ].join('\n')
}

function deleteMessage(address, createdAt, signedAt) {
  return [
    'Savborne account deletion',
    `Address: ${normalise(address)}`,
    `Created: ${createdAt}`,
    `Signed at: ${signedAt}`,
    'This signature proves I can reach the 24 words that control this vault.',
  ].join('\n')
}

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: res.status, json, headers: res.headers }
}

async function main() {
  const N = await loadNimiq()
  const wallet = makeWallet(N)
  const vaultWallet = makeWallet(N)
  const displayName = `E2E ${Date.now().toString(36).slice(-6)}`
  console.log(`base: ${BASE}`)
  console.log(`test wallet: ${wallet.address}`)
  console.log(`test vault:  ${vaultWallet.address}\n`)

  // 1. Session + player + vault -------------------------------------------------
  const signedAt = Date.now()
  const sessionProof = wallet.sign(sessionMessage(wallet.address, signedAt), signedAt)
  const session = await call('/api/session', {
    method: 'POST',
    body: { address: wallet.address, ...sessionProof },
  })
  step(
    session.status === 200 && typeof session.json?.token === 'string',
    'a new wallet can obtain a session',
    `HTTP ${session.status}`,
  )
  if (session.status !== 200) throw new Error('no session; stopping')

  const auth = {
    'X-Player-Address': wallet.address,
    'X-Savborne-Session': session.json.token,
  }

  const created = await call('/api/players', {
    method: 'POST',
    headers: auth,
    body: {
      address: wallet.address,
      displayName,
      vaultAddress: vaultWallet.address,
      network: 'testnet',
      backupVerified: true,
      avatar: 'hero',
      privacyNoticeVersion: 'e2e',
    },
  })
  step(
    created.status === 201 || created.status === 200,
    'player and vault created through the API',
    `HTTP ${created.status} ${created.json?.error ?? ''}`,
  )
  const cardToken = created.json?.vault?.cardToken
  if (created.status >= 300) throw new Error('could not create the test player')

  cleanup = async () => {
    const current = await call('/api/players/me', { headers: auth })
    const createdAt = current.json?.player?.createdAt
    if (!createdAt) return
    const at = Date.now()
    const proof = wallet.sign(deleteMessage(wallet.address, createdAt, at), at)
    await call('/api/players/me', {
      method: 'DELETE',
      headers: {
        ...auth,
        'X-Savborne-Delete-Public-Key': proof.publicKey,
        'X-Savborne-Delete-Signature': proof.signature,
        'X-Savborne-Delete-Signed-At': String(at),
      },
    })
  }

  try {
  const checkIn = async () => {
    const at = Date.now()
    const proof = wallet.sign(checkInMessage(wallet.address, at), at)
    return call('/api/check-ins', {
      method: 'POST',
      headers: {
        ...auth,
        'X-Savborne-Check-In-Public-Key': proof.publicKey,
        'X-Savborne-Check-In-Signature': proof.signature,
        'X-Savborne-Check-In-Signed-At': String(at),
      },
      body: {},
    })
  }

  // 2. Concurrent first check-ins ----------------------------------------------
  const [first, second] = await Promise.all([checkIn(), checkIn()])
  const winners = [first, second].filter(
    (r) => r.status === 200 && r.json?.alreadyCheckedIn === false,
  )
  step(winners.length === 1, 'two concurrent first check-ins award exactly once',
    `awards=${winners.length}, statuses=${first.status}/${second.status}`)

  const receipts = await call('/api/receipts', { headers: auth })
  const today = new Date().toISOString().slice(0, 10)
  const readingsToday = (receipts.json?.items ?? []).filter(
    (item) => item.kind === 'snapshot' && String(item.at).slice(0, 10) === today,
  ).length
  step(readingsToday === 1, 'exactly one reading exists for today', `readings=${readingsToday}`)

  // 3. Five same-day POSTs are idempotent --------------------------------------
  for (let i = 0; i < 5; i++) {
    const res = await checkIn()
    step(res.status === 200 && res.json?.alreadyCheckedIn === true,
      `same-day POST ${i + 1} is idempotent`, `HTTP ${res.status}`)
  }

  const me = await call('/api/players/me', { headers: auth })
  step(me.json?.player?.checkInCount === 1, 'five POSTs leave checkInCount at 1',
    `count=${me.json?.player?.checkInCount}`)

  // 4. Rate limit: the 11th POST inside the window is 429 ----------------------
  // We have made 7 check-in POSTs so far (2 concurrent + 5). Three more are
  // allowed; the next one must be denied.
  const allowed = []
  for (let i = 0; i < 3; i++) {
    allowed.push(await checkIn())
  }
  step(allowed.every((r) => r.status === 200), 'the 10th POST in the window is allowed',
    allowed.map((r) => r.status).join(','))

  const denied = await checkIn()
  step(denied.status === 429, 'the 11th POST in one minute is 429',
    `HTTP ${denied.status}, retry-after=${denied.headers.get('retry-after')}`)
  step(Number(denied.headers.get('retry-after')) > 0,
    'the 429 carries Retry-After', denied.headers.get('retry-after') ?? 'missing')

  // 5. Signed delete, then the public card 404s --------------------------------
  const createdAt = me.json?.player?.createdAt
  const deleteAt = Date.now()
  const deleteProof = wallet.sign(deleteMessage(wallet.address, createdAt, deleteAt), deleteAt)
  const deleted = await call('/api/players/me', {
    method: 'DELETE',
    headers: {
      ...auth,
      'X-Savborne-Delete-Public-Key': deleteProof.publicKey,
      'X-Savborne-Delete-Signature': deleteProof.signature,
      'X-Savborne-Delete-Signed-At': String(deleteAt),
    },
  })
  step(deleted.status === 200 && deleted.json?.deleted === true,
    'a signed delete removes the account', `HTTP ${deleted.status}`)

  if (cardToken) {
    const card = await call(`/card/${cardToken}`)
    step(card.status === 404, 'the public card 404s after deletion', `HTTP ${card.status}`)
  }
  cleanup = null
  } finally {
    if (cleanup) {
      try {
        await cleanup()
        console.log('cleanup: test player deleted')
      } catch (err) {
        console.log(`cleanup failed: ${err?.message ?? err}`)
      }
    }
  }

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`)
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch(async (err) => {
  console.error('FAIL  unexpected error:', err?.message ?? err)
  process.exitCode = 1
})

#!/usr/bin/env node
/**
 * Savborne — testnet end-to-end probe
 *
 * Proves the whole money path outside the app: generate a phrase, derive an
 * address, fund it from the PoS testnet faucet, sign a transfer, broadcast it,
 * and wait for the node to include it in a block with a successful execution.
 *
 * It never touches the repo or the database. The four RPC calls are duplicated
 * on purpose: this file must run with no build step and no TypeScript loader.
 *
 *   npm run vault:e2e
 */

import * as Nimiq from '@nimiq/core'

const RPC_URL = 'https://rpc.testnet.nimiqwatch.com'
const NETWORK_ID = 5
const FAUCET_URL = 'https://faucet.pos.nimiq-testnet.com/tapit'
const EXPLORER = 'https://test.nimiq.watch'

let failures = 0

function step(ok, label, detail = '') {
  if (!ok) failures++
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`${mark}  ${label}${detail ? `  — ${detail}` : ''}`)
}

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

async function getBalance(address) {
  const body = await rpc('getAccountByAddress', [address])
  if (body.error) throw new Error(body.error.data ?? body.error.message)
  return Number(body.result.data.balance)
}

async function getHeadHeight() {
  const body = await rpc('getBlockNumber', [])
  return Number(body.result.data)
}

async function getChainTransaction(hash) {
  const body = await rpc('getTransactionByHash', [hash])
  if (body.error) {
    const detail = typeof body.error.data === 'string' ? body.error.data : ''
    if (detail.startsWith('Transaction not found')) return null
    throw new Error(body.error.data ?? body.error.message)
  }
  return body.result.data
}

async function broadcast(hex) {
  const body = await rpc('sendRawTransaction', [hex])
  if (body.error) throw new Error(body.error.data ?? body.error.message)
  return String(body.result.data)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const mod = Nimiq.default ?? Nimiq
  if (typeof mod === 'function') await mod()
  const N = typeof mod.Entropy === 'function' ? mod : Nimiq

  const phrase = N.Entropy.generate().toMnemonic().join(' ')
  const xprv = N.MnemonicUtils.mnemonicToExtendedPrivateKey(phrase)
  const keyPair = N.KeyPair.derive(xprv.privateKey)
  const sender = keyPair.toAddress().toUserFriendlyAddress()
  step(true, 'generated a 24-word phrase', sender)

  const recipient = N.KeyPair.derive(N.MnemonicUtils.mnemonicToExtendedPrivateKey(
    N.Entropy.generate().toMnemonic().join(' '),
  ).privateKey).toAddress().toUserFriendlyAddress()

  // Fund the fresh address.
  const funding = await fetch(FAUCET_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ address: sender, amount: '100' }).toString(),
  })
  step(funding.ok, 'requested faucet funds', `HTTP ${funding.status}`)

  let balance = 0
  for (let i = 0; i < 40 && balance === 0; i++) {
    await sleep(1500)
    balance = await getBalance(sender)
  }
  step(balance > 0, 'balance arrived on testnet', `${balance} luna`)

  const head = await getHeadHeight()
  const value = 100_000n // 1 NIM
  const tx = N.TransactionBuilder.newBasic(
    keyPair.toAddress(),
    N.Address.fromUserFriendlyAddress(recipient),
    value,
    0n,
    head,
    NETWORK_ID,
  )
  tx.sign(keyPair, undefined)
  const expectedHash = tx.hash()
  step(true, 'signed a 1 NIM transfer', expectedHash)

  const returnedHash = await broadcast(tx.toHex())
  step(returnedHash === expectedHash, 'node accepted the raw transaction', returnedHash)

  let mined = null
  for (let i = 0; i < 60 && !mined; i++) {
    await sleep(2000)
    mined = await getChainTransaction(expectedHash)
  }
  step(!!mined && typeof mined.blockNumber === 'number', 'transaction included in a block',
    mined ? `block ${mined.blockNumber}` : 'not found')
  step(!!mined && mined.executionResult === true, 'execution succeeded',
    mined ? `executionResult=${mined.executionResult}` : 'unknown')
  if (mined) {
    step(mined.to.toUpperCase().replace(/\s/g, '') === recipient.replace(/\s/g, '').toUpperCase(),
      'recipient matches', mined.to)
  }

  console.log(`\nexplorer: ${EXPLORER}/#${expectedHash}`)
  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('FAIL  unexpected error:', err && err.message ? err.message : err)
  process.exit(1)
})

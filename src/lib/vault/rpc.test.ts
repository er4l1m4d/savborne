/**
 * Task 4 — JSON-RPC client.
 *
 * The node is the only source of truth for balances and inclusion. These
 * tests pin the wire format: the method names, the `result.data` envelope,
 * the not-found mapping, and the fact that `getBalance` is never called.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  RpcError,
  broadcastTransaction,
  getAccount,
  getChainTransaction,
  getHeadHeight,
} from './rpc'

const HASH = 'ab'.repeat(32)
const VAULT = 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL'

const RAW_TX = {
  hash: HASH,
  blockNumber: 15_709_650,
  timestamp: 1_793_625_319_242,
  confirmations: 10,
  from: 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000',
  to: VAULT,
  value: 25_826_450,
  fee: 0,
  networkId: 5,
  executionResult: true,
}

type Call = { url: string; body: { jsonrpc: string; id: number; method: string; params: unknown[] } }

function payloadFor(body: Call['body']): unknown {
  switch (body.method) {
    case 'getAccountByAddress':
      return { result: { data: { address: body.params[0], balance: 571_671_293_639, type: 'basic' } } }
    case 'getBlockNumber':
      return { result: { data: 15_709_651 } }
    case 'getTransactionByHash':
      return { result: { data: RAW_TX } }
    case 'sendRawTransaction':
      return { result: { data: HASH } }
    default:
      return { error: { code: -32601, message: 'Method not allowed', data: 'Method not allowed' } }
  }
}

function routedFetch() {
  const calls: Call[] = []
  const fetchImpl = async (url: string, init: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init.body)) as Call['body']
    calls.push({ url, body })
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, ...(payloadFor(body) as object) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { calls, fetchImpl }
}

test('getAccount uses getAccountByAddress and reads result.data.balance', async () => {
  const { calls, fetchImpl } = routedFetch()
  const account = await getAccount(VAULT, 'testnet', { fetchImpl })

  assert.deepEqual(account, {
    address: VAULT,
    balanceLuna: 571_671_293_639,
    type: 'basic',
  })
  assert.equal(calls[0].url, 'https://rpc.testnet.nimiqwatch.com')
  assert.deepEqual(calls[0].body, {
    jsonrpc: '2.0',
    id: 1,
    method: 'getAccountByAddress',
    params: [VAULT],
  })
})

test('getHeadHeight uses getBlockNumber and returns result.data', async () => {
  const { fetchImpl } = routedFetch()
  assert.equal(await getHeadHeight('testnet', { fetchImpl }), 15_709_651)
})

test('getChainTransaction maps the live node row', async () => {
  const { calls, fetchImpl } = routedFetch()
  const tx = await getChainTransaction(HASH, 'testnet', { fetchImpl })

  assert.deepEqual(tx, {
    hash: HASH,
    blockNumber: 15_709_650,
    from: RAW_TX.from,
    to: VAULT,
    valueLuna: 25_826_450,
    feeLuna: 0,
    networkId: 5,
    executionResult: true,
    confirmations: 10,
  })
  assert.deepEqual(calls[0].body.params, [HASH])
})

test('getChainTransaction returns null when the node says not found', async () => {
  const fetchImpl = async (): Promise<Response> =>
    new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32603, message: 'Internal error', data: `Transaction not found: ${HASH}` },
      }),
      { status: 200 },
    )

  assert.equal(await getChainTransaction(HASH, 'testnet', { fetchImpl }), null)
})

test('getChainTransaction returns null for a known tx with no block yet', async () => {
  const fetchImpl = async (): Promise<Response> =>
    new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { data: { ...RAW_TX, blockNumber: null } },
      }),
      { status: 200 },
    )

  assert.equal(await getChainTransaction(HASH, 'testnet', { fetchImpl }), null)
})

test('getChainTransaction surfaces other RPC errors', async () => {
  const fetchImpl = async (): Promise<Response> =>
    new Response(
      JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -1, message: 'boom', data: 'boom' } }),
      { status: 200 },
    )

  await assert.rejects(
    () => getChainTransaction(HASH, 'testnet', { fetchImpl }),
    (err: unknown) => err instanceof RpcError && err.kind === 'rpc_error',
  )
})

test('a transport failure becomes RpcError unreachable', async () => {
  const fetchImpl = async (): Promise<Response> => {
    throw new Error('offline')
  }

  await assert.rejects(
    () => getAccount(VAULT, 'testnet', { fetchImpl }),
    (err: unknown) => err instanceof RpcError && err.kind === 'unreachable',
  )
})

test('a non-2xx response becomes RpcError rpc_error', async () => {
  const fetchImpl = async (): Promise<Response> => new Response('nope', { status: 502 })

  await assert.rejects(
    () => getHeadHeight('mainnet', { fetchImpl }),
    (err: unknown) => err instanceof RpcError && err.kind === 'rpc_error',
  )
})

test('broadcastTransaction uses sendRawTransaction and returns the hash', async () => {
  const { calls, fetchImpl } = routedFetch()
  const hash = await broadcastTransaction('00ff', 'testnet', { fetchImpl })

  assert.equal(hash, HASH)
  assert.equal(calls[0].body.method, 'sendRawTransaction')
  assert.deepEqual(calls[0].body.params, ['00ff'])
})

test('the client never calls getBalance', async () => {
  const { calls, fetchImpl } = routedFetch()
  await getAccount(VAULT, 'testnet', { fetchImpl })
  await getHeadHeight('testnet', { fetchImpl })
  await getChainTransaction(HASH, 'testnet', { fetchImpl })
  await broadcastTransaction('00ff', 'testnet', { fetchImpl })

  const methods = calls.map((c) => c.body.method)
  assert.deepEqual(methods, [
    'getAccountByAddress',
    'getBlockNumber',
    'getTransactionByHash',
    'sendRawTransaction',
  ])
  assert.ok(!methods.includes('getBalance'))
})

test('NIMIQ_RPC_URLS falls back in order and returns the first good answer', async () => {
  const previous = process.env.NIMIQ_RPC_URLS
  process.env.NIMIQ_RPC_URLS = 'https://rpc-one.invalid,https://rpc-two.invalid'
  const seen: string[] = []
  const fetchImpl = async (url: string): Promise<Response> => {
    seen.push(url)
    if (url.includes('rpc-one')) throw new Error('ECONNREFUSED')
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: { data: { address: VAULT, balance: 42_000_000, type: 'basic' } },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  try {
    const account = await getAccount(VAULT, 'testnet', { fetchImpl })
    assert.equal(account.balanceLuna, 42_000_000)
    assert.deepEqual(seen, ['https://rpc-one.invalid', 'https://rpc-two.invalid'])
  } finally {
    if (previous === undefined) delete process.env.NIMIQ_RPC_URLS
    else process.env.NIMIQ_RPC_URLS = previous
  }
})

test('every endpoint failing is an RpcError, never a zero balance', async () => {
  const previous = process.env.NIMIQ_RPC_URLS
  process.env.NIMIQ_RPC_URLS = 'https://rpc-one.invalid,https://rpc-two.invalid'
  const fetchImpl = async (): Promise<Response> => {
    throw new Error('ECONNREFUSED')
  }

  try {
    await assert.rejects(
      () => getAccount(VAULT, 'testnet', { fetchImpl }),
      (err: unknown) => err instanceof RpcError && err.kind === 'unreachable',
    )
  } finally {
    if (previous === undefined) delete process.env.NIMIQ_RPC_URLS
    else process.env.NIMIQ_RPC_URLS = previous
  }
})

test('a hung endpoint is aborted by the per-call timeout and moves on', async () => {
  const previous = process.env.NIMIQ_RPC_URLS
  process.env.NIMIQ_RPC_URLS = 'https://slow.invalid'
  let aborted = false
  const fetchImpl = (_url: string, init: RequestInit): Promise<Response> =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        aborted = true
        reject(new DOMException('aborted', 'AbortError'))
      })
    })

  try {
    await assert.rejects(
      () => getAccount(VAULT, 'testnet', { fetchImpl, timeoutMs: 20 }),
      (err: unknown) => err instanceof RpcError && err.kind === 'unreachable',
    )
    assert.equal(aborted, true)
  } finally {
    if (previous === undefined) delete process.env.NIMIQ_RPC_URLS
    else process.env.NIMIQ_RPC_URLS = previous
  }
})

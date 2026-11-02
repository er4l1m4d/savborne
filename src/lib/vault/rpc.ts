/**
 * Savborne — minimal JSON-RPC client for the Nimiq node
 *
 * Runtime-agnostic: no React, no WASM, safe in route handlers and Node tests.
 *
 * Wire facts this file encodes (verified against the live node, spec §17):
 *   • the balance method is `getAccountByAddress`; `getBalance` returns
 *     "Method not allowed" on these nodes and must never be used
 *   • success is `result.data`
 *   • a missing transaction is an error with `data` starting
 *     `"Transaction not found"`, delivered with HTTP 200
 *   • `value` and `fee` arrive as JSON numbers in Luna. Total supply is
 *     2.1e12 Luna, far below Number.MAX_SAFE_INTEGER (9e15), so JSON numbers
 *     are safe here even though the domain value is integral.
 */

import type { Network } from '@/lib/nimiq'
import { VAULT_RPC_URL } from './network'

export type RpcOptions = {
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>
  timeoutMs?: number
}

export class RpcError extends Error {
  constructor(
    readonly kind: 'unreachable' | 'rpc_error',
    message: string,
  ) {
    super(message)
    this.name = 'RpcError'
  }
}

export type ChainAccount = {
  address: string
  balanceLuna: number
  /** The string `"basic"` on these nodes — not a numeric account type. */
  type: string
}

export type ChainTransaction = {
  hash: string
  blockNumber: number
  from: string
  to: string
  valueLuna: number
  feeLuna: number
  networkId: number
  executionResult: boolean
  confirmations: number
}

type RpcEnvelope = {
  result?: { data?: unknown } | null
  error?: { code?: number; message?: string; data?: unknown } | null
}

type RawTransaction = {
  hash?: unknown
  blockNumber?: unknown
  from?: unknown
  to?: unknown
  value?: unknown
  fee?: unknown
  networkId?: unknown
  executionResult?: unknown
  confirmations?: unknown
}

const DEFAULT_TIMEOUT_MS = 8_000

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** JSON numbers -> integer Luna. Non-finite input becomes 0, never NaN. */
function toNumber(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

function errorMessage(method: string, error: NonNullable<RpcEnvelope['error']>): string {
  return `RPC ${method} failed: ${error.message ?? 'unknown error'}`
}

/** Single call site: envelope, transport, HTTP and JSON all handled here. */
async function rpcCall(
  network: Network,
  method: string,
  params: unknown[],
  opts?: RpcOptions,
): Promise<RpcEnvelope> {
  const fetchImpl = opts?.fetchImpl ?? fetch

  let response: Response
  try {
    response = await fetchImpl(VAULT_RPC_URL[network], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
  } catch (err) {
    throw new RpcError('unreachable', `RPC ${method} unreachable: ${describe(err)}`)
  }

  if (!response.ok) {
    throw new RpcError('rpc_error', `RPC ${method} returned HTTP ${response.status}`)
  }

  try {
    return (await response.json()) as RpcEnvelope
  } catch (err) {
    throw new RpcError('rpc_error', `RPC ${method} returned invalid JSON: ${describe(err)}`)
  }
}

function unwrap<T>(method: string, envelope: RpcEnvelope): T {
  if (envelope.error) throw new RpcError('rpc_error', errorMessage(method, envelope.error))
  const data = envelope.result?.data
  if (data === undefined || data === null) {
    throw new RpcError('rpc_error', `RPC ${method} returned no data`)
  }
  return data as T
}

export async function getAccount(
  address: string,
  network: Network,
  opts?: RpcOptions,
): Promise<ChainAccount> {
  const method = 'getAccountByAddress'
  const envelope = await rpcCall(network, method, [address], opts)
  const data = unwrap<{ address?: unknown; balance?: unknown; type?: unknown }>(method, envelope)

  return {
    address: String(data.address ?? address),
    balanceLuna: toNumber(data.balance),
    type: String(data.type ?? ''),
  }
}

export async function getHeadHeight(network: Network, opts?: RpcOptions): Promise<number> {
  const method = 'getBlockNumber'
  const envelope = await rpcCall(network, method, [], opts)
  const height = toNumber(unwrap<unknown>(method, envelope))

  if (height <= 0) {
    throw new RpcError('rpc_error', `RPC ${method} returned no height`)
  }
  return height
}

/**
 * `null` means "not known yet": either the node has no such transaction, or it
 * knows it but has not included it in a block. Both are pending, never settled.
 */
export async function getChainTransaction(
  hash: string,
  network: Network,
  opts?: RpcOptions,
): Promise<ChainTransaction | null> {
  const method = 'getTransactionByHash'
  const envelope = await rpcCall(network, method, [hash], opts)

  if (envelope.error) {
    const detail = typeof envelope.error.data === 'string' ? envelope.error.data : ''
    if (detail.startsWith('Transaction not found')) return null
    throw new RpcError('rpc_error', errorMessage(method, envelope.error))
  }

  const raw = envelope.result?.data as RawTransaction | null | undefined
  if (!raw || typeof raw.blockNumber !== 'number') return null

  return {
    hash: String(raw.hash ?? hash),
    blockNumber: toNumber(raw.blockNumber),
    from: String(raw.from ?? ''),
    to: String(raw.to ?? ''),
    valueLuna: toNumber(raw.value),
    feeLuna: toNumber(raw.fee),
    networkId: toNumber(raw.networkId),
    executionResult: raw.executionResult === true,
    confirmations: toNumber(raw.confirmations),
  }
}

/** Returns the hash the node accepted. */
export async function broadcastTransaction(
  hex: string,
  network: Network,
  opts?: RpcOptions,
): Promise<string> {
  const method = 'sendRawTransaction'
  const envelope = await rpcCall(network, method, [hex], opts)
  const data = unwrap<unknown>(method, envelope)

  if (typeof data !== 'string' || data.length === 0) {
    throw new RpcError('rpc_error', `RPC ${method} returned no transaction hash`)
  }
  return data
}

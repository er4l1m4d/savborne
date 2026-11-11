/**
 * Error reporting - the public body is a code, the log line is diagnosable,
 * and neither carries anything the database said.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  reportEvent,
  requestIdFor,
  routeError,
  safeErrorDetails,
} from '@/lib/report'

const realError = console.error
afterEach(() => {
  console.error = realError
})

function capture(): string[] {
  const lines: string[] = []
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  }
  return lines
}

test('routeError returns only the stable code and a request id header', async () => {
  const lines = capture()
  const req = new Request('http://test/api/vaults', {
    headers: { 'x-request-id': 'req-abc-123' },
  })

  const res = routeError({
    req,
    route: '/api/vaults',
    code: 'db_error',
    status: 500,
    error: Object.assign(new Error('relation "vaults" column player_address does not exist'), {
      code: '42P01',
      name: 'PostgrestError',
    }),
  })

  assert.equal(res.status, 500)
  assert.equal(res.headers.get('x-request-id'), 'req-abc-123')
  assert.deepEqual(await res.json(), { error: 'db_error' })

  assert.equal(lines.length, 1)
  const logged = JSON.parse(lines[0])
  assert.deepEqual(logged, {
    level: 'error',
    event: 'api_error',
    route: '/api/vaults',
    code: 'db_error',
    status: 500,
    requestId: 'req-abc-123',
    errorCode: '42P01',
    errorName: 'PostgrestError',
  })
  assert.doesNotMatch(lines[0], /relation|player_address|does not exist|column|table/i)
})

test('a thrown value that is not an Error still reports safely', () => {
  const lines = capture()
  reportEvent({
    route: '/api/cron/read-vaults',
    code: 'cron_failed',
    status: 500,
    requestId: 'req-1',
    ...safeErrorDetails('postgres://user:password@host/db'),
  })
  const logged = JSON.parse(lines[0])
  assert.equal(logged.code, 'cron_failed')
  assert.equal(logged.errorCode, undefined)
  assert.equal(logged.errorName, undefined)
  assert.doesNotMatch(lines[0], /password|postgres:\/\//)
})

test('requestIdFor rejects a header that is not a simple token', () => {
  const req = new Request('http://test/api/x', {
    headers: { 'x-vercel-id': 'bad id with spaces' },
  })
  const id = requestIdFor(req)
  assert.match(id, /^[0-9a-f-]{36}$/)
})

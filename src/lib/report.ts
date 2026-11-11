/**
 * Savborne - structured error reporting for API routes.
 *
 * The public error body is always a stable code (`db_error`, `rpc_unreachable`,
 * ...). The diagnostic record goes to the server log as one JSON line with the
 * route, the code, the HTTP status and a request id, so a Vercel log search can
 * find the matching request.
 *
 * Never logged: database messages, SQL, table or column names, player
 * addresses, headers, keys. A PostgREST message can quote both schema and row
 * values, so the raw message is deliberately dropped; the Postgres error code
 * and error class name are enough to triage.
 *
 * If a DSN-backed reporter (Sentry) is approved later, forward the same object
 * from `reportEvent` instead of changing every route.
 */

export type ReportEvent = {
  /** Route template, e.g. `/api/vaults`. Never the raw URL with a query. */
  route: string
  /** Stable public error code, e.g. `db_error`. */
  code: string
  /** HTTP status sent to the client. */
  status: number
  /** Correlation id for this request. */
  requestId: string
  /** Postgres/PostgREST error code when present, e.g. `23505`. */
  errorCode?: string
  /** Error class name when present, e.g. `PostgrestError`. */
  errorName?: string
}

/** Read a host-provided request id, or mint one. Never derived from player data. */
export function requestIdFor(req?: Request): string {
  const fromHost =
    req?.headers.get('x-vercel-id') ?? req?.headers.get('x-request-id')
  if (fromHost && /^[A-Za-z0-9_\-.:]{1,128}$/.test(fromHost)) return fromHost
  return crypto.randomUUID()
}

/**
 * Emit one structured line. Kept separate from `routeError` so non-HTTP
 * failures (a cron page, a background settle) can report the same shape.
 */
export function reportEvent(event: ReportEvent): void {
  const line: Record<string, unknown> = {
    level: 'error',
    event: 'api_error',
    route: event.route,
    code: event.code,
    status: event.status,
    requestId: event.requestId,
  }
  if (event.errorCode) line.errorCode = event.errorCode
  if (event.errorName) line.errorName = event.errorName
  console.error(JSON.stringify(line))
}

/**
 * Turn an unknown thrown value into the only safe diagnostic fields:
 * a Postgres/PostgREST code and a constructor name. No message, ever.
 */
export function safeErrorDetails(error: unknown): {
  errorCode?: string
  errorName?: string
} {
  if (!error || typeof error !== 'object') return {}
  const record = error as { code?: unknown; name?: unknown; constructor?: { name?: unknown } }
  const details: { errorCode?: string; errorName?: string } = {}
  if (typeof record.code === 'string' && /^[A-Za-z0-9]{1,32}$/.test(record.code)) {
    details.errorCode = record.code
  } else if (typeof record.code === 'number') {
    details.errorCode = String(record.code)
  }
  if (typeof record.name === 'string' && record.name.length <= 64) {
    details.errorName = record.name
  } else if (typeof record.constructor?.name === 'string') {
    details.errorName = record.constructor.name
  }
  return details
}

export type RouteErrorArgs = {
  req: Request
  route: string
  code: string
  status: number
  error?: unknown
}

/**
 * Report, then build the public response. The body contains only the stable
 * code; the request id travels in a header so a user can quote it in a report
 * without exposing anything about the database.
 */
export function routeError(args: RouteErrorArgs): Response {
  const requestId = requestIdFor(args.req)
  reportEvent({
    route: args.route,
    code: args.code,
    status: args.status,
    requestId,
    ...safeErrorDetails(args.error),
  })
  return Response.json(
    { error: args.code },
    { status: args.status, headers: { 'x-request-id': requestId } },
  )
}

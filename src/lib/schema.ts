/**
 * Savborne - the schema version this build expects.
 *
 * Keep this in lockstep with the `schema_meta` marker in FINAL-SCHEMA.sql.
 * `schema-version.test.ts` fails if the two drift, and GET /api/health reports
 * a mismatch as a 503 so a stale database is visible before a player hits a
 * check-in 500.
 */

export const EXPECTED_SCHEMA_VERSION = '2026-11-11.4'

/** The shape `schema_health()` returns from Postgres. */
export type SchemaHealthRow = {
  version: string | null
  commitCheckIn: boolean
  consumeRateLimit: boolean
  recordReading: boolean
  settleBattle: boolean
  sessionIsActive: boolean
}

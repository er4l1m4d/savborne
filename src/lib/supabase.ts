/**
 * Savborne — Supabase client
 *
 * Two flavours of client:
 *   - `supabaseAnon`: browser-only, respects Row-Level Security.
 *   - `supabaseAdmin()`: server-only factory, bypasses RLS via the service-role
 *     key. Use ONLY inside API routes and Server Actions for privileged writes.
 *
 * Both are LAZY: module load does not require env vars. The error is thrown
 * only when the client is actually used. This means `next build` succeeds
 * even before you've created the Supabase project, and the app shows a clear
 * runtime error rather than a build-time crash.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let anonClient: SupabaseClient | null = null
let adminClient: SupabaseClient | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.local.example to .env.local and fill in your ` +
        `Supabase project values, then restart the dev server.`,
    )
  }
  return value
}

/** Browser/anon client — RLS applies. Lazily created on first access. */
export function supabaseAnon(): SupabaseClient {
  if (!anonClient) {
    anonClient = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      { auth: { persistSession: false } }, // identity is the Nimiq address, not Supabase Auth
    )
  }
  return anonClient
}

/**
 * Server-only admin client — bypasses RLS. Lazily created.
 * Throws if called on the client side or without the service-role key.
 */
export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin() must never be called from the browser.')
  }
  if (!adminClient) {
    adminClient = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    )
  }
  return adminClient
}

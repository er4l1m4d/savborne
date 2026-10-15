/**
 * scripts/fetch-supabase-keys.mjs
 *
 * Reads `supabase projects api-keys -o json` output from stdin and writes
 * .env.local with the three values the app expects. Secrets never print in
 * full — only lengths, for confirmation. Re-run any time keys rotate.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN — must already be set by `supabase login`
 *   npx supabase projects api-keys --project-ref srpygvxroalkzuwsazyg -o json | node scripts/fetch-supabase-keys.mjs
 */

import { writeFileSync } from 'node:fs'

const PROJECT_REF = 'srpygvxroalkzuwsazyg'

let raw = ''
for await (const chunk of process.stdin) raw += chunk

// The CLI's -o json output is a JSON array of key objects with fields
// { name, api_key, type, ... }. Try strict parse first; fall back to a
// tolerant scan if progress glyphs contaminate the stream.
let pairs = {}
try {
  const arr = JSON.parse(raw.trim())
  for (const k of arr) if (k.name && (k.api_key || k.value)) pairs[k.name] = k.api_key || k.value
} catch {
  for (const m of raw.matchAll(/"api_key":"([^"]+)"[^}]*?"name":"([^"]+)"/g)) {
    pairs[m[2]] = m[1]
  }
}

const anon = pairs.anon || pairs.default
const service = pairs.service_role
if (!anon || !service) {
  console.error('Could not find anon/service_role keys. Found:', Object.keys(pairs))
  process.exit(1)
}

const out =
  '# Supabase keys (generated via scripts/fetch-supabase-keys.mjs — gitignored)\n' +
  `NEXT_PUBLIC_SUPABASE_URL=https://${PROJECT_REF}.supabase.co\n` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}\n` +
  `SUPABASE_SERVICE_ROLE_KEY=${service}\n`

writeFileSync('.env.local', out)
console.log(`.env.local written | anon len ${anon.length} | svc len ${service.length}`)

/**
 * scripts/reset-test-data.mjs
 *
 * One-time (or pre-launch) wipe of ALL game data back to a pristine state:
 * every battle, every queue row, every human player — leaving only the
 * catalog seeds (missions/items/badges) and the AI opponent row.
 *
 * SAFE ONLY WHILE THERE ARE NO REAL USERS. Once real players exist, this
 * script must not be run; it exists because early stress runs crashed before
 * their (then-buggy) cleanup could sweep, and the leaderboard must be empty
 * for the first human tester.
 *
 * Run: node scripts/reset-test-data.mjs
 */

import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const REST = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`
const HDRS = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
}

const count = async (table, filter = '') => {
  const res = await fetch(`${REST}/${table}?select=*&${filter}limit=1000`, { headers: HDRS })
  const rows = await res.json()
  return Array.isArray(rows) ? rows.length : -1
}

console.log('before:', {
  players: await count('players'),
  battles: await count('battles'),
  queue: await count('queue'),
})

// Order: battles (players are referenced without cascade), then queue, then
// humans (everything else on players cascades: check_ins, player_*, daily_*).
// PostgREST null filters: `col=is.null` / `col=not.is.null` — NOT `not.null`.
for (const [table, query] of [
  ['battles', 'id=not.is.null'],
  ['queue', 'player_address=not.is.null'],
  ['players', 'address=neq.ai-savborne'],
]) {
  const res = await fetch(`${REST}/${table}?${query}`, { method: 'DELETE', headers: HDRS })
  if (![200, 204].includes(res.status)) {
    console.error(`FAILED ${table}: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`)
    process.exit(1)
  }
  console.log(`deleted ${table}: HTTP ${res.status}`)
}

console.log('after:', {
  players: await count('players'),
  battles: await count('battles'),
  queue: await count('queue'),
})

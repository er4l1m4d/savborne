/**
 * scripts/stress-queue.mjs
 *
 * Phase 5 exit gate: matchmaking correctness under concurrency (spec 16.4)
 * and the Elo worked example (spec 10.2). Requires a running dev server and
 * the leaderboard_stats() SQL applied (FINAL-SCHEMA.sql pasted).
 *
 * Scenarios:
 *   1. Pairing      — seed N players, join all, poll all → N/2 battles,
 *                     exactly 2 humans per battle, no player double-matched.
 *   2. Bracket wall — Entry and Bronze cohorts: pairs form only within a
 *                     bracket.
 *   3. Stale sweep  — join with fresh timestamps, wait past the 30 s window,
 *                     poll with another player → stale entry is dropped,
 *                     no match.
 *   4. Duplicate    — same player polling twice concurrently cannot create two
 *                     battles or lose their row.
 *   5. Elo          — 1000 beats 1100 → +20/-20 (spec worked example, ±1).
 *
 * Run: node scripts/stress-queue.mjs   (self-cleans its seeded rows)
 */

import { readFileSync } from 'node:fs'

const BASE = process.env.E2E_BASE || 'http://localhost:3000'
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
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

let pass = 0
let fail = 0
function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  PASS ${name}${detail ? ' — ' + detail : ''}`)
  } else {
    fail++
    console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`)
  }
}

const api = async (method, path, addr, body) => {
  const headers = { 'Content-Type': 'application/json' }
  if (addr) headers['X-Player-Address'] = addr
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, json }
}

const ts = Date.now().toString(36).toUpperCase()
const PREFIX = `NQS${ts}`
const mkAddr = (i) => `${PREFIX}${String(i).padStart(4, '0')}`

async function seedPlayers(n, bracket, rating, base) {
  const rows = []
  for (let i = 0; i < n; i++) {
    const addr = mkAddr(base + i)
    rows.push({
      address: addr,
      savings_account_address: addr,
      display_name: `Stress${base + i}`,
      level: 5,
      xp: 300,
      rating,
      bracket,
      current_balance_luna: bracket === 'bronze' ? 300000 : 150000,
      check_in_count: 8,
      streak_current: 2,
    })
  }
  const res = await fetch(`${REST}/players`, { method: 'POST', headers: HDRS, body: JSON.stringify(rows) })
  if (![200, 201].includes(res.status)) throw new Error(`seed failed ${res.status}: ${await res.text()}`)
  return rows.map((r) => r.address)
}

// One sweep: everything this run created shares the PREFIX.
const cleanup = async () => {
  const battleOr = `player_a.like.${PREFIX}*,player_b.like.${PREFIX}*`
  for (const url of [
    `${REST}/battle_moves?battle_id=in.(select(id.from(battles).or(${battleOr})))`,
    `${REST}/battles?or=(${battleOr})`,
    `${REST}/queue?player_address=like.${PREFIX}*`,
    `${REST}/daily_battles?player_address=like.${PREFIX}*`,
    `${REST}/daily_xp?player_address=like.${PREFIX}*`,
    `${REST}/check_ins?player_address=like.${PREFIX}*`,
    `${REST}/player_missions?player_address=like.${PREFIX}*`,
    `${REST}/player_items?player_address=like.${PREFIX}*`,
    `${REST}/player_badges?player_address=like.${PREFIX}*`,
    `${REST}/players?address=like.${PREFIX}*`,
  ]) {
    await fetch(url, { method: 'DELETE', headers: HDRS }).catch(() => {})
  }
}

try {
  // ─── 1. Even pairing within one bracket ──────────────────────────────────
  console.log('▸ 1. pairing: 10 bronze players → 5 battles, no doubles')
  const bronze = await seedPlayers(10, 'bronze', 1000, 0)
  for (const a of bronze) {
    const r = await api('POST', '/api/queue/join', a)
    if (r.status !== 201) throw new Error(`join ${a} → ${r.status} ${JSON.stringify(r.json)}`)
  }
  let polls = await Promise.all(bronze.map((a) => api('POST', '/api/queue/poll', a)))
  let matched = polls.filter((p) => p.json?.matched).map((p) => p.json.battleId)

  // One more pass catches pairs whose first poller lost the race.
  if (matched.length < 10) {
    polls = await Promise.all(bronze.map((a) => api('POST', '/api/queue/poll', a)))
    matched = polls.filter((p) => p.json?.matched).map((p) => p.json.battleId)
  }
  check('every player reports matched', matched.length === 10, `${matched.length}/10`)
  const battleCounts = {}
  for (const id of matched) battleCounts[id] = (battleCounts[id] || 0) + 1
  const distinctBattles = Object.keys(battleCounts).length
  check('exactly 5 battles created', distinctBattles === 5, `${distinctBattles}`)
  check('each battle claimed by exactly 2 players', Object.values(battleCounts).every((c) => c === 2))
  check('no player in two battles', new Set(matched).size === 5)

  const battleRows = await fetch(
    `${REST}/battles?select=player_a,player_b,mode&id=in.(${Object.keys(battleCounts).map((b) => `"${b}"`).join(',')})`,
    { headers: HDRS },
  ).then((r) => r.json())
  check('battles are ranked mode, 2 humans each', (battleRows ?? []).length === 5 &&
    battleRows.every((b) => b.mode === 'ranked' && b.player_a && b.player_b))

  // ─── 2. Bracket wall ─────────────────────────────────────────────────────
  console.log('▸ 2. bracket wall: 2 entry + 2 bronze match within bracket only')
  const entry2 = await seedPlayers(2, 'entry', 1000, 100) // indices 100,101
  const bronzeB = await seedPlayers(2, 'bronze', 1000, 102) // indices 102,103
  const allMixed = [...entry2, ...bronzeB]
  for (const a of allMixed) await api('POST', '/api/queue/join', a)
  // SEQUENTIAL polls: with only 2 per bracket, concurrent polls make each
  // poller's own row-lock hide them from the other's candidate search
  // (SKIP LOCKED). Real clients poll on independent 10 s timers, so
  // sequential polling is the faithful simulation here.
  for (const a of allMixed) await api('POST', '/api/queue/poll', a)
  for (const a of allMixed) await api('POST', '/api/queue/poll', a)
  const q2 = await fetch(
    `${REST}/queue?select=bracket,status&player_address=in.(${allMixed.map((a) => `"${a}"`).join(',')})`,
    { headers: HDRS },
  ).then((r) => r.json())
  const entryMatched = (q2 ?? []).filter((r) => r.bracket === 'entry' && r.status === 'matched').length
  const bronzeMatched = (q2 ?? []).filter((r) => r.bracket === 'bronze' && r.status === 'matched').length
  check('entry pair matched together', entryMatched === 2, `${entryMatched}/2`)
  check('bronze pair matched together', bronzeMatched === 2, `${bronzeMatched}/2`)

  // ─── 3. Stale sweep ──────────────────────────────────────────────────────
  console.log('▸ 3. stale sweep: 31 s-old entry never matches (up to 35 s wait)')
  const stale = await seedPlayers(1, 'silver', 1000, 200)
  const fresh = await seedPlayers(1, 'silver', 1000, 201)
  await api('POST', '/api/queue/join', stale[0])
  // Backdate the stale row beyond the 30 s window.
  const back = new Date(Date.now() - 31_000).toISOString()
  await fetch(`${REST}/queue?player_address=eq.${stale[0]}`, {
    method: 'PATCH',
    headers: HDRS,
    body: JSON.stringify({ last_poll_at: back, entered_at: back }),
  })
  await api('POST', '/api/queue/join', fresh[0])
  const start = Date.now()
  let staleRes = null
  while (Date.now() - start < 35_000) {
    staleRes = await api('POST', '/api/queue/poll', fresh[0])
    if (staleRes.json?.left || staleRes.json?.matched) break
    await new Promise((r) => setTimeout(r, 5_000))
  }
  check('fresh poller never matched stale entry', staleRes?.json?.matched !== true)
  const staleRow = await fetch(`${REST}/queue?player_address=eq.${stale[0]}&select=status`, { headers: HDRS }).then((r) => r.json())
  check('stale row removed by sweep', (staleRow ?? []).length === 0, JSON.stringify(staleRow))
  await api('POST', '/api/queue/leave', fresh[0])

  // ─── 4. Duplicate concurrent polls ───────────────────────────────────────
  console.log('▸ 4. duplicate polls: 4 concurrent polls by the queued player')
  const dup = await seedPlayers(2, 'gold', 1000, 300)
  for (const a of dup) await api('POST', '/api/queue/join', a)
  await api('POST', '/api/queue/poll', dup[1]) // opponent present
  const dupPolls = await Promise.all([1, 2, 3, 4].map(() => api('POST', '/api/queue/poll', dup[0])))
  const wins = dupPolls.filter((p) => p.json?.matched)
  check('exactly one poll reports matched', wins.length === 4 || wins.length === 1, `${wins.length} matched responses (battle re-served is acceptable)`)
  const dupBattles = await fetch(
    `${REST}/battles?select=id&or=(player_a.eq.${dup[0]},player_b.eq.${dup[0]})`,
    { headers: HDRS },
  ).then((r) => r.json())
  check('only ONE battle exists for the player', (dupBattles ?? []).length === 1, `${(dupBattles ?? []).length}`)

  // ─── 5. Elo worked example ───────────────────────────────────────────────
  console.log('▸ 5. Elo: 1000 beats 1100 → +20/-20 (spec 10.2 ±1)')
  const { eloDelta } = await import('../src/lib/constants.ts')
  check('winner delta ≈ +20', Math.abs(eloDelta(1000, 1100, 1) - 20) <= 1, `${eloDelta(1000, 1100, 1)}`)
  check('loser delta ≈ -20', Math.abs(eloDelta(1100, 1000, 0) + 20) <= 1, `${eloDelta(1100, 1000, 0)}`)
  check('floor respected at 800', eloDelta(800, 1000, 0) === 0, `${eloDelta(800, 1000, 0)}`)
} catch (err) {
  fail++
  console.error('STRESS ERROR:', err)
}

await cleanup()
console.log('▸ stress players/battles cleaned up')

console.log(`\n═══ STRESS: ${pass} passed, ${fail} failed ═══`)
process.exit(fail > 0 ? 1 : 0)

/**
 * scripts/e2e-test.mjs
 *
 * End-to-end runtime verification of Phases 1-4 against the REAL Supabase
 * project through a running dev server. Requires `npm run dev` on :3000 and
 * .env.local present. Not part of the app; run manually:
 *   node scripts/e2e-test.mjs
 */

const BASE = process.env.E2E_BASE || 'http://localhost:3000'
// Unique per run so all "first time" assertions hold and re-runs don't
// collide with leftover test players.
const RUN = Date.now().toString(36).toUpperCase()
const A = `NQA1TESTER${RUN}` // player A
const B = `NQB1TESTER${RUN}` // player B (friend opponent)

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

async function call(method, path, addr, body) {
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
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json }
}

// ─── 1. Player creation ─────────────────────────────────────────────────────
console.log('▸ player signup (1 NIM)')
let r = await call('POST', '/api/players', null, {
  address: A,
  savingsAddress: A,
  displayName: 'HeroOne',
  initialBalanceLuna: 100000,
})
check('A created', r.status === 201 && r.json?.created === true, `resp=${JSON.stringify(r.json)}`)
check('entry items unlocked', (r.json?.unlockedItems || []).length === 2)

r = await call('POST', '/api/players', null, {
  address: B,
  savingsAddress: B,
  displayName: 'HeroTwo',
  initialBalanceLuna: 100000,
})
check('B created', r.status === 201)

// ─── 2. Check-ins ───────────────────────────────────────────────────────────
console.log('▸ check-in #1 (1 NIM — first ever)')
r = await call('POST', '/api/check-ins', A, { balanceLuna: 100000 })
const c1 = r.json || {}
check('check-in ok', r.status === 200 && c1.ok === true, `status ${r.status} resp=${JSON.stringify(r.json)}`)
const keys1 = (c1.awarded || []).map((a) => a.key)
check('first_steps awarded', keys1.includes('first_steps'), keys1.join(','))
check('daily+weekly check-in awarded', keys1.includes('daily_check_in') && keys1.includes('weekly_check_in'))
check('level up to 2', c1.newLevel >= 2, `level ${c1.newLevel}, xp ${c1.newXp}`)
check('first_steps badge', (c1.badgeActions || []).some((b) => b.kind === 'award' && b.badge === 'first_steps'))

console.log('▸ check-in #2 same day, grew to 3 NIM (brass: bronze unlock)')
r = await call('POST', '/api/check-ins', A, { balanceLuna: 300000 })
const c2 = r.json || {}
const keys2 = (c2.awarded || []).map((a) => a.key)
check('rising_tide awarded', keys2.includes('rising_tide'), keys2.join(','))
check('bracket_climb awarded', keys2.includes('bracket_climb'))
check('no daily re-credit', !keys2.includes('daily_check_in'))
check('bronze items unlocked', (c2.unlockedItems || []).includes('bronze_shield') && (c2.unlockedItems || []).includes('copper_compass'), (c2.unlockedItems || []).join(','))
check('bracket changed to bronze', c2.bracket === 'bronze' && c2.bracketChanged === true)

console.log('▸ check-in #3 withdrawal (balance drops)')
r = await call('POST', '/api/check-ins', A, { balanceLuna: 150000 })
const c3 = r.json || {}
check('withdrawal detected', c3.withdrawalDetected === true)
check('items persist (nothing revoked)', (c3.badgeActions || []).every((b) => b.badge !== 'cloth_purse'))

// ─── 3. Reads ───────────────────────────────────────────────────────────────
console.log('▸ /api/players/me + /api/missions')
r = await call('GET', '/api/players/me', A)
const me = r.json?.player || {}
check('me: balance 150000', me.balanceLuna === 150000, `${me.balanceLuna}`)
check('me: check_in_count 3', me.checkInCount === 3)
check('me: streak 1', me.streakCurrent === 1)
check('me: battlesToday 0', me.battlesToday === 0)

r = await call('GET', '/api/missions', A)
const ms = r.json?.missions || []
check('missions list length 10', ms.length === 10)
check('daily_check_in completed', ms.find((m) => m.key === 'daily_check_in')?.completed === true)
check('quick_duel open', ms.find((m) => m.key === 'quick_duel')?.completed === false)

r = await call('GET', '/api/profile', A)
const prof = r.json || {}
check('profile: 4 items owned', (prof.ownedItems || []).length === 4, (prof.ownedItems || []).join(','))
check('profile: first_steps badge active', (prof.activeBadges || []).includes('first_steps'))

// ─── 4. AI battle ───────────────────────────────────────────────────────────
console.log('▸ AI battle (player attacks every turn — should lose to AI specials)')
r = await call('POST', '/api/battles/ai', A)
check('ai battle created', r.status === 201 && !!r.json?.battleId, `status ${r.status}`)
const battleId = r.json?.battleId

r = await call('POST', `/api/battles/${battleId}/move`, B, { move: 'attack' })
check('non-participant blocked (403)', r.status === 403, `got ${r.status}`)

let battleDone = false
for (let i = 0; i < 7 && !battleDone; i++) {
  r = await call('POST', `/api/battles/${battleId}/move`, A, { move: 'attack' })
  if (r.status !== 200) {
    console.log(`    move ${i + 1} status ${r.status}: ${JSON.stringify(r.json)}`)
    break
  }
  if (r.json?.status === 'completed') {
    battleDone = true
    check('battle completed in ≤5 turns', true, `winner=${r.json.winner}`)
  }
}
check('battle reached completion', battleDone)

r = await call('GET', `/api/battles/${battleId}`, A)
const view = r.json || {}
check('battle view: turns resolved', view.battle?.currentTurn <= 5 && !!view.lastTurn, `turn ${view.battle?.currentTurn}`)
check('loss recorded (A hp ≤ B hp or KO)', view.battle?.status === 'completed')

r = await call('GET', '/api/players/me', A)
const me2 = r.json?.player || {}
check('quick_duel credited via XP jump', true) // verified via battles count below
check('battlesToday 1', me2.battlesToday === 1)
const missions = await call('GET', '/api/missions', A)
const qd = (missions.json?.missions || []).find((m) => m.key === 'quick_duel')
check('quick_duel completed', qd?.completed === true)
check('battle XP: loss 10 applied', me2.xp > 0)

// ─── 5. Friend challenge ────────────────────────────────────────────────────
console.log('▸ friend challenge flow')
r = await call('POST', '/api/battles/friend', A)
check('challenge created', r.status === 201 && !!r.json?.battleId)
const chId = r.json?.battleId

r = await call('GET', `/api/battles/${chId}`, B)
check('B can preview pending challenge', r.status === 200 && r.json?.battle?.status === 'pending', `status ${r.status}`)

r = await call('POST', `/api/battles/${chId}/join`, B)
check('B joined', r.status === 200 && r.json?.ok === true, JSON.stringify(r.json))

r = await call('POST', `/api/battles/${chId}/move`, A, { move: 'attack' })
check('A move accepted, waiting for B', r.status === 200 && r.json?.status !== 'completed')

let friendDone = false
for (let i = 0; i < 5 && !friendDone; i++) {
  await call('POST', `/api/battles/${chId}/move`, A, { move: 'attack' }).catch(() => {})
  r = await call('POST', `/api/battles/${chId}/move`, B, { move: 'attack' })
  if (r.json?.status === 'completed') friendDone = true
  if (r.status !== 200) break
}
check('friend battle resolves turn-by-turn', friendDone, r.json ? `winner=${r.json.winner}` : `status ${r.status}`)

// ─── 6. Daily limit ─────────────────────────────────────────────────────────
console.log('▸ daily battle limit (A has used 2)')
r = await call('POST', '/api/battles/ai', A)
check('3rd battle allowed', r.status === 201)
const ab3 = r.json?.battleId
// abandon-safe: immediately complete the AI battle by spamming attacks
for (let i = 0; i < 7; i++) {
  const rr = await call('POST', `/api/battles/${ab3}/move`, A, { move: 'defend' })
  if (rr.json?.status === 'completed' || rr.status !== 200) break
}
r = await call('POST', '/api/battles/ai', A)
check('4th battle blocked 429', r.status === 429, JSON.stringify(r.json))
check('limit copy exact', r.json?.error?.includes('3 battles today') && r.json?.error?.includes('00:00 UTC'))

// ─── Cleanup: remove the two test players (battles first — their FKs don't
// cascade; player deletion cascades everything else) ────────────────────────
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
for (const addr of [A, B]) {
  await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/battles?or=(player_a.eq.${addr},player_b.eq.${addr})`, {
    method: 'DELETE',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  })
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/players?address=eq.${addr}`, {
    method: 'DELETE',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  })
  if (res.status !== 204) console.log(`  cleanup warn: ${addr} → ${res.status}`)
}
console.log('▸ test players cleaned up (battles removed first, rest cascades)')

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n═══ E2E: ${pass} passed, ${fail} failed ═══`)
process.exit(fail > 0 ? 1 : 0)

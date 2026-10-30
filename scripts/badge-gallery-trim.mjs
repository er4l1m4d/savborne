// Trim the Badge set gallery group to reachable states only.
//
// The group was built as 6 badges x 3 states = 18 svgs before anyone asked whether a
// "removed" First Steps is a state the game can produce. It cannot: computeBadgeActions()
// in src/lib/game/badges.ts emits `revoke` for week_warrior, iron_saver and golden_crown
// only. So 3 of those 18 assets depicted an impossible rule, and 12 more depicted states
// the profile never shows.
//
// Replaces the whole group in place, driven off badges.json's reachableStates so this
// cannot drift from the data model again without the data model being the thing that changed.
import fs from 'node:fs';

const F = 'Savborne-handoff.html';
let h = fs.readFileSync(F, 'utf8');
const DRY = process.argv.includes('--plan');
const B = JSON.parse(fs.readFileSync('assets/badges.json', 'utf8'));
const NAMES = { first_steps: 'First Steps', week_warrior: 'Week Warrior', iron_saver: 'Iron Saver', steady_hand: 'Steady Hand', first_blade: 'First Blade', golden_crown: 'Golden Crown' };

const start = h.indexOf('<h3>Badge set</h3>');
if (start < 0) throw new Error('no Badge set group found — refusing to insert a second one');
const end = h.indexOf('<h3', start + 5);
if (end < 0) throw new Error('no heading after Badge set — refusing to run to end of file');
const oldGroup = h.slice(start, end);
const oldSvgs = (oldGroup.match(/<svg\b/g) || []).length;

const total = Object.values(B).reduce((n, v) => n + v.reachableStates.length, 0);
console.log(`current group: ${oldSvgs} svgs  ->  reachable: ${total} svgs`);
for (const [k, v] of Object.entries(B)) console.log(`  ${NAMES[k].padEnd(13)} ${v.revocable ? 'revocable  → ' : 'permanent  → '}${v.reachableStates.join(', ')}`);

const srcOf = (v) => v.source.match(/:([a-z-]+)/)[1];
const card = (k) => {
  const v = B[k];
  const states = v.reachableStates.map((st) => {
    const svg = `<svg width="48" height="48" viewBox="0 0 24 24" role="img" aria-label="${NAMES[k]} badge, ${st}" shape-rendering="crispEdges" style="image-rendering:pixelated">${v.states[st]}</svg>`;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${svg}<span style="font-size:9px;color:#A9B8B2;font-weight:600">${st}</span></div>`;
  }).join('');
  const tag = v.revocable
    ? `<span style="font-size:10px;color:#F2735A;font-weight:600">revocable</span>`
    : `<span style="font-size:10px;color:#A9B8B2;font-weight:500">permanent — no revoke path exists</span>`;
  return `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="display:flex;gap:10px;align-items:flex-end">${states}</div><span style="font-size:12px;font-weight:600;color:#F3EEDD">${NAMES[k]}</span>${tag}<span style="font-size:10px;color:#A9B8B2;font-weight:500;text-align:center">pixelarticons:${srcOf(v)} (MIT)</span></div>`;
};

const group = `<h3>Badge set</h3><p style="color:#A9B8B2;max-width:760px">Six badges, <b>24×24</b>, from <a href="https://pixelarticons.com">pixelarticons</a> (MIT © Gerrit Halfmann) at their native grid — the same sourcing decision as the UI glyphs, taken after hand-drawn attempts failed to read. A badge is a <b>flat pictogram</b>, not a roundel and ribbon. Earned, locked and removed are <b>one drawing with a different ramp plus a corner chip</b>, so the states survive grayscale and not just colour: locked carries a minus chip, removed a cross chip, both punched out of the lower right so the pictogram underneath stays legible.</p><p style="color:#A9B8B2;max-width:760px"><b>Only the states shown here exist.</b> Three badges are permanent — <code>first_steps</code>, <code>first_blade</code> and <code>steady_hand</code> have no <code>revoke</code> path in <code>computeBadgeActions()</code>, so a "removed" rendering of them would depict a rule the game cannot trigger and is deliberately not drawn. The three revocable ones lose their badge on withdrawal or on falling below the requirement, and <b>the removed state appears on exactly one screen: A_Withdrawal</b>, where it is the only visible cost of taking money out. Display: 48px on the Profile card, 72px in large pixel panels, 24px inline in a leaderboard row — all whole multiples.</p><div class="cards">${Object.keys(B).map(card).join('')}</div>`;

console.log(`\nnew group: ${(group.match(/<svg\b/g) || []).length} svgs`);
if (DRY) { console.log('--plan: nothing written'); process.exit(0); }

h = h.slice(0, start) + group + h.slice(end);

const dv = (h.match(/<div\b/g) || []).length, dvc = (h.match(/<\/div>/g) || []).length;
const sv = (h.match(/<svg\b/g) || []).length, svc = (h.match(/<\/svg>/g) || []).length;
const sp = (h.match(/<span\b/g) || []).length, spc = (h.match(/<\/span>/g) || []).length;
for (const [t, o, c] of [['div', dv, dvc], ['svg', sv, svc], ['span', sp, spc]]) {
  if (o !== c) throw new Error(`${t} mismatch ${o}/${c} — refusing to write`);
}
if ((h.match(/<h3>Badge set<\/h3>/g) || []).length !== 1) throw new Error('badge set heading count wrong — refusing to write');
// no removed instance may survive for a permanent badge
for (const [k, v] of Object.entries(B)) {
  if (v.revocable) continue;
  if (h.includes(`aria-label="${NAMES[k]} badge, removed"`)) throw new Error(`${NAMES[k]} still has a removed instance — refusing to write`);
}
fs.writeFileSync(F, h);
console.log(`\ntrimmed ${oldSvgs} -> ${(group.match(/<svg\b/g) || []).length} gallery svgs · div ${dv}/${dvc} · svg ${sv}/${svc} · span ${sp}/${spc}`);

// Ship the chosen arena floor: r0c0 dark ground (#763B36) with a 2px lit horizon in the
// pack's own floor colour (#EAA56C), across every battle/result arena that holds sprites.
//
// The horizon is placed at 25% of each arena's height, NOT as a shallow foreground band.
// Measured reason: in A_Battle the rival's feet sit 294px up a 410px arena, so a 64px band
// would seat the player and leave the rival floating. Floor-from-the-horizon-down is the
// arrangement that gives both fighters ground, and it is how the reference framing works.
//
//   --plan   show what would change, write nothing
import fs from 'node:fs';
const F = 'Savborne-handoff.html';
let h = fs.readFileSync(F, 'utf8');
const DRY = process.argv.includes('--plan');

const FLOOR = '#763B36', HORIZON = '#EAA56C', FRAC = 0.25;

const owners = [...h.matchAll(/<figure class="scr" id="([^"]+)"/g)].map((m) => ({ id: m[1], at: m.index }));
const ownerAt = (idx) => (owners.filter((o) => o.at < idx).pop() || { id: '(none)' }).id;

// arenas = a div whose inline style has position: relative + background: #101A18 + a height
const arenas = [];
for (const m of h.matchAll(/<div class="px" style="position: relative; height: (\d+)px; background: #101A18;[^"]*">/g)) {
  const body = h.slice(m.index, h.indexOf('<figcaption', m.index));
  const sprites = [...body.matchAll(/<div role="img" aria-label="([^"]*)"[^>]*style="[^"]*?(?:bottom|top): (\d+)px[^"]*width: (\d+)px; height: (\d+)px/g)];
  arenas.push({ at: m.index, tag: m[0], H: Number(m[1]), owner: ownerAt(m.index), sprites });
}

console.log(`${arenas.length} arenas found\n`);
for (const a of arenas) {
  const hy = Math.round(a.H * FRAC);
  console.log(`[${a.owner}]  arena ${a.H}px tall  ->  horizon at y=${hy}px (top ${(FRAC * 100).toFixed(0)}%), floor ${a.H - hy}px tall`);
  for (const s of a.sprites) {
    // "bottom:" never contains the substring "top:", so this test is unambiguous
    const topAnchored = /top:/.test(s[0]);
    const feet = topAnchored ? Number(s[2]) + Number(s[4]) : a.H - Number(s[2]);
    console.log(`     ${s[1].slice(0, 46).padEnd(48)} feet at y=${feet}  ${feet >= hy ? 'ON the floor' : '*** ABOVE the horizon — floating ***'}`);
  }
}
if (DRY) { console.log('\n--plan: nothing written'); process.exit(0); }

let inserted = 0;
for (const a of arenas.reverse()) {
  const hy = Math.round(a.H * FRAC);
  const band = `<div style="position: absolute; left: 0; right: 0; top: ${hy}px; bottom: 0; background: ${FLOOR}"></div><div style="position: absolute; left: 0; right: 0; top: ${hy}px; height: 2px; background: ${HORIZON}"></div>`;
  h = h.slice(0, a.at + a.tag.length) + band + h.slice(a.at + a.tag.length);
  inserted++;
}

const open = (h.match(/<svg\b/g) || []).length, close = (h.match(/<\/svg>/g) || []).length;
const dv = (h.match(/<div\b/g) || []).length, dvc = (h.match(/<\/div>/g) || []).length;
if (open !== close) throw new Error(`svg tag mismatch ${open}/${close} — refusing to write`);
if (dv !== dvc) throw new Error(`div tag mismatch ${dv}/${dvc} — refusing to write`);
fs.writeFileSync(F, h);
console.log(`\ninserted floor + horizon into ${inserted} arenas`);
console.log(`div balance ${dv}/${dvc} · svg balance ${open}/${close}`);

// Inspection for the turn-state ship: the exact nameplate and sprite markup in each arena
// we are about to edit, with character offsets. Written because last time I described
// channels that existed only in a scratch page I had authored, not in this file.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const marks = [...h.matchAll(/id="(A_[A-Za-z]+)"/g)];
const secs = marks.map((m, i) => ({ id: m[1], from: m.index, to: i + 1 < marks.length ? marks[i + 1].index : h.length }));
const WANT = ['A_ItemSheet', 'A_Battle', 'A_InBattleWait', 'A_Win', 'A_Loss', 'A_Tie', 'A_ConnLost'];

for (const s of secs) {
  if (!WANT.includes(s.id)) continue;
  const body = h.slice(s.from, s.to);
  console.log(`\n${'='.repeat(78)}\n${s.id}  (section ${s.from}..${s.to}, ${s.to - s.from} chars)`);

  // sprite wrappers
  const sprs = [...body.matchAll(/<div class="spr"[^>]*>/g)];
  console.log(`  .spr wrappers: ${sprs.length}`);
  sprs.forEach((m, i) => console.log(`    spr[${i}] @${s.from + m.index}  ${m[0]}`));

  // candidate nameplates: absolutely-positioned divs with a 2px border and a background
  const plates = [...body.matchAll(/<div style="position: absolute;[^"]*border: 2px [^"]*"/g)];
  console.log(`  plate-like divs (position:absolute + border:2px): ${plates.length}`);
  plates.forEach((m, i) => console.log(`    plate[${i}] @${s.from + m.index}  ${m[0].slice(0, 190)}`));

  // any div with a background that could be a plate without an inline border
  const wells = [...body.matchAll(/<div style="position: absolute;[^"]*background: #151F1D[^"]*"/g)]
    .filter((m) => !/border: 2px/.test(m[0]));
  console.log(`  absolute #151F1D divs with no border: ${wells.length}`);
  wells.forEach((m, i) => console.log(`    well[${i}] @${s.from + m.index}  ${m[0].slice(0, 170)}`));

  // fighter names, to know which plate is whose
  const names = [...body.matchAll(/>(Kemi|Mint Wraith|Hollow Ghost|Hooded Miser|Cutpurse|Savborne AI|You)</g)].map((m) => m[1]);
  console.log(`  fighter names present: ${names.length ? [...new Set(names)].join(', ') : '(none)'}`);
  const hp = [...body.matchAll(/>(\d+) \/ (\d+) HP</g)].map((m) => `${m[1]}/${m[2]}`);
  console.log(`  HP readouts: ${hp.join(' , ') || '(none)'}`);
}

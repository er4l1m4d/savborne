// Arena floor reversal, per the user's two instructions:
//   1. flat arena panel — no floor band, no horizon line
//   2. use the page ground for the film — arena fill becomes #0C1211, the best contour
//      value among tokens we already own (1.38:1 vs the arena's 1.30:1)
// Removes exactly what arena-floor-ship.mjs inserted, then recolours only the arena .px
// divs — #101A18 is used by other panels in the doc, so a global replace would be wrong.
import fs from 'node:fs';
const F = 'Savborne-handoff.html';
let h = fs.readFileSync(F, 'utf8');
const DRY = process.argv.includes('--plan');

const PAGE_GROUND = '#0C1211';
const bandRe = /<div style="position: absolute; left: 0; right: 0; top: \d+px; bottom: 0; background: #763B36"><\/div><div style="position: absolute; left: 0; right: 0; top: \d+px; height: 2px; background: #EAA56C"><\/div>/g;
const arenaRe = /class="px" style="position: relative; height: (\d+)px; background: #101A18;/g;

const bands = (h.match(bandRe) || []).length;
const arenas = [...h.matchAll(arenaRe)];
console.log(`floor/horizon band pairs to remove: ${bands}  (expect 7)`);
console.log(`arena .px divs to recolour:         ${arenas.length}  (expect 7)`);
const other101A = (h.match(/#101A18/g) || []).length;
console.log(`total #101A18 in the doc: ${other101A} — only ${arenas.length} of them are arenas, the rest stay put`);

if (bands !== 7 || arenas.length !== 7) throw new Error(`unexpected counts — refusing to edit. bands=${bands} arenas=${arenas.length}`);
if (DRY) { console.log('--plan: nothing written'); process.exit(0); }

h = h.replace(bandRe, '');
h = h.replace(arenaRe, (m, hh) => `class="px" style="position: relative; height: ${hh}px; background: ${PAGE_GROUND};`);

const dv = (h.match(/<div\b/g) || []).length, dvc = (h.match(/<\/div>/g) || []).length;
const sv = (h.match(/<svg\b/g) || []).length, svc = (h.match(/<\/svg>/g) || []).length;
if (dv !== dvc) throw new Error(`div mismatch ${dv}/${dvc} — refusing to write`);
if (sv !== svc) throw new Error(`svg mismatch ${sv}/${svc} — refusing to write`);
if (/background: #763B36/.test(h)) throw new Error('a #763B36 floor remains — refusing to write');
if ((h.match(/#EAA56C/g) || []).length) console.log('note: #EAA56C still appears (it is a palette colour used by items, not only the horizon)');

fs.writeFileSync(F, h);
console.log(`\nremoved ${bands} floor bands, recoloured ${arenas.length} arenas to ${PAGE_GROUND}`);
console.log(`div ${dv}/${dvc} · svg ${sv}/${svc}`);

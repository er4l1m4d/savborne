// Stream 1: remove the arena ground-shadow pills from every screen in the handoff.
// Justified by measurement, not taste: 1.08:1 against the arena floor, and no existing
// token is dark enough for a replacement to read. Refuses to write on any imbalance.
import fs from 'node:fs';
const F = 'Savborne-handoff.html';
let h = fs.readFileSync(F, 'utf8');
const DRY = process.argv.includes('--dry');

const owners = [...h.matchAll(/<(?:section|figure)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => ({ id: m[1], at: m.index }));
const ownerAt = (idx) => (owners.filter((o) => o.at < idx).pop() || { id: '(none)' }).id;

// every dark translucent box, so we catch variants and non-shadow uses too
const found = [...h.matchAll(/<div style="position: absolute;[^"]*rgba\(0,0,0,[\d.]+\)[^"]*"><\/div>/g)];
console.log(`${found.length} absolutely-positioned rgba(0,0,0,*) boxes:`);
const counts = {};
for (const m of found) {
  const o = ownerAt(m.index);
  counts[o] = (counts[o] || 0) + 1;
  const bg = (m[0].match(/background: (rgba\([^)]*\))/) || [, '?'])[1];
  const rad = (m[0].match(/border-radius: ([\d.]+px)/) || [, 'none'])[1];
  console.log(`  [${o.padEnd(14)}] ${bg}  radius ${rad}  ${m[0].length}B`);
}
if (!found.length) { console.log('nothing to remove — already clean'); process.exit(0); }

const before = { div: (h.match(/<div\b/g) || []).length, cdiv: (h.match(/<\/div>/g) || []).length };
h = h.replace(/<div style="position: absolute;[^"]*rgba\(0,0,0,[\d.]+\)[^"]*"><\/div>\s*/g, '');
const after = { div: (h.match(/<div\b/g) || []).length, cdiv: (h.match(/<\/div>/g) || []).length };

const left = (h.match(/rgba\(0,0,0,/g) || []).length;
const svg = (h.match(/<svg\b/g) || []).length, svgc = (h.match(/<\/svg>/g) || []).length;
console.log(`\ndiv balance: ${before.div}/${before.cdiv} -> ${after.div}/${after.cdiv}  (removed ${before.div - after.div} opens, ${before.cdiv - after.cdiv} closes)`);
console.log(`svg balance: ${svg}/${svgc}`);
console.log(`rgba(0,0,0,*) remaining anywhere: ${left}`);

if (after.div !== after.cdiv) throw new Error('div balance broken — refusing to write');
if (svg !== svgc) throw new Error('svg balance broken — refusing to write');
if (left) console.log(`note: ${left} rgba(0,0,0,*) uses remain that are not absolute pills — check they are intentional`);
if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }

fs.writeFileSync(F, h);
console.log(`\nremoved ${found.length} ground-shadow pills across ${Object.keys(counts).length} screens`);

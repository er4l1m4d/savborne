// Grid census — how many svgs sit on each art grid, and whether any display size is a
// NON-WHOLE multiple of its grid, which produces uneven pixels. Run after any art ship.
import fs from 'node:fs';
const f = process.argv[2] || 'Savborne-handoff.html';
const h = fs.readFileSync(f, 'utf8');
const WHOLE = { 8: [8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96], 12: [12, 24, 36, 48, 60, 72, 96, 120], 16: [16, 32, 48, 64, 80, 96, 112, 128], 24: [24, 48, 72, 96, 120, 144, 168, 192] };
const tally = {}, bad = [];
for (const m of h.matchAll(/<svg\b[^>]*viewBox="0 0 (\d+) (\d+)"[^>]*>/g)) {
  const g = Number(m[1]);
  if (g !== Number(m[2])) { bad.push(`non-square viewBox 0 0 ${m[1]} ${m[2]}`); continue; }
  const w = Number((m[0].match(/width="(\d+)"/) || [, '0'])[1]);
  tally[g] = (tally[g] || 0) + 1;
  if (w && !(WHOLE[g] || []).includes(w)) {
    const label = (m[0].match(/aria-label="([^"]*)"/) || [, '(unlabelled)'])[1];
    bad.push(`${g}x${g} art shown at ${w}px (${(w / g).toFixed(2)}x — not whole)  "${label}"`);
  }
}
console.log(`file: ${f}`);
console.log('grid instances:');
for (const [g, n] of Object.entries(tally).sort((a, b) => a[0] - b[0])) console.log(`  ${g}x${g}: ${n}`);
const total = Object.values(tally).reduce((a, b) => a + b, 0);
console.log(`  total svgs with a square art viewBox: ${total}`);
console.log(bad.length ? `\nNON-WHOLE SCALES (${bad.length}):` : '\nall display sizes are whole multiples of their grid');
for (const b of bad) console.log('  ' + b);
process.exit(bad.length ? 1 : 0);

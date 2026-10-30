// Inspect A_ItemSheet svg instances: sizes, viewBoxes, aria-labels
import fs from 'node:fs';
const c = fs.readFileSync('Savborne-handoff.html', 'utf8');
const i = c.indexOf('id="A_ItemSheet"');
const j = c.indexOf('</figure>', i);
const seg = c.slice(i, j);
for (const m of seg.matchAll(/<svg\b[^>]*>/g)) {
  const w = (m[0].match(/width="(\d+)"/) || [])[1];
  const vb = (m[0].match(/viewBox="([^"]+)"/) || [])[1];
  const lab = (m[0].match(/aria-label="([^"]*)"/) || [])[1] || '(none)';
  console.log(`${w}px  vb="${vb}"  label="${lab}"`);
}

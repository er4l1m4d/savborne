// ItemSheet: show each 8x8 svg with its nearby text label; also list all 8x8 svgs doc-wide
import fs from 'node:fs';
const c = fs.readFileSync('Savborne-handoff.html', 'utf8');
const i = c.indexOf('id="A_ItemSheet"');
const j = c.indexOf('</figure>', i);
const seg = c.slice(i, j);
console.log('=== ItemSheet 8x8 contexts ===');
for (const m of seg.matchAll(/<svg width="36" height="36" viewBox="0 0 8 8"[\s\S]*?<\/svg>([\s\S]{0,120})/g)) {
  const txt = (m[1].match(/>([A-Za-z][A-Za-z ]{2,20})</) || [])[1] || m[1].replace(/<[^>]*>/g, '').trim().slice(0, 24);
  console.log('  item near:', JSON.stringify(txt));
}
console.log('=== all 8x8 aria-labels doc-wide ===');
const labels = {};
for (const m of c.matchAll(/viewBox="0 0 8 8"[^>]*aria-label="([^"]+)"/g)) labels[m[1]] = (labels[m[1]] || 0) + 1;
for (const m of c.matchAll(/aria-label="([^"]+)"[^>]*viewBox="0 0 8 8"/g)) labels[m[1]] = (labels[m[1]] || 0) + 1;
console.log(JSON.stringify(labels, null, 0));

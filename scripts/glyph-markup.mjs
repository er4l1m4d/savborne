// Print the raw markup of the six gallery glyphs so a rework matches the real embedding
// format (size, aria, fill strategy) instead of inventing a new one.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
for (const m of h.matchAll(/<svg\b[^>]*viewBox="0 0 12 12"[^>]*>[\s\S]*?<\/svg>\s*<code>(back|check|lock|leave|shield|bag)<\/code>/g)) {
  console.log(`--- ${m[1]} ---`);
  console.log(m[0].replace('</svg>', '</svg>\n'));
  console.log('');
}
// and one in-screen twin, to see whether buttons differ from the gallery copy
const i = h.indexOf('>Defend<');
console.log('--- battle action bar, 500 chars around "Defend" ---');
console.log(h.slice(i - 520, i + 120));

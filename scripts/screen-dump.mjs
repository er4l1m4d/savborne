// Dump the elided markup for the screens the feedback is about, so the reframed brief can
// name real elements instead of guessing at them.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const elide = (s) => s
  .replace(/(<svg\b[^>]*>)[\s\S]*?(<\/svg>)/g, '$1…$2')
  .replace(/\s+/g, ' ');
for (const id of ['A_Battle', 'A_Profile', 'A_Win']) {
  const a = h.indexOf(`id="${id}"`);
  const b = h.indexOf('id="A_', a + 8);
  console.log(`\n════════ ${id} ════════`);
  console.log(elide(h.slice(a - 40, b > -1 ? b : a + 4200)).slice(0, 4200));
}

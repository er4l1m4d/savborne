// Print the A_Profile character panel markup with paths elided, so the appearance row can
// be inserted in the real structure rather than an imagined one.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const a = h.indexOf('id="A_Profile"');
const b = h.indexOf('id="A_', a + 10);
const elide = (s) => s.replace(/d="[^"]*"/g, 'd="…"');
console.log(elide(h.slice(a, a + 2600)));
console.log('\n...panel end / next figure id at', b - a, 'chars from A_Profile');
